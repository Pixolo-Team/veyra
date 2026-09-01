# Veyra — Product Requirements Document

**Release:** MVP · **Scope:** Discloser ⇄ Recipient rooms · **Status:** Draft for sign-off

| | |
|---|---|
| **Product** | Veyra — a virtual data room for pharma dossier sharing and review |
| **This release** | Direct deals only: one discloser shares a CTD dossier, one recipient team reviews it |
| **Companion documents** | [requirements.md](requirements.md) — testable spec, `FR-`/`NFR-` IDs · [mvp-plan.md](mvp-plan.md) — architecture, phasing, risks |
| **Traceability** | Every feature below links to the requirement IDs that specify it |

---

## 1. Problem

Pharma companies share regulatory dossiers with counterparties during out-licensing, co-development and M&A due diligence. The dossier is the most commercially sensitive asset the company owns, and the review is the step that decides the deal.

Today that review happens in generic virtual data rooms built for finance, or worse, over email and shared drives. Three things break:

**Structure is lost.** A CTD dossier has a defined shape — Modules 1 through 5. Generic VDRs treat it as an unstructured folder dump, so a reviewer looking for the clinical module has to go find it.

**Review has nowhere to live.** Reviewers read PDFs and write their findings somewhere else — a spreadsheet, an email thread, a Word document. The comment is separated from the page it refers to, so answering it means reconstructing the context by hand.

**Control is coarse.** Either the counterparty can download everything, or they can see nothing. There is no per-viewer traceability if a page leaks.

## 2. Goals

| # | Goal | How we know |
|---|---|---|
| G1 | A discloser can stand up a structured, populated data room without help | Time from account activation to first module fully uploaded |
| G2 | A recipient reviews entirely inside Veyra — no downloading, no side-channel notes | Share of review comments created in-app vs. reported elsewhere |
| G3 | Every comment is anchored to the exact place it refers to | Share of threads that carry a page anchor |
| G4 | Sensitive content is traceable to a single viewer | Every rendered page carries a per-viewer watermark |
| G5 | Nothing that happens in a room is unaccounted for | Every listed action appears in the audit log |

### Non-goals for this release

Veyra is not becoming a document editor, a contract negotiation tool, or a regulatory submission system in this release. It is not multi-party — one discloser, one recipient. It is not self-serve — tenants are onboarded by hand.

## 3. Success criteria

The MVP succeeds if one real dossier goes end to end with a real counterparty:

- A discloser uploads a complete Module 3 without contacting support
- Upload completes with no permanent file failures
- A recipient team of at least three people reviews and leaves anchored comments
- The discloser answers those comments in Veyra rather than by email
- Zero unauthorised access incidents
- Zero comments lost or mispositioned when a document is replaced

## 4. Users

| Role | Side | What they are trying to do |
|---|---|---|
| **Veyra Operator** | Platform | Onboard a new tenant. Never sees room content. |
| **Discloser Admin** | Discloser | Set up the room, load the dossier, control who sees it, answer questions. |
| **Discloser Contributor** | Discloser | Upload and organise content. Cannot change settings or invite. |
| **Recipient Admin** | Recipient | Run their side's review. Bring their own team in. |
| **Recipient Reviewer** | Recipient | Read, question, flag. |

## 5. Core journeys

**Discloser** — Operator provisions the tenant → admin activates and sets a password → completes company profile → creates a room and picks settings → room seeds Modules 1–5 → drops a folder into Module 3 → invites the recipient team → answers questions as they arrive.

**Recipient** — Receives an invitation → sets a password or signs in → accepts the NDA → lands on room home showing five modules → opens a document → reads it watermarked in-browser → highlights a passage in blue and asks a question → shares the thread with the discloser → gets a notification when it's answered.

---

# Features

Priority: **P0** blocks launch · **P1** ships in the release but can slip to last.

---

## E1 · Access & identity

### F-01 Email and password sign-in
**As** any participant, **I want** to sign in with an email and password **so that** I can reach my rooms without an enterprise SSO setup.
**Priority** P0 · **Spec** FR-AUTH-01, 03, 08, 09

- Sign-in with email and password; no SSO in this release
- Email is case-insensitive and unique platform-wide — one person is never two accounts
- Repeated failures are rate-limited per IP and per address, with temporary lockout
- Passwords are never logged, stored in plaintext, or included in any email

