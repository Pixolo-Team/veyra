# @veyra/api

Veyra MVP backend. **NestJS + Prisma + Supabase Postgres.** Phase 0 of
[docs/mvp-plan.md](../../docs/mvp-plan.md) — the runnable skeleton the rest of the
API hangs off.

```bash
cp .env.example .env          # fill in Supabase DATABASE_URL / DIRECT_URL
npm install                    # from repo root
npm run prisma:generate -w @veyra/api
npm run prisma:deploy   -w @veyra/api   # apply migrations
npm run db:seed         -w @veyra/api   # CTD template + first admin
npm run dev             -w @veyra/api   # http://localhost:4000/api
```

`GET /api/health` → `{ "status": "ok", "db": "up", ... }`.

## Layout

| Path | Holds |
| --- | --- |
| `prisma/schema.prisma` | The full MVP data model (mvp-plan §4). `facilitator` and per-document capability scopes are in the DB enums from day one, rejected at the validation layer (D6). |
| `prisma/seed.ts` | Operator provisioning (D1/D11): one discloser company + tenant + admin on a one-time password, plus the `ctd` module template. |
| `src/config/env.ts` | zod-validated environment. Bad/missing vars fail the boot. |
| `src/prisma/` | `PrismaService` (connect/disconnect on lifecycle) + global module. |
| `src/storage/` | `StorageService` contract with a `local` driver (active) and an `s3` driver (written, commented — see below). |
| `src/health/` | `GET /api/health` with a DB round-trip. |

## Database

Supabase Postgres. Two URLs (see `.env.example`):

- `DATABASE_URL` — transaction pooler (port 6543, `pgbouncer=true`) for the app.
- `DIRECT_URL` — session pooler (port 5432) for migrations; DDL can't run through
  pgbouncer transaction pooling.

Migrations live in `prisma/migrations/`. The `00000000000000_init` baseline was
generated with `prisma migrate diff` and applied with `prisma migrate deploy`,
because Supabase pre-installs extensions (`pg_stat_statements`, `supabase_vault`,
`uuid-ossp`) that `prisma migrate dev` reads as drift. Keep using
`prisma migrate dev` locally for new migrations; if it reports drift on those
extensions, generate with `migrate diff` and apply with `migrate deploy`.

## Storage

`STORAGE_DRIVER=local` writes under `apps/api/storage/` (git-ignored) and serves
objects through `GET /api/storage/object` behind an HMAC-signed, short-TTL URL.

The S3 driver — SSE-KMS, private bucket, presigned PUT/GET at a 5-minute TTL
(mvp-plan §3) — is fully written in `src/storage/s3-storage.service.ts` but
commented out. To switch:

1. `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner -w @veyra/api`
2. Uncomment `s3-storage.service.ts` and the `s3` branch in `storage.module.ts`.
3. Set `STORAGE_DRIVER=s3` and the `S3_*` vars.

Nothing else in the app changes — every caller depends on `StorageService`.

## Auth (Phase 1)

Server-side sessions, no JWT (mvp-plan §3) — a session is a row in `sessions`,
so revoking one takes effect on the next request. The raw token lives in an
httpOnly `SameSite=Lax` cookie; the DB stores only its SHA-256. Passwords are
Argon2id. A global `AuthGuard` protects every route except those marked
`@Public()`.

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | public | Email + password → session cookie. `mustResetPassword` is true while `user.status = 'invited'` (one-time password, D11). |
| `POST /api/auth/logout` | session | Revokes the current session, clears the cookie. |
| `GET  /api/auth/me` | session | The current `SessionUser`. |
| `POST /api/auth/set-password` | session | Forced first-login reset. Verifies the current password, then ends every *other* session. |
| `POST /api/auth/password-reset` | public | Requests a reset link. Always 202 — no account enumeration. Writes a 15-min single-use token + an `email_messages` outbox row. |
| `POST /api/auth/password-reset/confirm` | public | Consumes the token, sets the password, revokes all sessions. |

Every auth event (`auth.login`, `auth.login_failed`, `auth.logout`,
`auth.password_changed`, `auth.password_reset_requested`,
`auth.password_reset_completed`) is written to `audit_events` by `AuditService`
(append-only; a failed audit write never breaks the action it records).

