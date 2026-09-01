# Veyra MVP — Build Plan

*Scope: Discloser ⇄ Recipient only. Facilitator is designed for in the schema but not built.*
*Derived from `veyra_product_plan_v1.md` (V1 product plan). Where the two disagree, this document governs the MVP.*

---

## 1. What the MVP is

One sentence: **a discloser uploads a CTD dossier module by module, invites a recipient team, and that team reviews it in-browser — highlighting and commenting inline — with every action logged.**

Five capability blocks:

| # | Block | Ships in MVP |
|---|---|---|
| 1 | **Identity & access** | Email + password login, invite-only accounts, password reset, room-scoped roles |
| 2 | **Onboarding & email** | Discloser activation, guest invite acceptance, NDA click-through, 6 transactional emails |
| 3 | **Data room** | Modules 1–5, folder-tree upload, later add/edit/replace of folders and files |
| 4 | **Review** | PDF viewer, per-viewer watermarking, inline anchored comments with threaded replies, 3-colour highlighting |
| 5 | **Audit** | Append-only activity log, visible per room |

### Explicitly out of MVP

Facilitator rooms · **Q&A module (routing, assignment, approval before release)** · redlining / proposed edits / accept-reject · version diffing · self-serve signup · billing · SSO · OCR & full-text search · AI features · per-document permission tiers.

Q&A is the first thing after this release — see [benchmark-drooms.md](benchmark-drooms.md) G1. Its navigation slot is reserved and deliberately not rendered.

Each of these is called out below where the schema or API is shaped to accept it later.

---

## 2. Decisions taken (and the assumptions behind them)

These are judgement calls made to keep the plan concrete. Each is cheap to reverse now and expensive later — flag any you disagree with before Phase 1 starts.

| # | Decision | Why |
|---|---|---|
| D1 | **No self-serve signup.** Discloser tenants are created by a Veyra operator (seed script / internal admin route). Everyone else arrives by invite. | The pilot is a handful of tenants. Self-serve adds signup, verification, plan selection and abuse handling for zero pilot value. |
| D2 | **PDF is the review format.** Native PDFs are viewed as-is. Office files (docx/xlsx/pptx) are converted to PDF on ingest for viewing; the original stays downloadable if the room allows downloads. Anything else is stored and downloadable but not viewable. | Anchoring highlights across three viewer implementations is three times the work. One canvas, one anchor model. |
| D3 | **Scanned pages are supported for highlighting via rectangle anchors.** Text-quote anchoring when a text layer exists; a drawn region anchor when it doesn't. | Regulatory dossiers are full of scanned certificates and signed forms. A text-only anchor model silently fails on exactly those pages. OCR itself stays deferred. |
| D4 | **Comments anchor to a document *version*, not to a document.** Replacing a file creates v2; threads from v1 are re-anchored to v2 by text-quote match where possible, and otherwise listed as "carried over — position lost". | The discloser is explicitly allowed to edit and re-upload. Without versioned anchors, a re-upload silently orphans or misplaces every comment on the file. |
| D5 | **Comment visibility is per-side by default, with a "share with discloser" toggle.** A recipient reviewer's notes are visible to their own team until deliberately shared. | Reviewers annotate as they read. Publishing every private note to the counterparty in a live negotiation is the wrong default. |
| D6 | **`side` and `capability scope` enums include facilitator and per-document values from day one**, rejected at the validation layer, not the schema. | Turning on the facilitator flow later becomes a guard removal plus UI, not a migration on live deal data. |
| D7 | **Modules are data, not code.** Modules 1–5 are seeded per room from a `module_template`. | Different dossier templates (eCTD sub-sections, non-CTD deals) become a new template row. |
| D8 | **Downloads are a per-room toggle, defaulting off.** | Standard VDR expectation, and it's one boolean now versus a retrofit through every file route later. |
| D10 | **No dossier skeleton.** A room opens with Modules 1–5 and nothing beneath them; structure comes from what people upload. | The reference eCTD tree is 74 sections most deals never fill. An empty named skeleton is scaffolding to delete, not a head start — and folder-name autocomplete gets the naming benefit without imposing shape. |
| D11 | **Veyra provisions tenants completely** — company, domains, tenant, first admin — and the admin arrives on a one-time password, is forced to reset it, and lands in room creation. | If we set the company up, asking the admin to type it back is a form that isn't paying attention. Removed a whole onboarding screen. |
| D12 | **Multi-room from day one.** A person holds participants in many rooms; the app opens on the last one used with a switcher in the navigation. | The model always allowed it and the pilot hits it immediately — a tenant running two deals. Building single-room first would be a rewrite, not a shortcut. |
| D13 | **Dossier and Documents are separate navigation destinations**, backed by one table split on a `section` column. | Six of the reference form's twelve "categories" were already CTD modules. Letting the same content have two homes is what makes a data room unusable. |
| D9 | **Watermarks are burned server-side into the PDF, per viewer, defaulting on** — never drawn as a client-side overlay, and never as extractable text. | An overlay protects nothing: the un-watermarked file has already reached the browser. And a watermark that lands in the text layer corrupts every text-quote anchor on the page (**D4**). |