### F-02 Password reset
**As** a user who has forgotten my password, **I want** to reset it by email **so that** I am not locked out of a live deal.
**Priority** P0 · **Spec** FR-AUTH-06, 07

- Reset link is single-use and expires in 15 minutes
- Requesting a reset for an unknown address returns the same response as a known one — the form cannot be used to discover who has an account
- Completing a reset ends every other active session

### F-03 Session handling and instant revocation
**As** a discloser admin, **I want** removing someone to take effect immediately **so that** revoking access during a deal is not delayed by a token lifetime.
**Priority** P0 · **Spec** FR-AUTH-04, 05, FR-INV-06

- Sessions are server-side records, not self-contained tokens
- Revoking a participant ends their access on their next request
- Sessions expire after 30 days absolute or 8 hours idle

### F-04 No public signup
**As** the business, **I want** accounts to exist only by provisioning or invitation **so that** nobody self-registers into a platform that hosts confidential dossiers.
**Priority** P0 · **Spec** FR-AUTH-02

---

## E2 · Onboarding

### F-05 Tenant provisioning
**As** a Veyra Operator, **I want** to set a customer up completely **so that** their admin has nothing to fill in before they can work.
**Priority** P0 · **Spec** FR-ONB-01, 02, 03a

- Internal route or seed script creates the Company **including its email domains**, the Tenant, and the first admin User
- Because domains are set here, the admin is never asked for them — they are edited in Settings if they change
- The Operator never gains access to room content

### F-06 First sign-in
**As** a new admin, **I want** to get in and start working **so that** my first session isn't a form about my own company.
**Priority** P0 · **Spec** FR-ONB-02, 03

- The invitation carries a **one-time password**: single-use, dead the moment it signs you in, expired after 72 hours
- Signing in leads straight to a forced password reset — nothing else is reachable first, and the screen says the temporary password has already been used
- From the reset, straight into creating a room. No company-profile step exists

### F-07 Guest acceptance
**As** an invited reviewer, **I want** a single link that gets me into the room **so that** I am not filling in a registration form to read one dossier.
**Priority** P0 · **Spec** FR-ONB-07, 09, 10

- New user sets a password; existing Veyra user simply signs in
- An existing user gets a participant record on their current login — never a second account
- Lands on room home with all five modules, document counts and last activity

### F-08 NDA click-through
**As** a discloser admin, **I want** every guest to accept an NDA before seeing anything **so that** disclosure is on the record.
**Priority** P0 · **Spec** FR-ONB-04, 08

- Per-room setting; when on, no content is reachable until accepted
- Stores the acceptance timestamp and the exact NDA text version accepted
- **States before acceptance that reading activity is recorded** — which documents, when, how long — and that the disclosing party can see it. The same appears as a clause in the NDA text, and the viewer carries a standing indicator
- Shown even when the room does not require an NDA: recording who read what is never covert
- Click-through only in this release — not a signature workflow

---

## E3 · Companies, invitations and access control

### F-09 Company directory with match-and-confirm
**As** an inviter, **I want** to pick the invitee's company from real records **so that** the same company doesn't accumulate five spellings across deals.
**Priority** P0 · **Spec** FR-INV-01, 02

- Fuzzy match on company name plus the invitee's email domain against known domains
- Suggestions only — free-text entry is not accepted
- Creating a new Company is a deliberate, separate action

### F-10 Invitations
**As** a discloser admin, **I want** to invite reviewers by email **so that** the counterparty team can start work.
**Priority** P0 · **Spec** FR-INV-01, 01a, 01b, 03, 04, 05, 08

- **The inviter picks a company, not a role.** A room has one discloser company and one recipient company, so the side follows from the company — the form states it as a consequence rather than asking for it. "Discloser" and "Recipient" are our vocabulary, not the inviter's
- The side is only asked when the company is neither party — an adviser or law firm — and even then it asks by company name, not by role
- Permission choices read as plain sentences scoped to that side ("Read and comment"), not as internal role names
- Existing users are added directly and told so; new users get a set-password invitation
- Tokens are stored hashed, single-use, expire after 14 days
- One reminder at 72 hours if still pending
- Re-inviting a pending address re-sends the existing invitation rather than creating a duplicate