All transactional email goes through `EmailService.enqueue()` → the
`email_messages` outbox. `OutboxWorker` (below) drains it every 20s via
`MailerService`: `MAILER_DRIVER=console` logs each rendered email (how tests read
invite tokens — the token is also in the row's `payload`), `noop` drops it,
`resend` is stubbed in `mailer.service.ts`. Plain-text renderers live in
`email/templates.ts`; React Email templates replace them later.

## Rooms (Phase 2, partial)

Every room is reached through the caller's `room_participants` rows, so the
multi-room switcher is just `GET /api/rooms` (mvp-plan D12). Tenancy is scoped
explicitly in each query.

| Route | Purpose |
| --- | --- |
| `GET  /api/rooms` | The switcher — every room the user participates in, with their side/role and last activity. |
| `POST /api/rooms` | Creation step 1 (mvp-plan §5.1). Caller must be a tenant `owner`/`admin`. Seeds Modules 1–5 from the `ctd` template + a `documents` section container, and makes the creator a discloser `admin`. Audited as `room.created`. |
| `GET  /api/rooms/:roomId` | Room detail + modules. 404 if the caller isn't a participant. |

| `GET  /api/rooms/:roomId/participants` | Groups screen — people by company, each side together. |
| `POST /api/rooms/:roomId/accept-nda` | Existing-user path into a room: NDA click-through, then the participant goes `active`. |

### Invitations & company resolution (mvp-plan §5.2)

| Route | |
| --- | --- |
| `GET  /api/companies/resolve?email=&q=` | Fuzzy match on company name + verified domains; a domain hit outranks a name hit. Suggestions only. |
| `POST /api/rooms/:roomId/invitations` | Room `admin` invites `email` + `role` + company. Side is **derived** from the company vs. the room (a recipient admin can only invite recipient-side). New email → user shell + `room_invite`; existing → `room_added`. Both create a `pending` invitation + an `invited` participant. |
| `GET  /api/rooms/:roomId/invitations` | Room `admin` — every invitation on the room. |
| `GET  /api/invitations/:token` | **public** — preview for the accept screen (room, inviter, role, NDA, is-new-user). |
| `POST /api/invitations/accept` | **public** — new-user path: set password + name, accept the NDA if required, activate the participant, sign in. |

One room fixes one company per side; the recipient company is set by the first
recipient-side invite and every later recipient joins under it.

Audit: `invitation.created`, `invitation.accepted`, `nda.accepted`.

Not yet built: invite reminders (72h) / expiry sweep, the `email_messages`
outbox worker, room settings updates, `participant_capabilities` derivation.

## Data room — folders & documents (Phase 3, partial)

Modules are data (D7): a room seeds Modules 1–5 (`section = dossier`) + a
`documents` container. Folders and documents hang off a module; folders nest via
a materialized `path`.

| Route | Role | |
| --- | --- | --- |
| `GET  /api/rooms/:roomId/tree?section=dossier\|documents` | participant | Nested module → folder → document tree. |
| `POST /api/rooms/:roomId/folders` | contributor | `{ name, roomModuleId, parentFolderId? }`. |
| `PATCH /api/folders/:id` · `/move` · `DELETE` | contributor | Rename re-paths descendants; delete is a soft cascade. |
| `POST /api/rooms/:roomId/documents` | contributor | Multipart: `file` + `roomModuleId` + `folderId?`. Creates the document and version 1. 250 MB cap. |
| `POST /api/documents/:id/versions` | contributor | Multipart `file` → v(n+1); advances `currentVersionId` (D4 re-anchoring not built). |
| `GET  /api/documents/:id` | reviewer | Detail + all versions. |
| `PATCH /api/documents/:id` · `/move` · `DELETE` | contributor | Rename / move between folders & modules / soft-delete. |
| `GET  /api/document-versions/:id/content` | participant | `{ url }` — short-TTL signed URL to the rendered PDF (or original). Audited `document.viewed`. |

Native PDFs get `renderStatus = ready` immediately; other types are stored with
`renderStatus = pending` and wait on the **not-yet-built** Office→PDF conversion
job (D2).

### Folder-drop batch upload (mvp-plan §5.3, Risk #1)

| Route | |
| --- | --- |
| `POST /api/rooms/:roomId/upload-batches` | `{ roomModuleId, folderId?, paths[] }` — declare every relative path up front (drives the drawer's tree preview + queued states). Creates the `upload_batch` + one `upload_batch_files` row per path. |
| `POST /api/upload-batches/:id/files` | Multipart `file` + `relativePath`. Rebuilds the folder chain (`FoldersService.ensurePath`, idempotent), writes the document version, marks the file `ready` / `failed` + records the error. Re-sending a `ready` path is a no-op; re-sending a `failed` one retries. The document name comes from `relativePath`, not the multipart filename. |
| `GET  /api/upload-batches/:id` | Batch + per-file states. |
| `POST /api/upload-batches/:id/complete` | Finalises: `completed`, or `failed` if any file failed, or stays `uploading` while some are still pending. |

`DocumentWriter` is the single place a version is written — shared by single
upload, replace, and batch, so they can't drift. Audit: `upload_batch.created`
/ `.completed`.

**Per-viewer watermarks (D9)** — when `room.watermark_enabled` (default on),
`GET /document-versions/:id/content` serves a stamped copy, never the original.
`WatermarkService` burns `{name} · {email} · {date}` diagonally across every page
with pdf-lib, stores it at `rooms/{roomId}/renditions/{versionId}/{participantId}.pdf`,
and caches on `(version, participant)` in `document_renditions` keyed by a
`template_hash` (a template change re-stamps). `download` still serves the
original. *Caveat:* the mark is currently pdf-lib text, so it lands in the
extractable text layer — fine while text-quote anchoring on converted docs (D4)
isn't built, but it must become a raster/vector stamp before that ships.

Audit: `folder.*`, `document.uploaded` / `.version_added` / `.renamed` /
`.moved` / `.deleted` / `.viewed`.

## Review — annotations & comment threads (Phase 4, partial)

One shape, one direction (mvp-plan §4): an annotation with no thread is a private
marker; a thread with an `annotationId` is an inline anchored comment; a thread
with `annotationId = null` is a document-level comment.

| Route | |
| --- | --- |
| `POST /api/document-versions/:vid/annotations` | 3-colour highlight (`amber` / `blue` / `rose`) with a W3C-style anchor (`text_quote` or `region`; page-relative `rects` always present). |
| `GET  /api/document-versions/:vid/annotations` | Own markers + annotations whose thread the caller can see. |
| `DELETE /api/annotations/:id` | Author or room admin; blocked while a thread hangs off it. |
| `POST /api/document-versions/:vid/threads` | Thread + first comment. `visibility` defaults to `side`. |
| `GET  /api/document-versions/:vid/threads?color=&status=&authorParticipantId=&sharedWithMe=` | Sidebar list, visibility-filtered. |
| `PATCH /api/threads/:id` | `status` (resolve / reopen) — anyone visible; `visibility` (side ↔ room) — **authoring side only** (D5). |
| `POST /api/threads/:id/comments` · `PATCH /api/comments/:id` · `DELETE /api/comments/:id` | Reply / edit own / delete (author or admin). |

**Visibility (D5):** a `side` thread is visible only to participants on the
creator's side; `room` to everyone. Default `side`, so a reviewer's private notes
don't reach the counterparty until deliberately shared. `@mentions` validate
room membership and enqueue a `comment_digest` email batched 15 minutes out.

Not built: per-viewer watermark stamping (D9), the notification digest worker,
D4 thread re-anchoring across versions.

Audit: `annotation.created` / `.deleted`, `thread.created` / `.resolved` /
`.open` / `.visibility_changed`, `comment.added` / `.deleted`.

## Overview, activity & downloads (Phase 4a / 5, partial)

| Route | Role | |
| --- | --- | --- |
| `GET /api/rooms/:roomId/overview` | participant | Dashboard aggregate: setup checklist, per-module folder/document counts, open-thread age buckets (visibility-filtered), counterparty reading (distinct `document.viewed` by the other side, last 7d), 15 most-recent events. |
| `GET /api/rooms/:roomId/activity?cursor=&limit=&action=` | participant | Paginated audit feed, newest first. |
| `GET /api/rooms/:roomId/activity.csv` | admin | CSV export of the whole log. |
| `GET /api/document-versions/:id/download` | participant | Original file, gated by the room's `allow_download` (D8) **and** a per-participant `download` capability (auto-allowed for admin/contributor; a `participant_capabilities` row with `capability='download', allow=true` grants a reviewer). Audited `document.downloaded`. |

`document.viewed` / `.downloaded` audit rows carry `actorParticipantId` so the
"counterparty reading" panel can filter by side.

## Background jobs (`src/jobs/`)

`@nestjs/schedule`. Every job no-ops when `WORKERS_ENABLED=false`, so a second
API instance or a test run can leave them off.

| Job | Cadence | Does |
| --- | --- | --- |
| `OutboxWorker` | every 20s | Drains `email_messages`. Claims each row with a conditional `queued → sending` update (safe across instances), sends via `MailerService`, retries with backoff (1m/5m/30m/1h) up to 5 attempts, then parks at `failed`. |
| `InvitationsJob` | hourly | Expires `pending` invitations past `expiresAt` (14d); enqueues `invite_reminder` for ones older than 72h with no `remindedAt`. |
| `DigestJob` | daily 07:00 | Per room, enqueues `document_digest` to active participants for documents added in the last 24h (skips `notification_prefs.frequency = 'off'` and self-uploads). |
| `SessionsJob` | daily 03:00 | Deletes sessions expired or revoked more than 30 days ago. |

## Hardening

- **Rate limiting** — `@nestjs/throttler`, in-memory (single instance). Global
  120 req/min; `/auth/login`, `/auth/password-reset[/confirm]`,
  `/invitations/accept` tightened to 8/min via `@Throttle`. `/health` and
  `/storage` skip it.
- **Account lockout** — 10 failed sign-ins for one email in 15 min → 429,
  independent of the per-IP throttle (counts `auth.login_failed` audit rows).
- **Body size** — JSON/urlencoded capped at 1 MB; uploads bypass it (multipart,
  250 MB in multer).
- **Sliding sessions** — a session past its half-life is extended to a fresh
  `SESSION_TTL_HOURS` on the next request and the cookie re-stamped; an idle
  session still times out. Absolute expiry + instant revocation via the
  `sessions` row are unchanged.
- `helmet`, `trust proxy 1` (for `req.ip` behind one reverse proxy).

## Request context & RLS

`RequestContextService` (AsyncLocalStorage, populated by a middleware + the
AuthGuard) carries `userId` / `ip` / `userAgent` so `AuditService` doesn't need
them threaded through every call.

**RLS is written and applied, but dormant.** The `20260902032305_row_level_security`
migration (+ two corrective ones) creates:

- a `veyra_app` role (`NOBYPASSRLS`), granted to `postgres` so a session can
  `SET LOCAL ROLE` to it;
- `app.*` `SECURITY DEFINER` helper functions (`is_room_member`, `is_room_admin`,
  `my_side`, `thread_visible`, …) — `SECURITY DEFINER` so a policy on
  `room_participants` can call `is_room_member` without infinite recursion;
- `ENABLE ROW LEVEL SECURITY` + per-table policies on all 27 content tables,
  including the D5 side/room thread-visibility rule.

It does **not** take effect yet: the app connects as `postgres`, which has
`BYPASSRLS`. App-level `where`-scoping remains the live enforcement. Verified out
of band that under `SET LOCAL ROLE veyra_app` + `set_config('app.user_id', …)`
the policies isolate rooms and enforce D5 (a discloser admin cannot read the
recipient side's `side` threads or private markers).

**To activate:** wrap each authenticated request in one transaction that runs
`SET LOCAL ROLE veyra_app; SELECT set_config('app.user_id', <users.id>, true);`
and route Prisma through it (a Proxy on `PrismaService` keyed off
`RequestContextService`, so nested `$transaction` calls reuse the request tx).
Public routes (login, invite accept, password reset) and background jobs keep
running as `postgres` and bypass RLS by design. Bump `connection_limit` in
`DATABASE_URL` first — each in-flight request will hold a pooled connection.

## Validation

Request validation uses zod schemas from
[`@veyra/contracts`](../../packages/contracts), not `class-validator`, via
`ZodValidationPipe` per route (`@Body(new ZodValidationPipe(schema))`).

## TypeScript

This workspace does **not** extend `tsconfig.base.json`: NestJS needs
`experimentalDecorators` + `emitDecoratorMetadata` and CommonJS output, which
conflict with the base's `verbatimModuleSyntax` / `erasableSyntaxOnly` /
`module: esnext`. It has its own `tsconfig.json` and its own `typecheck` script,
and is not part of the root `tsc -b` graph.
