# Veyra MVP — Requirements

Development reference. Functional and non-functional requirements only — no schedule, no phasing.

**Scope:** Discloser ⇄ Recipient rooms. Facilitator is accommodated in the data model and rejected at the validation layer.

Requirement IDs are stable. Reference them in branches, PRs and tests.

---

## 1. Terminology

| Term | Meaning |
|---|---|
| **Company** | An organisation record. Exists whether or not it pays for Veyra. |
| **User** | A person, identified by email. One identity across all rooms and companies. |
| **Tenant** | A Company with a Veyra account. Creates rooms. |
| **Room** | One deal workspace. |
| **Side** | `discloser` or `recipient`. (`facilitator` exists in the enum, is not usable.) |
| **Participant** | User + Company + Side + Role, scoped to one room. |
| **Module** | One of the five CTD top-level sections in a room. |
| **Document** | A file in a room, with one or more versions. |
| **Annotation** | A highlight — a coloured anchor on a document version. |
| **Thread** | A comment conversation, optionally attached to an annotation. |

### Roles

Access is **one three-step ladder**, the same on both sides. Each level contains the one below it.

| Level | Grants |
|---|---|
| **Review** | Open documents, highlight, comment. Watermarked, in the browser. |
| **Review + Download** | Everything in Review, plus saving the watermarked copy of a file. Offerable only while the room's `allow_download` is on. |
| **Admin** | Everything above, plus managing files and people on their own side. |

A participant is therefore **side + level**. Side comes from their company (FR-INV-01); level is the only access question the inviter answers.

| Actor | Side | Summary |
|---|---|---|
| Veyra Operator | platform | Creates tenants and their first admin. No access to room content. |
| Admin | discloser | Owns the room: settings, structure, content, invitations on both sides. |
| Admin | recipient | Runs their side's review; invites and revokes within their own side. |
| Review / Review + Download | either | Reads and comments. No structural or people permissions. |

---

## 2. Authentication & accounts

**FR-AUTH-01** — Users authenticate with email and password. No SSO.

**FR-AUTH-02** — There is no public signup route. A User record is created only by (a) a Veyra Operator provisioning a tenant admin, or (b) an invitation to a room.

**FR-AUTH-03** — Passwords are hashed with Argon2id. Minimum 12 characters; the plaintext is never logged, stored or emailed.

**FR-AUTH-04** — Sessions are server-side records referenced by an httpOnly, Secure, SameSite=Lax cookie. No JWT — revocation must take effect on the next request.

**FR-AUTH-05** — A session expires after 30 days absolute, or 8 hours of inactivity.

**FR-AUTH-06** — Password reset is a single-use, 15-minute token delivered by email. Requesting a reset for an unknown address returns the same response as a known one.

**FR-AUTH-07** — Completing a password reset revokes every other active session for that user.

**FR-AUTH-08** — Failed login attempts are rate-limited per IP and per email address. Lockout is temporary, not permanent.

**FR-AUTH-09** — Email addresses are case-insensitive and unique across the platform (`citext`). One person is never two accounts.

---

## 3. Onboarding

### 3.1 Tenant (discloser)

**FR-ONB-01** — A Veyra Operator provisions the tenant: the Company **including its email domains**, the Tenant record, and the first admin User. Internal route or seed script, not a public flow. The admin is never asked to re-enter details the Operator has already set.

**FR-ONB-02** — The admin receives an email containing a **one-time password**. It is single-use, is invalidated the moment it is used to sign in, and expires 72 hours after issue. It is stored hashed like any other credential.

**FR-ONB-03** — Signing in with a one-time password leads directly to a forced password reset. No other route in the application is reachable until a permanent password is set, and the screen states that the temporary password has already been used and no longer works.

**FR-ONB-03a** — Company email domains are set at provisioning and edited in Settings. They feed company matching at invite time (FR-INV-02) and are never collected during onboarding.

**FR-ONB-04** — After the reset the admin is taken straight into room creation, which is **two steps**:
- **Step 1 · Details** — room name (required), deal type, and any non-dossier sections to create. Security settings are shown as a confirmation of their defaults, not asked as questions.
- **Step 2 · People** — invitations, skippable. **The room exists after step 1**, which is what makes step 2 genuinely optional rather than a dead end.