### F-11 Participant management
**As** an admin, **I want** to see who is in the room and remove people **so that** access matches the current deal team.
**Priority** P0 · **Spec** FR-INV-06, 07

- Discloser Admin manages both sides; Recipient Admin manages their own side only
- Revocation is immediate (F-03)
- Pending invitations can be revoked before acceptance

### F-12 Role-based permissions
**As** the business, **I want** capabilities derived from role, evaluated server-side **so that** a hidden button is never the thing protecting a document.
**Priority** P0 · **Spec** FR-ROOM-03, 04, 05, 06, NFR-SEC-03

- **One three-step access ladder, the same on both sides:** Review · Review + Download · Admin. Each level contains the one below, so the invite form states what each *adds* rather than restating the whole grant
- A participant is side + level. Side comes from their company (F-10); level is the only access question anyone answers
- Downloading needs the room setting *and* the level — the room is the ceiling, the level is the grant
- Capability records, not role strings scattered through handlers
- A user with no participant record for a room receives a 404, not a 403 — the room's existence is itself confidential
- Facilitator and per-document scopes exist in the data model and are rejected by validation

---

## E3a · Navigation

### F-12a Room navigation
**As** any participant, **I want** the room's parts named the way I think about them **so that** I'm not learning our data model to find a file.
**Priority** P0 · **Spec** FR-NAV-01 … 04

- Eight destinations: **Workspace** (switcher) · **Overview** · **Documents** · **Dossier** · **Q&A** · **Groups** · **Activity** · **Settings**
- **Dossier** is the CTD modules. **Documents** is everything the CTD doesn't cover — IP, Commercial, Legal, Financial. Both are module rows split by a `section` column, so the same content never has two homes
- **Q&A is not in this release** and is therefore not rendered. Its slot is reserved in the design. A navigation item that leads nowhere is worse than an absent one
- The viewer is a focused mode and drops the navigation entirely

---

## E4 · Rooms

### F-13 Room creation
**As** a discloser admin, **I want** a room to exist before I have to think about people **so that** I can load the dossier first and invite once it's worth looking at.
**Priority** P0 · **Spec** FR-ONB-04, 05, FR-ROOM-01

Two steps, and the room exists after the first:

- **Step 1 · Details** — room name, deal type, and any non-dossier sections. Security settings are *confirmed*, not asked: watermarking on, NDA on, downloads off, audit always on
- **Step 2 · People** — invitations, skippable outright
- Seeds Modules 1–5, plus any non-dossier sections chosen
- Status is draft, active or archived; no counterparty keeps it draft

### F-13a Working across rooms
**As** someone on more than one deal, **I want** to move between rooms without going back to a list **so that** switching costs one click.
**Priority** P0 · **Spec** FR-ROOM-06a, 06b

- A person holds participant records in any number of rooms, across any number of companies — the data model has always allowed it and the pilot will hit it immediately
- The app opens on the room last used; the **Workspace** switcher at the top of the navigation moves between them
- No screen assumes a single room

### F-14 Room settings
**As** a discloser admin, **I want** to control disclosure behaviour per room **so that** each deal can carry its own risk posture.
**Priority** P0 · **Spec** FR-ROOM-02

| Setting | Default |
|---|---|
| NDA required | On |
| Downloads allowed | **Off** |
| Watermarking | **On** |
| Watermark template | Name, email, company, room, timestamp |

### F-15 Overview
**As** anyone opening the room, **I want** to see what needs me **so that** I can start working instead of orienting.
**Priority** P0 · **Spec** FR-DASH-01 … 06, FR-ONB-09

Overview answers *what needs this viewer next*. It is a work queue, not a status report.

- **Room state** — status, counterparty, deal type, and the three security settings
- **Setup checklist** — while anything is outstanding, then it disappears
- **Waiting on you** — open questions **ordered by age**, each with its colour, its place in the dossier and its discipline. Age is what creates urgency; a count doesn't
- **Dossier** — the five modules with their fill state; empty ones offer an inline add
- **Where the counterparty is reading** — time by section, for discloser Admins only, and disclosed to the other side under F-08
- **Recent** — the last few events, including invitations nobody has accepted
- **No aggregate-count tiles.** Nobody has ever acted on "512 files"

---

