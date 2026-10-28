# Veyra — Security Review

**Date:** 2026-10-28 · **Revision:** `master` @ `c83df37`
**Scope:** dependencies, secrets in git, live headers, and a code review of auth, access control, uploads and storage.

## Verdict

No evidence of a breach or leaked credentials. Access control in the code is strong. The real risks are a vulnerable PDF renderer, production running dev-grade settings, and unpatched dependencies.

## Findings

| Severity | Finding |
|---|---|
| High | `pdfjs-dist@5.6.205` allows JavaScript execution from a crafted PDF — every document opens through it ([pdf.ts](../apps/web/src/lib/pdf.ts)) |
| High | `MAILER_DRIVER=console` in production logs live reset and invite tokens into Cloud Logging ([mailer.service.ts](../apps/api/src/email/mailer.service.ts)) |
| Medium | Documents land in a GCS bucket mounted through FUSE — durable, but the whole bucket is readable by anyone with its IAM, and any operation beyond whole-file read/write is unsupported ([storage.module.ts](../apps/api/src/storage/storage.module.ts)) |
| High | Unpatched `multer`, `body-parser`, `qs`, and `proxy-addr` (critical 9.1, defeats IP-based rate limiting) |
| Medium | NDA acceptance is enforced only in the UI, not on content endpoints ([room-access.service.ts](../apps/api/src/rooms/room-access.service.ts)) |
| Medium | Production CORS origin is `http://localhost:5173` (dev default) |
| Medium | 250 MB uploads buffered in server memory — memory-exhaustion DoS |
| Medium | Suspended users keep their sessions for up to 12 hours |
| Medium | Uploaded file type is taken from the client, with no signature check |
| Medium | `zod@3.25.76` memory-exhaustion advisory (fix requires v4) |
| Low | No CSP or frame protection on the web app |
| Low | Login timing reveals whether an account exists; lockout can be abused to block a user |
| Low | Company lookup enumerates all companies; rate limiting is per instance; reset has no per-email cap |
| Low | Audit records store email/IP indefinitely with no retention rule |

## Fix first

1. `npm i @nestjs/platform-express@11.2.8 body-parser@^2.4.0 qs@^6.17.0` then `npm audit fix` for `proxy-addr`.
2. Upgrade `pdfjs-dist` to `6.4.299`; set `isEvalSupported: false` in the meantime.
3. Set `MAILER_DRIVER=noop` in production.
4. Enforce NDA acceptance and account suspension server-side.
5. Set `CORS_ORIGIN` to the production domain, and give the documents bucket its own service account rather than sharing the API's.

## What's solid

- Every room resource goes through one access service; refusals return 404 instead of confirming existence.
- Argon2id hashing, tokens stored only as hashes, single-use resets, session revocation, httpOnly `SameSite=Lax` cookies.
- No raw SQL, no HTML injection sinks, path-traversal guard on storage, no secrets anywhere in git history.

## If you suspect a breach

Check Cloud Logging for unexpected successful logins and any logged reset links, the audit table for bursts of `access.denied`, the session table for outliers, and Supabase connection logs.