**FR-ONB-05** — Creating a room seeds Modules 1–5 from the active module template, plus any non-dossier sections chosen in step 1.

**FR-ONB-06** — A welcome email is sent once, when the tenant's first room is created.

### 3.2 Guest (recipient)

**FR-ONB-07** — An invitee arriving with a valid token either sets a password (new user) or signs in (existing user).

**FR-ONB-08** — If the room requires an NDA, the invitee cannot reach any content until they accept it. The system stores the acceptance timestamp and the NDA text version accepted.

**FR-ONB-08a** — The acceptance screen states, in plain language and before acceptance, that document activity is recorded: which documents the participant opens, when, and how long they spend, and that this is visible to the disclosing party and to their own side's Admin. The NDA text carries the same as a clause, so it is part of what is accepted.

**FR-ONB-08b** — The disclosure is shown on the acceptance screen whether or not the room's NDA text version contains the clause, and whether or not the room requires an NDA at all. A room with `nda_required` off still shows it at first entry. Recording reading activity is never covert.

**FR-ONB-09** — After acceptance the invitee lands on room home, showing Modules 1–5 with document counts and last activity.

**FR-ONB-10** — An existing Veyra user invited to a new room gets a participant record on their existing login. No duplicate account is ever created.

---

## 4. Companies & invitations

**FR-INV-01** — An inviter supplies an email address, a company, and a permission level. **The invitee's side is derived from their company, never asked as a role.** The room has exactly one discloser company and one recipient company, so a resolved company determines the side; the UI states the consequence ("they'll join on Astrivax's side") rather than asking for it.

**FR-INV-01a** — When the resolved company is neither of the room's two parties — an adviser, a law firm, a CRO — the side cannot be derived. Only then does the UI ask, and it asks by naming the two companies, not the two roles: *"Who are they here with?"* → Corvellis Biopharma (sharing the dossier) or Astrivax Therapeutics (reviewing it).

**FR-INV-01b** — Access is chosen from the three-level ladder — Review, Review + Download, Admin — presented as a stacked list in that order, each level stating what it *adds* to the one above it rather than repeating the whole grant. What Admin means is written out for the derived side ("manage files and people on Astrivax's side"), so the same word never has to mean two unexplained things.

**FR-INV-02** — Company selection is match-and-confirm, not free text. The system suggests matches by fuzzy name comparison and by the invitee's email domain against known company domains. Creating a new Company requires an explicit, separate action.

**FR-INV-03** — On invite, the email is checked against existing Users:
- **match** → a participant record is added to the existing account; an "added to room" email is sent.
- **no match** → an invitation record and user shell are created; an "invited" email with a set-password link is sent.

**FR-INV-04** — Invitation tokens are stored hashed, are single-use, and expire 14 days after issue.

**FR-INV-05** — A reminder email is sent if an invitation is still pending 72 hours after issue. One reminder only.

**FR-INV-06** — An invitation can be revoked before acceptance. A participant can be revoked after acceptance; revocation ends their sessions' access to that room immediately.

**FR-INV-07** — A Recipient Admin may invite and revoke within their own side only. A Discloser Admin may invite and revoke on both sides.

**FR-INV-08** — Re-inviting an address that already has a pending invitation to the same room re-sends the existing invitation rather than creating a second one.

---

## 5. Rooms & permissions

**FR-ROOM-01** — Every room belongs to exactly one Tenant and has a status of `draft`, `active` or `archived`.

**FR-ROOM-02** — A room stores its own `nda_required`, `nda_version`, `allow_download`, `watermark_enabled` and `watermark_template` settings. `allow_download` defaults to off; `watermark_enabled` defaults to on.

**FR-ROOM-03** — All content access is authorised through the requesting user's participant record for that room. A user with no participant record for a room must receive a 404, not a 403 — the existence of a room is itself confidential.

**FR-ROOM-04** — Permissions are evaluated from capability records, not from role strings inline in handlers. Roles map to a default capability set at participant creation.

**FR-ROOM-05** — The MVP capability matrix. Columns are access levels; where a cell depends on side, it says so.