### Assumed, needs your confirmation

- **Team**: ~2 backend, 2 frontend, 1 design/QA. All timings below scale off that.
- **Upload envelope**: 250 MB per file, ~2,000 files / 5 GB per upload batch. Larger needs a different ingest design.
- **NDA**: click-through acceptance with a stored timestamp and the text version accepted — not a signature workflow, not a counter-signed document.
- **Hosting region**: single region. If pharma counterparties require EU data residency, that changes storage and DB topology and should be settled before Phase 0.

---

## 3. Architecture

The repo already carries `@veyra/design-system` (React 19, antd v6, tokens → theme). The MVP adds two workspaces and reuses it wholesale.

```
veyra/
├─ packages/
│  ├─ design-system/          # exists — extended with annotation colour roles
│  └─ contracts/              # NEW — zod schemas + generated TS types, shared FE/BE
└─ apps/
   ├─ playground/             # exists
   ├─ web/                    # NEW — React 19 + Vite + TanStack Router/Query
   └─ api/                    # NEW — Fastify + TypeScript
```

| Layer | Choice | Note |
|---|---|---|
| API | **Fastify + TypeScript**, zod-validated routes | Small surface, fast, no framework ceremony. Nest is available if the team prefers structure over speed. |
| DB | **PostgreSQL 16** + **Drizzle** migrations | Row-level security per room; `citext` for emails; monthly partitions on the audit table. |
| Storage | **S3-compatible, SSE-KMS**, private buckets, presigned PUT/GET at 5-minute TTL | No object is ever publicly readable. |
| Jobs | **pg-boss** (Postgres-backed queue) | Avoids adding Redis for the pilot. Ingest, conversion, email, digest. |
| Convert | **Gotenberg** (LibreOffice) container | Office → PDF on ingest (D2). |
| Stamp | **pdf-lib** (or qpdf) in a job | Burns the per-viewer watermark into the page content stream as vector outlines (D9). |
| Viewer | **pdf.js** with text layer | Anchors live on the text layer; region anchors on the canvas. |
| Auth | Argon2id, httpOnly + SameSite=Lax session cookie, server-side session table | No JWT — revocation on a live deal room has to be instant. |
| Email | **Resend** (or SES) + React Email templates, sent via the `email_messages` outbox | Outbox table so a provider outage can't lose an invite. |

**Navigation and multi-room.** A user's rooms come from their `room_participants` rows, so the switcher is a query, not a feature — and no route may assume one room (D12). The eight navigation destinations map to: Workspace (the switcher), Overview (query), Documents and Dossier (`room_modules.section`), Q&A (**not built** — slot reserved), Groups (`room_participants`), Activity (`audit_events`), Settings (`rooms`).