## E5 · Dossier structure

### F-16 The dossier as one tree
**As** a reviewer, **I want** the whole dossier in a single expandable tree **so that** I can move between modules without switching context.
**Priority** P0 · **Spec** FR-DOC-01, 02, 03a

- Every room carries exactly the five CTD modules; users cannot create, delete or reorder them
- **All five are expandable in one tree** — module → folder → sub-folder → file, to any depth. Not one module at a time
- Selecting any node shows its contents, with folders and files in the same listing
- Module definitions come from a template — a different dossier structure is data, not a release
- Nothing beneath the modules is pre-built; the shape comes from what people add (F-17, F-18)

### F-17 Folder management
**As** a discloser contributor, **I want** to restructure folders after the initial upload **so that** the room can be reorganised as the deal develops.
**Priority** P0 · **Spec** FR-DOC-03, 04

- Arbitrary-depth tree per module; sibling names unique
- Create, rename, move, delete at any time
- Deleting a folder soft-deletes everything beneath it

### F-18 File management
**As** a discloser contributor, **I want** to add and move files after the initial upload **so that** the room stays current without a re-upload.
**Priority** P0 · **Spec** FR-DOC-05, 07

- Add, rename, move between folders and modules, soft-delete
- Nothing is hard-deleted in this release

### F-18a Adding content anywhere
**As** a discloser contributor, **I want** to add things wherever they belong **so that** I'm not forced through one bulk upload at the top of a module.
**Priority** P0 · **Spec** FR-DOC-05a, FR-UPL-01, 01a

Three distinct actions, available at **any node in the tree** — not only at a module root:

| | |
|---|---|
| **New folder** | Empty, named on creation |
| **Upload files** | One or many, straight into the selected node |
| **Upload folder** | Keeps every sub-folder, at any depth |

- Files and folders are separate actions because the outcomes differ and the user knows which they mean
- **Dropping onto any row in the tree** puts content there without navigating to it first

### F-19 File versioning
**As** a discloser admin, **I want** replacing a file to create a version **so that** comments made on the old file are not lost.
**Priority** P0 · **Spec** FR-DOC-06, FR-DATA-05

- Replacing a file creates a new version; earlier versions remain addressable
- Nothing is overwritten in storage
- This is what makes F-33 (anchor durability) possible

---

## E6 · Getting content in

### F-20 Folder upload
**As** a discloser contributor, **I want** to drop an entire module folder in one action **so that** I am not uploading two thousand files by hand.
**Priority** P0 · **Spec** FR-UPL-01, 02, 03

- Directory-relative paths reconstruct the folder tree, nested folders created to match
- The tree is previewed — names, file count, total size — before any bytes move, with a cancel
- Bytes go browser → storage directly via presigned URLs; the API never proxies file content

### F-21 Upload resilience
**As** a discloser contributor uploading gigabytes over a corporate network, **I want** failures to be recoverable **so that** one dropped file doesn't cost me the whole batch.
**Priority** P0 · **Spec** FR-UPL-04, 05, 06, 07, 08

- Per-file state: queued, uploading, converting, ready, failed
- Any single failed file retries on its own
- Reloading mid-batch does not lose progress; incomplete files resume
- Files over 100 MB use resumable multipart
- Limits are configuration: 250 MB per file, 2,000 files or 5 GB per batch

### F-22 Ingest processing and conversion
**As** a reviewer, **I want** Office documents to be readable in the browser **so that** I am not downloading a spreadsheet to answer one question.
**Priority** P0 · **Spec** FR-UPL-09, 10, 11, 12

- Per file: SHA-256 checksum, MIME sniffed from content not filename, page count, text-layer extraction
- docx / xlsx / pptx convert to PDF for viewing; the original is retained
- Unrenderable types are stored, listed, marked not viewable
- Failures surface to the uploader with a reason; a file that fails conversion is still stored

---

## E7 · Viewing

### F-23 In-browser document viewer
**As** a reviewer, **I want** to read documents in Veyra **so that** confidential material never lands on my laptop.
**Priority** P0 · **Spec** FR-VIEW-01, 02, 05

- PDF rendering with a selectable text layer where one exists
- Page navigation, jump-to-page, zoom
- A collapsible folder tree beside the document, showing the current module's structure, the open file, and each file's open-thread count — so navigating the dossier never means leaving the page
- A converted document is marked as such, distinguishing the rendition from the original