| Capability | Review | Review + Download | Admin |
|---|---|---|---|
| View documents | ✓ | ✓ | ✓ |
| Highlight and comment | ✓ | ✓ | ✓ |
| Share a thread with the other side | ✓ | ✓ | ✓ |
| Resolve a thread | own threads | own threads | own side's threads |
| Download a watermarked file | — | ✓, if the room allows downloads | ✓, if the room allows downloads |
| Create, rename, move, delete folders | — | — | discloser side only |
| Upload, replace, delete files | — | — | discloser side only |
| Invite / revoke participants | — | — | own side; discloser Admin both sides |
| Edit room settings | — | — | discloser side only |
| View room audit log | own actions | own actions | own side; discloser Admin full room |

**FR-ROOM-05a** — Downloading requires **both** the room's `allow_download` setting and a participant level of Review + Download or Admin. The room setting is the ceiling; the level is the grant. Neither alone is sufficient, and both are enforced server-side.

**FR-ROOM-05b** — While `allow_download` is off, Review + Download is not offerable at invite time. The UI shows the level, disabled, with the reason and a route to the room setting — rather than hiding it, which would leave the inviter guessing why a level they were told about is missing.

**FR-ROOM-06a** — A user may hold participant records in any number of rooms, across any number of companies. No screen, route or query may assume a user has exactly one room.

**FR-ROOM-06b** — The application opens on the room the user last used. A switcher at the top of the navigation lists every room they can reach and shows the current one. A separate rooms list exists but is never forced on the way in.

**FR-ROOM-06** — `side = 'facilitator'` and capability `scope_type` values other than `'room'` are rejected by request validation. They exist in the schema and must not be reachable through any API route.

### 5.1 Navigation

**FR-NAV-01** — A room has eight navigation destinations: **Workspace** (the room switcher, FR-ROOM-06b), **Overview**, **Documents**, **Dossier**, **Q&A**, **Groups**, **Activity**, **Settings**.

**FR-NAV-02** — **Dossier** holds the CTD modules. **Documents** holds non-dossier sections — Intellectual Property, Commercial, Legal, Financial — the deal material the CTD does not cover. Both are `room_modules` rows distinguished by a `section` column (`dossier` | `documents`); they are never mixed in one tree, because the same content having two homes is what makes a data room unusable.

**FR-NAV-03** — A destination appears in the navigation only when it is implemented. **Q&A is not in this release**: its slot is reserved in the navigation design and the item is not rendered. A navigation item that leads nowhere is worse than an absent one, for the same reason an inert toggle is (FR-ROOM-05b).

**FR-NAV-04** — The document viewer is a focused mode and does not carry the room navigation. It offers a route back to the room and its own dossier tree (FR-VIEW-07).

---

## 6. Modules, folders & documents

**FR-DOC-01** — A room contains exactly the modules its template defines. For the CTD template that is Modules 1–5. Modules cannot be created, deleted or reordered by users.

**FR-DOC-02** — Module definitions come from `module_templates` / `module_template_nodes`. Adding a different dossier structure must not require a code change.

**FR-DOC-03** — Each module contains a folder tree of arbitrary depth. Folder names are unique among siblings.

**FR-DOC-03a** — The Dossier view presents **every module in one expandable tree** — module → folder → sub-folder → file, to any depth — not one module at a time. Selecting any node shows its contents; folders and files appear in the same listing, since a folder may hold both.

**FR-DOC-04** — Users with the folder capability can create, rename, move and delete folders at any time after the initial upload. Deleting a folder soft-deletes it and everything beneath it.

**FR-DOC-05** — Users with the file capability can add files to any folder, rename them, move them between folders and modules, and soft-delete them, at any time after the initial upload.

**FR-DOC-05a** — Content can be added **at any node in the tree**, not only at a module root, through three distinct actions:
- **New folder** — an empty folder, named on creation
- **Upload files** — one or many files into the selected node
- **Upload folder** — a folder with its nested sub-folders preserved (FR-UPL-01)

All three are reachable from the toolbar and from the selected node. Dropping files or folders directly onto **any row in the tree** adds them there, without navigating to it first.

**FR-DOC-06** — Replacing a file creates a new `document_version`. Previous versions are retained and remain addressable. Nothing is overwritten in object storage.