**Tenancy model.** Single database, `room_id` on every content row, RLS policies keyed off the session's user. This carries a pilot and well past it; the escape hatch to per-tenant databases stays open because nothing joins across rooms.

---

## 4. Data model

Written to be honest about MVP scope while leaving the V1 doors open. `→` marks a column the MVP writes only one value into.

### Identity

```sql
companies            (id, name, legal_name, primary_domain, created_at)
company_domains      (id, company_id, domain, verified)          -- powers invite fuzzy-match
users                (id, email citext UNIQUE, name, password_hash,
                      status, last_login_at, created_at)
tenants              (id, company_id UNIQUE, plan, status, created_at)
tenant_members       (id, tenant_id, user_id, role)              -- owner | admin | member
sessions             (id, user_id, expires_at, ip, user_agent, revoked_at)
```

### Rooms & participation

```sql
rooms                (id, tenant_id, name, status,
                      creator_side,          -- → 'discloser' | 'recipient' | 'facilitator'
                      discloser_company_id, recipient_company_id,
                      nda_required, nda_version, allow_download,
                      watermark_enabled, watermark_template,
                      created_by, created_at)

room_participants    (id, room_id, user_id, company_id,
                      side,                  -- → 'discloser' | 'recipient' | 'facilitator'
                      role,                  -- admin | contributor | reviewer
                      status,                -- invited | active | revoked
                      invited_by, accepted_at, nda_accepted_at,
                      UNIQUE (room_id, user_id))

participant_capabilities
                     (id, participant_id, capability, allow,
                      scope_type,            -- → 'room' | 'module' | 'folder' | 'document'
                      scope_id)
```

`room_participants` is the whole flexibility story: the same person can be a discloser admin in one room and a recipient reviewer in another, representing different companies. `participant_capabilities` exists in MVP holding only room-scoped rows derived from `role` — the per-document permission tiers deferred to v2 are new rows, not a new table.

### Dossier content

```sql
module_templates     (id, key, name)                             -- 'ctd' → "Common Technical Document"
module_template_nodes(id, template_id, code, title, sort_order)  -- '1'..'5'
room_modules         (id, room_id, code, title, sort_order, source_template_node_id,
                      section)               -- 'dossier' | 'documents'  (D13)

folders              (id, room_id, room_module_id, parent_folder_id,
                      name, path, sort_order, created_by, deleted_at)
documents            (id, room_id, room_module_id, folder_id, name,
                      current_version_id, created_by, deleted_at)
document_versions    (id, document_id, version_no, storage_key, byte_size,
                      checksum_sha256, mime_type, page_count,
                      render_status, rendered_pdf_key, uploaded_by, created_at)
upload_batches       (id, room_id, room_module_id, created_by,
                      status, file_count, bytes_total, started_at, finished_at)
document_renditions  (id, document_version_id, participant_id, storage_key,
                      watermark_text, template_hash, byte_size, created_at,
                      UNIQUE (document_version_id, participant_id))
```

`document_versions` ships in MVP despite redlining being deferred — it is what makes D4 (re-upload without losing comments) possible, and it is the table the v2 accept/reject workflow hangs off.

### Review

```sql
annotations          (id, room_id, document_version_id, author_participant_id,
                      color,                 -- 'amber' | 'blue' | 'rose'
                      anchor_type,           -- 'text_quote' | 'region'
                      anchor jsonb,          -- see below
                      created_at, deleted_at)

comment_threads      (id, room_id, document_version_id, annotation_id NULL,
                      status,                -- open | resolved
                      visibility,            -- 'side' | 'room'
                      created_by, resolved_by, resolved_at,
                      carried_from_version_id NULL, anchor_confidence)

comments             (id, thread_id, author_participant_id, body jsonb,
                      created_at, edited_at, deleted_at)
comment_mentions     (comment_id, participant_id)
```

Three cases fall out of one shape, in one direction — no circular foreign keys:

- highlight with no thread → a private marker
- thread with an `annotation_id` → an inline anchored comment
- thread with `annotation_id NULL` → a document-level comment

**Anchor payload** (borrowed from the W3C annotation model, which is what survives re-flow):

```jsonc
{
  "page": 14,
  "quote": { "exact": "…", "prefix": "…", "suffix": "…" },   // text_quote
  "position": { "start": 48213, "end": 48297 },              // fast path
  "rects": [{ "x": 0.12, "y": 0.44, "w": 0.61, "h": 0.03 }]  // page-relative, always present
}
```

Rects are page-relative fractions so zoom and DPI never move a highlight. For `anchor_type: 'region'` (D3) the rects are the anchor and there is no quote.

### Operations

```sql
invitations          (id, room_id, email citext, company_id, side, role,
                      token_hash, invited_by, status, expires_at,
                      accepted_user_id, sent_at, reminded_at)
email_messages       (id, to_email, template, payload jsonb, status,
                      provider_message_id, attempts, last_error,
                      scheduled_for, sent_at)
notification_prefs   (user_id, room_id, channel, frequency)
audit_events         (id, room_id, actor_user_id, actor_participant_id,
                      action, target_type, target_id, metadata jsonb,
                      ip, user_agent, created_at)                -- append-only, monthly partitions
```

### What "scalable" concretely buys us

| Future feature | Cost given this schema |
|---|---|
| Facilitator rooms | Allow `'facilitator'` past the validator; build the metadata dashboard. **No migration.** |
| Per-document permissions | Insert `participant_capabilities` rows with `scope_type='document'`. **No migration.** |
| Redlining / accept-reject | New `proposed_edits` table against `document_versions`. **No change to existing tables.** |
| A non-CTD dossier template | One `module_templates` row + its nodes. **Data, not code.** |
| A new non-dossier section | One `room_modules` row with `section = 'documents'`. **No migration.** |
| Watermark template changes | Bump `template_hash`; stale renditions fall out of the cache. **No migration.** |
| Recipient-created rooms | `rooms.creator_side = 'recipient'`. **No migration.** |
| Per-tenant DB split | Every content row already carries `room_id`; nothing joins across rooms. |

---

## 5. Flows

### 5.1 Discloser onboarding

1. Operator creates `Company` + `Tenant` + first admin `User` (D1).
2. Admin receives **Activation** email → sets password → account active.
3. Company profile step: legal name, domains (feeds invite matching), logo.
4. Create first room: name, recipient company, NDA on/off, downloads on/off.
5. Room seeds Modules 1–5 from the `ctd` template.
6. **Welcome / onboarded** email fires once the first room exists.

### 5.2 Invite a recipient

1. Discloser admin enters email + role (`admin` / `reviewer`) + company.
2. Company resolution: fuzzy match on `companies.name` + `company_domains.domain`, with the invitee's email domain pre-suggesting a match. Suggestions only — free-text creation requires an explicit "create new company" click.
3. Email check against `users`:
   - **match** → new `room_participant` on the existing login; *"You've been added to a room"* email; no duplicate identity.
   - **no match** → `invitation` row + user shell; *"You've been invited"* email with a set-password link.
4. Invitee sets password (or just signs in) → NDA click-through if `nda_required` → `accepted_at` and `nda_accepted_at` stamped.
5. Lands on room home: Modules 1–5, counts, last activity.
6. Reminder email at 72h if still pending; invite expires at 14 days.

### 5.3 Upload a module

1. Discloser opens Module 3 → **Upload**.
2. Drops a folder. The browser's `webkitdirectory` relative paths reconstruct the tree; the UI previews the tree before anything transfers.
3. `upload_batch` created; per-file presigned PUTs, 5 in parallel, multipart + resumable above 100 MB.
4. Per-file states: queued → uploading → converting → ready / failed. A failed file is retryable without redoing the batch.
5. Background job per file: checksum, MIME sniff, Office→PDF (D2), page count, text-layer extraction.
6. Later edits: add files to a folder, add folders, rename, move, soft-delete, and **replace** a file → new `document_version` (D4).