### F-24 Per-viewer watermarking
**As** a discloser admin, **I want** every page to carry the identity of whoever is looking at it **so that** a leaked page traces back to one person.
**Priority** P0 · **Spec** FR-WM-01 … FR-WM-14

- On by default for every new room
- **Applied server-side.** While watermarking is on, the browser never receives un-watermarked bytes. A viewer overlay is explicitly not acceptable — it protects nothing, because the clean file has already been delivered
- **Burned into the page content stream** — not an annotation, not an optional content group, so it survives a standard PDF tool
- **Drawn as vector outlines, never as text** — a text watermark would land in the extracted text layer and corrupt every anchor on the page (F-33)
- Default content: name, email, company, room, UTC timestamp. Template configurable per room from a fixed token set
- Tiled diagonally above content at low opacity — above, so it cannot hide behind an opaque image; low, so the dossier stays readable
- One rendition per viewer per version, cached and invalidated on new version, revocation, or settings change
- No role is exempt, including the discloser's own side
- Every view and download records the exact identity string applied

### F-25 Download control
**As** a discloser admin, **I want** downloads off by default **so that** content leaves the room only when I decide it should.
**Priority** P0 · **Spec** FR-VIEW-03, 04, FR-WM-08, 09

- `allow_download` defaults to off; the route rejects the request, not just the UI
- The room setting is a ceiling, not a grant: a viewer also needs Review + Download or Admin (F-12). While the room has downloads off, that level shows disabled at invite time with the reason, rather than vanishing
- Documents are served via 5-minute presigned URLs, never a public object
- When watermarking is on, a download returns the watermarked rendition — the clean original is unreachable on any route
- Files that cannot be rendered cannot be watermarked, and so are not downloadable while watermarking is on

### F-26 Version viewing
**As** a reviewer, **I want** to see which version I'm reading and open an earlier one **so that** I can check what changed since my comment.
**Priority** P1 · **Spec** FR-VIEW-06

---

## E8 · Review

### F-27 Three-colour highlighting
**As** a reviewer, **I want** to mark passages by what kind of attention they need **so that** my colour choices are a filter, not decoration.
**Priority** P0 · **Spec** FR-ANN-01, 02, NFR-FE-02, 03

| Colour | Meaning |
|---|---|
| **Amber** | Note — return to this; no action implied for the other side |
| **Blue** | Question — needs an answer from the discloser |
| **Rose** | Issue — a gap or concern in the dossier |

- Select text, choose a colour, optionally attach a comment
- A highlight can stand alone as a private marker
- Colours become semantic design-system token roles, contrast-tested behind live text in both themes

### F-28 Region highlighting on scanned pages
**As** a reviewer, **I want** to highlight a scanned certificate **so that** the pages with no text layer are not the ones I can't annotate.
**Priority** P0 · **Spec** FR-ANN-03, 04

- Drag a rectangle, get the same three colours
- A first-class path, not a degraded fallback — regulatory dossiers are full of scanned forms

### F-29 Anchored inline comments
**As** a reviewer, **I want** my comment attached to the exact passage **so that** the discloser doesn't have to guess what I meant.
**Priority** P0 · **Spec** FR-ANN-04, 07

- A thread is anchored to a highlight, or attached to the document as a whole
- Anchors store page, quoted text with context, character positions and page-relative rectangles
- Rectangles are fractions of page size, so zoom and display density never move a highlight

### F-30 Threads, replies and resolution
**As** a discloser admin, **I want** to answer a question in place and close it **so that** the open list is a real work queue.
**Priority** P0 · **Spec** FR-ANN-08, 12

- Replies, resolve and reopen, @mentions of room participants
- Authors can edit or soft-delete their own comments; thread structure is preserved

### F-31 Side-private by default, shared on purpose
**As** a reviewer, **I want** my notes visible only to my own team until I decide otherwise **so that** working thoughts don't reach the counterparty mid-negotiation.
**Priority** P0 · **Spec** FR-ANN-09, 10

- Threads default to side visibility
- An explicit action shares with the other side; irreversible in this release, and audited