**FR-DOC-07** — Soft-deleted folders, documents and versions remain in the database and in storage. Deletion is never destructive in the MVP.

**FR-DOC-08** — Every document, folder and version row carries `room_id` directly, so authorisation never requires a join up the tree.

---

## 7. Upload

**FR-UPL-01** — A user can upload a whole folder in one action, into any node of the tree (FR-DOC-05a). The browser's directory-relative paths reconstruct the tree; nested folders are created to match, at any depth.

**FR-UPL-01a** — Uploading loose files is a separate action from uploading a folder, because the two have different outcomes and the user knows which they mean. Both accept multiple selections; only the folder upload creates folders.

**FR-UPL-02** — The upload UI previews the reconstructed tree — folder names, file names, file count, total size — before any bytes transfer, and lets the user cancel.

**FR-UPL-03** — File bytes go directly from browser to object storage via presigned URLs. The API server never proxies file content.

**FR-UPL-04** — Uploads run as a batch with a stable identifier. Per-file state is one of: `queued`, `uploading`, `converting`, `ready`, `failed`.

**FR-UPL-05** — A failed file can be retried individually, without re-uploading the rest of the batch.

**FR-UPL-06** — Closing or reloading the page mid-batch must not lose batch state. On return, completed files are still complete and incomplete files are resumable.

**FR-UPL-07** — Files above 100 MB use multipart upload and are resumable within a file.

**FR-UPL-08** — Per-file limit 250 MB. Per-batch limit 2,000 files or 5 GB. Both are configuration values, not constants in application code.

**FR-UPL-09** — On ingest, each file is processed: SHA-256 checksum, MIME sniffing from content (not the filename), page count, text-layer extraction.

**FR-UPL-10** — Office documents (docx, xlsx, pptx) are converted to PDF for viewing. The original is retained and is what a download returns.

**FR-UPL-11** — A file whose type cannot be rendered is stored and listed, marked not viewable, and downloadable if the room permits downloads and watermarking is off (FR-WM-09).

**FR-UPL-12** — Ingest failures surface to the uploading user with a reason. A file that fails conversion is still stored and downloadable.

---

## 8. Viewer

**FR-VIEW-01** — Documents render in-browser as PDF, with a selectable text layer where one exists.

**FR-VIEW-02** — The viewer supports page navigation, jump-to-page, and zoom.

**FR-VIEW-03** — Documents are served through short-lived presigned URLs (5-minute TTL). No storage object is publicly readable, and no URL is reusable after expiry. When watermarking is on, the presigned URL addresses the viewer's own watermarked rendition (FR-WM-07), never the stored original.

**FR-VIEW-04** — The download control appears only when the room allows downloads *and* the viewer's level includes them (FR-ROOM-05a). The download route independently rejects a request failing either test. UI-only enforcement is not acceptable.

**FR-VIEW-05** — A document converted for viewing displays an indicator distinguishing the rendered PDF from the original file.

**FR-VIEW-06** — The viewer indicates which version is being viewed, and allows viewing an earlier version.

**FR-VIEW-07** — The viewer carries a collapsible dossier tree spanning **all modules**, collapsed except the path to the open file, so a reviewer can cross from one module to another without leaving the page. It shows the folder structure, the files in each folder, the file currently open, and each file's open-thread count. Selecting a file opens it in place. Both the tree and the comment rail collapse independently, and their collapsed state persists per user.

### 8.1 Watermarking

**FR-WM-01** — When `watermark_enabled` is on, every page any participant views, prints or downloads carries a watermark identifying that participant.

**FR-WM-02** — The watermark is applied server-side. While watermarking is on, the browser never receives un-watermarked bytes of a document. A CSS or canvas overlay drawn in the viewer is not an acceptable implementation — it protects nothing, because the underlying file has already been delivered.

**FR-WM-03** — The watermark is burned into the PDF page content stream. It must not be a PDF annotation, an optional content group, or a separate layer, so that it cannot be removed by toggling a viewer setting or by stripping annotations with a standard PDF tool.