### 5.4 Review

1. Recipient opens a document; pdf.js renders it with the text layer on.
2. **Select text → colour picker (amber / blue / rose) → highlight, optionally + comment.** Colour is not decorative; it filters. Proposed meanings: **amber = note**, **blue = question for discloser**, **rose = issue / concern**.
3. On a page with no text layer, the same picker appears after dragging a region (D3).
4. Threads: reply, resolve, @mention a participant, toggle side-only ↔ shared (D5).
5. Sidebar filters: colour, status, author, module, "shared with me".
6. Discloser sees shared threads, replies, resolves.
7. Comment/reply notifications batch on a 15-minute window; new-document notifications go out as a daily digest.

### 5.5 Emails in MVP

| # | Trigger | Template |
|---|---|---|
| 1 | Tenant admin created | Activate your Veyra account |
| 2 | First room created | Welcome / getting started |
| 3 | Invite, new user | You've been invited to review *{room}* → set password |
| 4 | Invite, existing user | You've been added to *{room}* → open room |
| 5 | Invite pending 72h | Reminder |
| 6 | Password reset requested | Reset link (15-min TTL) |
| 7 | Password changed | Security notice (no action link) |
| 8 | Comment / reply / mention | Batched 15 min |
| 9 | New documents in your module | Daily digest |

All sent through `email_messages` with retry and a `sent_at` stamp, so an invite is never silently lost.

---

## 6. Screens

Wireframed in [wireframes/](wireframes/) — one `.dc.html` per screen.

| Screen | Notes |
|---|---|
| Sign in | One-time password, labelled as temporary (D11) |
| Choose your password | Forced, unskippable; ends other sessions |
| Create a data room · details | Room name + deal type, with a live preview and the security defaults confirmed |
| Create a data room · invite | Skippable — the room already exists after the previous step |
| Accept invite + NDA click-through | Records the NDA text version accepted, and discloses activity recording (D9, FR-ONB-08a) |
| Overview | Work queue: state, checklist, questions by age, dossier, counterparty reading, recent. No count tiles |
| Dossier | All five modules in one expandable tree; add at any node — new folder / files / folder |
| Dossier — empty module | Teaches the three add routes; nothing is pre-built (D10) |
| Documents | Same tree mechanics, non-CTD sections (D13) |
| Upload drawer | Tree preview, per-file progress, retry failed |
| Document viewer | pdf.js, its own dossier tree, comment rail; renders the viewer's own watermarked rendition. Drops the room navigation — focused mode |
| Groups | People by company, access level inline, pending invites |
| Activity log | Filterable, exportable to CSV |
| Settings · Account | Room settings, org domains, name, password, notifications |

Not wireframed, deliberately: forgot/reset-password and account settings are standard forms with no product decision in them.

**Design-system work required:** three annotation colour roles (`annotationAmber` / `annotationBlue` / `annotationRose`, each with a fill, a border and an on-fill text token) added to `tokens/semantic.ts` and verified in both modes. Highlight fills sit *behind live text* — they must clear 4.5:1 against `colorText` in light and dark, which the existing status ramps do not, having been tuned as tag backgrounds. Budget a contrast pass, then `npm run a11y`.

---

## 7. Phases

Ten weeks, assuming the team in §2. Every phase ends shippable to a staging room.