### F-32 Review sidebar and filters
**As** a recipient admin, **I want** to see every open question across a module **so that** I can run my side's review.
**Priority** P0 · **Spec** FR-ANN-11

- Filter by colour, status, author, module, shared/not-shared

### F-33 Anchor durability across versions
**As** a reviewer, **I want** my comments to survive the discloser replacing a file **so that** a re-upload doesn't erase a week of review.
**Priority** P0 · **Spec** FR-ANN-05, 06, 13

- Annotations attach to a document **version**, not a document
- On a new version, threads re-anchor by quote match
- A thread that re-anchors shows in place; one that cannot is listed as carried over with its position marked lost
- **A thread is never silently dropped, and never guessed into a wrong position**
- Highlights survive reload and zoom at the same visual position

---

## E9 · Communication

### F-34 Transactional email
**As** an invited reviewer, **I want** the invitation to actually arrive **so that** the deal isn't held up by a lost email.
**Priority** P0 · **Spec** FR-MAIL-01, 02, 03

Nine templates: account activation · welcome · invitation (new user) · invitation (existing user) · invitation reminder · password reset · password changed · comment activity · document digest.

- Every message is written to an outbox before sending, with status, attempts and last error
- Failed sends retry with backoff; a permanently failed invitation is visible to the inviter

### F-35 Notification batching
**As** a discloser admin, **I want** a burst of replies to arrive as one email **so that** an active review doesn't flood my inbox.
**Priority** P0 · **Spec** FR-MAIL-04, 05, 06, 07

- Comment notifications batch over 15 minutes; documents come as a daily digest
- Nobody is notified about their own action
- Emails carry no document content and only a short comment excerpt — the substance stays in the room

### F-36 Notification preferences
**As** a reviewer, **I want** to choose how often I hear from Veyra **so that** notifications match how I'm working.
**Priority** P1 · **Spec** FR-MAIL-08

- Per room: immediate (batched), daily, or off
- Security emails cannot be suppressed

---

## E10 · Oversight

### F-37 Audit log
**As** a discloser admin, **I want** a complete record of what happened in the room **so that** I can answer any question about who saw what.
**Priority** P0 · **Spec** FR-AUD-01 … 06

- Append-only. No update or delete path exists in code or in database grants
- Records room, actor, action, target, metadata, IP, user agent, timestamp
- Covers authentication, invitations, NDA acceptance, settings changes, all folder and file operations, views, downloads, annotations, comments, thread resolution and visibility changes, and watermark settings changes
- Visibility follows role: full room for Discloser Admin, own side for Recipient Admin, own actions for contributors and reviewers

### F-38 Audit filtering and export
**As** a discloser admin, **I want** to filter and export the log **so that** I can produce a record outside Veyra when asked.
**Priority** P1 · **Spec** FR-AUD-05

- Filter by actor, action type, module, document, date range; export to CSV

---

## E11 · Account

### F-39 Account settings
**As** any user, **I want** to manage my own name and password **so that** basic account hygiene doesn't require support.
**Priority** P0 · **Spec** FR-AUTH-03, 07, FR-MAIL-08

---

## 6. Screens

Wireframes for all of these are in [wireframes/](wireframes/) and on the shared canvas.

| Screen | Features |
|---|---|
| Sign in (one-time password) | F-01, F-06 |
| Choose your password | F-02, F-06 |
| Create a data room · details | F-13 |
| Create a data room · invite | F-10, F-13 |
| Overview | F-15, F-13a |
| Dossier — all modules | F-16, F-17, F-18, F-18a |
| Dossier — empty module | F-16, F-18a |
| Folder upload drawer | F-20, F-21, F-22 |
| Document viewer + tree | F-23, F-24, F-25, F-26, F-27…F-33 |
| Groups — people & access | F-09, F-11, F-12 |
| Invite — company known / unknown | F-09, F-10, F-12 |
| Guest acceptance + NDA | F-07, F-08 |
| Activity log | F-37, F-38 |

Not wireframed, and deliberately: forgot/reset-password and account settings are standard forms with no product decision in them.

### Design constraints

The web app is built on `@veyra/design-system` — antd v6 under a token layer that flows palette → semantic roles → theme. Application code uses token roles, never literal colours.