**FR-WM-04** — The watermark is drawn as vector outlines or an image XObject, never as extractable text. Text extraction (FR-UPL-09) and text-quote anchoring (FR-ANN-04) must return byte-identical results with watermarking on and off. A watermark that lands in the text layer corrupts every anchor on the page.

**FR-WM-05** — Default watermark content: recipient name, email, company, room name, and the UTC timestamp of the render. `watermark_template` is configurable per room from a fixed token set — `{name}`, `{email}`, `{company}`, `{room}`, `{date}`, `{time}`, `{ip}`. Free-form text outside these tokens is permitted; arbitrary markup is not.

**FR-WM-06** — Appearance: repeated diagonal tiling across the full page, composited above document content at low opacity — above, so it cannot be hidden behind an opaque image; low, so the dossier text underneath stays legible. Opacity, angle and tile density are deployment configuration, not per-room UI.

**FR-WM-07** — Every rendition is personalised per participant. A rendition is cached keyed by `(document_version_id, participant_id)`, and invalidated when a new version is created, the participant is revoked, or the room's watermark settings change.

**FR-WM-08** — When watermarking is on and downloads are allowed, a download returns the watermarked PDF rendition. The un-watermarked original is not downloadable by any participant, on any route.

**FR-WM-09** — Files that cannot be rendered to PDF (FR-UPL-11) cannot be watermarked. When watermarking is on they are listed, marked not downloadable, and the download route rejects them.

**FR-WM-10** — Printing from the viewer carries the watermark, with no additional implementation — it is part of the page content by FR-WM-03.

**FR-WM-11** — Watermarking applies to every participant, including the discloser's own side. There is no exempt role.

**FR-WM-12** — Each watermarked view and download records in the audit log the participant, the document version, and the exact watermark identity string applied — so a leaked page can be traced back to one rendition and one person.

**FR-WM-13** — Changing `watermark_enabled` or `watermark_template` invalidates every cached rendition for that room and is recorded in the audit log.

**FR-WM-14** — Stamping happens once per document version per participant. First-page render for a watermarked document still meets NFR-PERF-03; subsequent pages are served from the cached rendition.

---

## 9. Highlights & comments

**FR-ANN-01** — Selecting text in the viewer offers three highlight colours:

| Colour | Meaning |
|---|---|
| Amber | Note — something to return to; no action implied for the other side |
| Blue | Question — needs an answer from the discloser |
| Rose | Issue — a gap or concern in the dossier |

**FR-ANN-02** — A highlight can be created on its own, or together with a comment.

**FR-ANN-03** — On a page with no text layer, the user drags a rectangular region and gets the same colour choice. Region anchoring is a first-class path, not a degraded fallback.

**FR-ANN-04** — An anchor stores, together: page number, quoted text with leading and trailing context, character positions, and page-relative rectangles. Rectangles are stored as fractions of page dimensions so zoom and display density never move a highlight.

**FR-ANN-05** — Annotations attach to a **document version**, not a document.

**FR-ANN-06** — When a document gains a new version, threads from the previous version are re-anchored by quote match. A thread that re-anchors is shown in place; one that cannot is listed as carried over with its position marked lost. A thread is never silently dropped, and never guessed into a wrong position.

**FR-ANN-07** — A comment thread is either anchored to an annotation, or attached to the document as a whole. Both are supported.

**FR-ANN-08** — Threads support replies, resolve/reopen, and @mentions of participants in the same room.

**FR-ANN-09** — Threads default to `side` visibility — visible only to participants on the author's side. An explicit action changes visibility to `room`.

**FR-ANN-10** — Changing thread visibility is irreversible in the MVP and is recorded in the audit log.

**FR-ANN-11** — The comment sidebar filters by colour, thread status, author, module, and shared/not-shared.

**FR-ANN-12** — An author can edit or delete their own comment. Deletion is soft; the thread structure is preserved.

**FR-ANN-13** — Highlights and threads persist across reload, zoom change and re-anchoring, and render at the same visual position.

---

## 10. Notifications & email

**FR-MAIL-01** — All outbound email is written to an outbox record before sending, with status, attempt count and last error. A provider outage must not lose a message.

**FR-MAIL-02** — Failed sends retry with backoff. A permanently failed invitation is visible to the inviter in the UI.

**FR-MAIL-03** — Required templates:

| # | Trigger | Template |
|---|---|---|
| 1 | Tenant admin provisioned | Activate your account |
| 2 | Tenant's first room created | Welcome / getting started |
| 3 | Invitation, new user | Invited to review *{room}* — set password |
| 4 | Invitation, existing user | Added to *{room}* — open room |
| 5 | Invitation pending 72h | Reminder |
| 6 | Password reset requested | Reset link (15-minute TTL) |
| 7 | Password changed | Security notice, no action link |
| 8 | Comment, reply or mention | Activity notification |
| 9 | New documents in an accessible module | Digest |

**FR-MAIL-04** — Comment notifications batch over a 15-minute window. A burst of replies produces one email, not one per reply.

**FR-MAIL-05** — Document notifications are a daily digest.

**FR-MAIL-06** — A user is never notified about their own action.

**FR-MAIL-07** — Notification emails carry no document content and no comment body beyond a short excerpt — the room and document names, and a link.

**FR-MAIL-08** — Users can set notification frequency per room: immediate (batched), daily, or off. Security emails (6, 7) are not suppressible.

---

## 10.1 Overview

**FR-DASH-01** — Overview is the room's landing screen. It answers **what needs this viewer next**. It is a work queue, not a status report.

**FR-DASH-02** — It carries, in this order: the room's state (status, counterparty, deal type, and the three security settings); the setup checklist while any item is outstanding; open questions awaiting the viewer's side; the dossier module list; and recent events.

**FR-DASH-03** — Open questions are ordered by **age**, and each shows its colour, its location in the dossier, and its discipline tag. Age is what creates urgency; a count does not.

**FR-DASH-04** — Overview carries **no aggregate-count tiles**. Totals such as file count or user count are not actionable and do not earn space.

**FR-DASH-05** — Content is scoped to the viewer's side and level. A discloser Admin additionally sees counterparty reading activity by section, subject to the disclosure in FR-ONB-08a and the visibility rules in FR-AUD-07. A Review-level participant sees their own open threads and what is new since their last visit.

**FR-DASH-06** — Empty modules on Overview offer an inline action to add content, since nothing is pre-built (FR-DOC-01).

---

## 11. Audit

**FR-AUD-01** — The audit log is append-only. There is no update or delete path, in code or in database grants.

**FR-AUD-02** — Each entry records: room, actor user, actor participant, action, target type, target id, structured metadata, IP address, user agent, timestamp.

**FR-AUD-03** — Logged actions cover, at minimum: login, logout, failed login, password change, invitation sent, invitation accepted, participant revoked, NDA accepted, room settings changed, folder created/renamed/moved/deleted, file uploaded/replaced/renamed/moved/deleted, document viewed, document downloaded, annotation created/deleted, thread created, comment posted, thread resolved, thread visibility changed, watermark settings changed.

**FR-AUD-04** — Audit visibility follows FR-ROOM-05.

**FR-AUD-05** — The log is filterable by actor, action type, module, document and date range, and exportable to CSV.

**FR-AUD-06** — The table is partitioned by month from the outset.

**FR-AUD-07** — Reading activity derived from the log — documents opened, and time spent per section — is surfaced to Discloser Admins as room-level activity, and to a participant's own side Admin for their own people. It is disclosed to every participant under FR-ONB-08a, and the viewer carries a standing indicator that activity is recorded. No participant is ever shown another side's reading activity without that disclosure having been made.

---

## 12. Data model requirements

**FR-DATA-01** — Every content-bearing row carries `room_id`. Row-level security policies key off the requesting user's participant records.

**FR-DATA-02** — No query joins across rooms. This keeps a per-tenant database split available without application rewrites.

**FR-DATA-03** — Enums include values the MVP does not use, so later features are configuration rather than migration:
- `side`: `discloser`, `recipient`, `facilitator`
- `rooms.creator_side`: same three values
- `participant_capabilities.scope_type`: `room`, `module`, `folder`, `document`

**FR-DATA-04** — `participant_capabilities` exists in the MVP, holding only `scope_type = 'room'` rows. Per-document permissions must be new rows, not a new table.

**FR-DATA-05** — `document_versions` exists in the MVP, even though redlining does not. It carries FR-DOC-06 and FR-ANN-05/06.