| Phase | Weeks | Delivers | Done means |
|---|---|---|---|
| **0 · Foundations** | 1 | `apps/api`, `packages/contracts`, Postgres + Drizzle, S3 bucket, pg-boss, CI (typecheck, lint, migrate, test), envs | A seeded DB and a green pipeline on `main` |
| **1 · Identity** | 2–3 | Users, companies, tenants, sessions, login, reset, RLS policies, audit skeleton | An operator-seeded admin can log in; every auth event is in `audit_events` |
| **2 · Rooms, invites, email** | 3–4 | Operator provisioning, one-time password + forced reset, two-step room creation, multi-room switcher, rooms, participants, capabilities, invitations, company resolution, NDA, all 9 templates, outbox + retry | A provisioned admin signs in on a one-time password, resets it, creates a room, and invites a recipient who accepts |
| **3 · Data room** | 5–6 | Modules 1–5 and Documents sections in one expandable tree, add-at-any-node (new folder / files / folder), batch upload, conversion pipeline, rename/move/replace/delete, versions | A 500-file folder uploads into a node four levels deep, converts and browses; replacing a file produces v2 |
| **4 · Review** | 7–8 | pdf.js viewer, per-viewer watermark stamping and rendition cache, text + region anchors, 3-colour highlights, threads, replies, resolve, mentions, visibility toggle, notifications | Recipient highlights and comments; discloser sees shared threads and replies; anchors survive reload, zoom and a re-upload; no un-watermarked bytes reach the browser |
| **4a · Overview** | 8 | The dashboard: room state, setup checklist, questions by age, dossier fill state, counterparty reading activity, recent events | Someone opening the room can tell what needs them without clicking anything |
| **5 · Hardening** | 9 | Permission matrix tests, audit UI + CSV export, download toggle enforcement, session timeout, rate limits, security pass, a11y sweep | Every negative-permission case has a test; axe clean in both themes |
| **6 · Pilot polish** | 10 | Empty states, error states, seed/demo room, operator runbook, load test at the §2 envelope | One real dossier walked end to end by someone outside the team |

Phases 3 and 4 are the two with real unknowns; 0–2 are well-trodden and can compress if the team is fast.

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Large folder upload is the hardest thing here.** Thousands of files, GBs, flaky corporate networks and proxies. | Broken uploads are a first-impression killer for a VDR | Resumable multipart, per-file retry, batch resume on reload; load-test at the §2 envelope in Phase 3, not Phase 6 |
| **Anchors drifting across versions** (D4) | Comments land on the wrong text — worse than losing them | Store quote + position + rects; re-anchor by quote; when confidence is low, mark the thread carried-over rather than guess a position |
| **Scanned pages with no text layer** (D3) | Highlighting silently fails on exactly the pages regulators care about | Region anchors ship in Phase 4, not as a follow-up |
| **Watermark stamping cost** (D9) | One rendition per viewer per version — a 5,000-document room with eight participants is 40,000 stamped files, and a cold first view blocks the reader | Stamp lazily on first view, cache on `(version, participant)`, keep the un-stamped PDF as the render source; measure cold first-page time against the 2 s target in Phase 4 |
| **Office → PDF fidelity** (D2) | Complex xlsx renders badly; recipient reviews a distorted document | Show a "converted for viewing" badge with a link to the original; measure fidelity on real dossier samples in Phase 3 |
| **Highlight contrast in dark mode** | Highlighted text becomes unreadable | Treat the three colours as first-class token roles with a contrast test, per §6 |
| **Comment visibility default is wrong for a pilot user** (D5) | Private review notes leak to the counterparty | Default to side-only, make the shared state visually loud, log every visibility change |

---

## 9. Open questions

1. **Data residency** — one region or EU-resident? Settle before Phase 0; it changes storage and DB topology.
2. **NDA** — is click-through sufficient for the pilot counterparties, or is a counter-signed document required? Click-through is assumed.
3. **Can a recipient admin invite their own teammates**, or does every invite go through the discloser? Assumed: recipient admin can invite within their own side, discloser admin can revoke.
4. **Watermark exemptions** — decided: watermarking is in scope, on by default, and applies to every participant including the discloser's own side (**D9**). Confirm no role needs an exemption.
5. **Highlight colour semantics** — are note / question / issue the right three, and should the discloser be able to rename them per room?
6. **Upload envelope** — confirm the §2 numbers against a real Module 3 dossier before Phase 3.

---

*Living document. Update it as decisions in §2 and §9 are settled, and note the date each one was closed.*