Highlight colours are added as semantic roles with fill, border and on-fill text tokens. They sit **behind live document text**, so they must clear WCAG AA against body text in both light and dark modes — a stricter bar than the existing status ramps, which were tuned as tag backgrounds carrying their own text colour. See NFR-FE-01…04.

---

## 7. Quality expectations

| Area | Expectation | Spec |
|---|---|---|
| Security | Private encrypted storage, TLS everywhere, server-side authorisation on every route, schema-validated inputs, uploaded content never rendered in the app origin | NFR-SEC-01…07 |
| Performance | Overview and the Dossier tree under 500 ms p95 at 5,000 documents; first page rendered within 2 s p95 | NFR-PERF-01…05 |
| Accessibility | Zero axe violations in both themes; full keyboard operation of navigation, viewing and commenting | NFR-FE-04, 05 |
| Browsers | Current and previous major Chrome, Edge, Safari, Firefox. Folder upload degrades to file-level with a clear message where unsupported | NFR-FE-06 |
| Operations | Versioned migrations, CI on every PR, correlation IDs from request through background job, one shared source for API contracts | NFR-OPS-01…04 |

---

## 8. Out of scope for this release

| Deferred | Why now, and what it costs later |
|---|---|
| Facilitator rooms | The pilot is direct deals. `side` and `creator_side` already carry the value — enabling it is a validation change plus a dashboard, not a migration |
| Redlining, proposed edits, accept/reject | A separate product surface. `document_versions` already exists to hang it off |
| Version diffing | Depends on redlining |
| Self-serve signup | Tenants are hand-onboarded during the pilot |
| Billing | No self-serve, so no billing |
| SSO | Email and password is sufficient for a pilot cohort |
| **Q&A module** | Routing, assignment and an approval step before an answer is released. Anchored threads cover asking; they don't cover answering as a process. **First thing after MVP** — see [benchmark-drooms.md](benchmark-drooms.md) G1. Its navigation slot is reserved and unrendered |
| OCR and full-text search | Region highlighting (F-28) covers the review need without it. Text-layer search should be promoted ahead of OCR — benchmark G3 |
| AI features | Depends on an anonymised data pipeline that is not yet scoped |
| Per-document permission tiers | `participant_capabilities` already carries a scope type — later tiers are new rows, not a new table |
| Tenant deactivation | Nothing live to offboard yet |
| Hard deletion | Everything is soft-deleted in this release |

---

## 9. Dependencies and assumptions

- **Team**: ~2 backend, 2 frontend, 1 design/QA
- **Hosting**: single region — EU data residency would change storage and database topology and must be settled before build starts
- **Upload envelope**: 250 MB per file, 2,000 files or 5 GB per batch, to be validated against a real Module 3
- **NDA**: click-through with stored timestamp and text version, not a counter-signed document
- **Third parties**: object storage with server-side encryption, an email provider, a headless Office→PDF converter

---

## 10. Open decisions

| # | Question | Working assumption | Affects |
|---|---|---|---|
| 1 | One hosting region, or EU-resident data? | Single region | Storage, database — **decide first** |
| 2 | Is click-through NDA sufficient for pilot counterparties? | Yes | F-08 |
| 3 | Can a Recipient Admin invite their own teammates? | Yes, within their own side | F-11 |
| 4 | Should any role be exempt from watermarking? | No — the discloser's own side is watermarked too | F-24 |
| 5 | Are note / question / issue the right three colours, and should a discloser rename them per room? | Yes; not renameable | F-27 |
| 6 | Does the upload envelope survive a real Module 3? | 250 MB / 5 GB | F-21 |

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Company** | An organisation record. Exists whether or not it pays for Veyra |
| **User** | A person, identified by email. One identity across all rooms and companies |
| **Tenant** | A Company with a Veyra account. Creates rooms |
| **Room** | One deal workspace |
| **Side** | `discloser` or `recipient` |
| **Participant** | User + Company + Side + Role, scoped to one room |
| **Module** | One of the five CTD top-level sections in a room |
| **Document / Version** | A file in a room; replacing it creates a new version |
| **Annotation** | A highlight — a coloured anchor on a document version |
| **Thread** | A comment conversation, optionally attached to an annotation |
| **Rendition** | A watermarked copy of a document version, personalised to one participant |
| **CTD** | Common Technical Document — the standard dossier structure, Modules 1–5 |