**FR-DATA-06** — A comment thread references an annotation; an annotation does not reference a thread. No circular foreign keys.

**FR-DATA-07** — Room membership, room content and audit entries are never hard-deleted by an application code path.

---

## 13. Non-functional requirements

### Security

**NFR-SEC-01** — All object storage is private, encrypted at rest with managed keys. No bucket, prefix or object is publicly readable.

**NFR-SEC-02** — All traffic is TLS. HSTS is enabled.

**NFR-SEC-03** — Authorisation is enforced server-side on every route. Hiding a control in the UI is never the enforcement mechanism.

**NFR-SEC-04** — All request bodies, query parameters and route parameters are schema-validated before use.

**NFR-SEC-05** — Uploaded content is served with `Content-Disposition: attachment` and a restrictive `Content-Security-Policy`; it is never rendered in the application's own origin.

**NFR-SEC-06** — Secrets come from the environment. No credential, key or token is committed.

**NFR-SEC-07** — Application logs never contain passwords, tokens, presigned URLs or document content.

### Performance

**NFR-PERF-01** — Overview and the Dossier tree respond within 500 ms at p95 for a room with 5,000 documents. The tree loads lazily per node; expanding a module never fetches the whole dossier.

**NFR-PERF-02** — The document list is paginated and indexed. No unbounded query is exposed through an API route.

**NFR-PERF-03** — First page of a document renders within 2 s at p95 on a 10 Mbit connection.

**NFR-PERF-04** — Annotations for a document version load in one request and render without a visible reflow of the page.

**NFR-PERF-05** — Upload runs at least 5 files concurrently and saturates available bandwidth on a batch of small files.

### Frontend

**NFR-FE-01** — The web app consumes `@veyra/design-system`. Component styling comes from theme tokens; no hardcoded hex values in application code.

**NFR-FE-02** — Highlight colours are added as semantic token roles (fill, border, on-fill text) in `tokens/semantic.ts`, resolved per mode. They are not literals in the viewer.

**NFR-FE-03** — Highlight fills sit behind live text and must clear WCAG AA (4.5:1) against body text in both light and dark modes. The existing status ramps are tuned as tag backgrounds and do not satisfy this.

**NFR-FE-04** — `npm run a11y` passes with zero violations in both themes, including the new viewer and annotation surfaces.

**NFR-FE-05** — Keyboard operation covers navigation, document viewing, and creating and replying to comments. Every interactive element has a visible focus state.

**NFR-FE-06** — Supported browsers: current and previous major versions of Chrome, Edge, Safari and Firefox. Folder upload requires directory-picker support; browsers without it get file-level upload and a clear message.

### Operational

**NFR-OPS-01** — Database schema changes are versioned migrations. No manual schema edits in any environment.

**NFR-OPS-02** — Type checking, linting, migrations and tests run in CI on every pull request.

**NFR-OPS-03** — Request and job failures are logged with a correlation id that ties an API request to the background jobs it spawned.

**NFR-OPS-04** — Contracts (request/response schemas) are shared between frontend and backend from one source. Types are not hand-mirrored.

---

## 14. Out of scope

Not built, and no partial implementation:

Facilitator rooms · redlining and proposed edits · accept/reject workflow · version diffing · self-serve signup · billing · SSO · OCR · full-text search · AI features · per-document permission tiers · tenant deactivation · hard deletion.

---

## 15. To be confirmed

These carry a working assumption so development is not blocked. Confirm before the affected area is built.

| Item | Working assumption | Affects |
|---|---|---|
| Data residency | Single region | Storage and database topology — confirm first |
| NDA form | Click-through with stored timestamp and text version | FR-ONB-08 |
| Recipient self-invite | Recipient Admin may invite within their own side | FR-INV-07 |
| Watermark exemptions | No role is exempt — the discloser's own side is watermarked too | FR-WM-11 |
| Watermark default | On for every new room | FR-ROOM-02 |
| Highlight semantics | Note / Question / Issue, fixed per platform | FR-ANN-01 |
| Upload envelope | 250 MB per file, 2,000 files or 5 GB per batch | FR-UPL-08 |
