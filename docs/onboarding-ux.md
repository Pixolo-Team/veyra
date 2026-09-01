# Onboarding — UX design

Source: `VeyraData Structure.xlsx` (Kinjal), two sheets — a 10-step onboarding form with ~50 fields, and a full eCTD section tree.

This document selects what onboarding actually asks, and specifies how skipping works. Companion to [prd.md](prd.md) F-05…F-08, F-13, and the wireframes in [wireframes/](wireframes/).

**Two decisions shape everything below:**

- **No dossier skeleton.** A room opens with Modules 1–5 and nothing beneath them. Users add folders and the structure follows from what they upload.
- **Veyra provisions the tenant completely** — company, email domains, tenant record, first admin. The admin arrives on a one-time password, is forced to reset it, and lands in room creation.

---

## 1. The problem with 10 steps

The reference form asks about 50 questions across 10 steps before the customer sees anything. A first-time user cannot answer half of it yet, and none of it is what they came to do: put a dossier somewhere safe and show it to someone.

Three rules did the cutting.

**Ask only what changes the outcome.** A field earns a place if the product cannot proceed without it, or if the answer changes what gets generated. Everything else is settings.

**Never ask what we already know.** Veyra sets up the company. The admin signs in from a work email. Company name, domains, website, contact, regulatory authorities — all already known or derivable. Asking again reads as a form that isn't paying attention.

**Skipping must not lose the field.** A skip that discards the question is a data-loss bug wearing a UX costume. Every skipped field reappears in the room, at the moment it matters.

Result: **~50 fields → 2 required.** Room name and deal type. Nothing else is asked before a working room exists.

### How it got there

| Draft | Shape | What removed the step |
|---|---|---|
| Reference form | 10 steps, ~50 fields | — |
| First pass | 4 screens, 7 required | Derived, deferred or cut everything that changed nothing |
| No skeleton | 3 screens, 5 required | Dossier format and target markets only existed to pick a skeleton |
| Veyra provisions | **2 room-creation screens, 2 required** | The organisation screen: we set the company up, so asking for it back is noise |

---

## 2. Field triage

`KEEP` asked in onboarding · `PROVISIONED` set by Veyra before the admin arrives · `DERIVE` filled in for the user · `DEFER` moved into the room or settings · `CUT` not collected

### Step 1 — Organization

| Field | Verdict | Reason |
|---|---|---|
| Organization name | **PROVISIONED** | Veyra creates the Company. Editable in Settings |
| Email domains | **PROVISIONED** | Set at provisioning; this is what makes invite company-matching work (FR-INV-02, FR-ONB-03a) |
| Organization type | **PROVISIONED** | One field on the Operator's side, none on the customer's |
| Website | **DERIVE** | The email domain *is* the website |
| Primary contact · Business email · Role | **CUT** | Already known — this person is signed in |
| Industry | **CUT** | Duplicate of organization type |
| Country / HQ · Company size | **DEFER** | Segmentation data, not product data. Org settings |

### Step 2 — What are you using it for

| Field | Verdict | Reason |
|---|---|---|
| Transaction type | **KEEP → merged** | A deal has one type and it belongs to the room, so it moved into room creation as a single-select. Step 3 already re-asked it "carried over from Step 2" |

> The sheet labels this step "What are you using **ReguSurf** for?" — wrong product name, worth fixing at source.

### Step 3 — Create your workspace

| Field | Verdict | Reason |
|---|---|---|
| Workspace name | **KEEP** | The one thing genuinely required to create a room |
| Transaction type | **KEEP** | Moved here from step 2 |
| Product name · Asset code | **DEFER** | Duplicates step 4 |
| Transaction stage · Target date | **DEFER** | Changes nothing at creation |

### Step 4 — Asset information

| Field | Verdict | Reason |
|---|---|---|
| All 9 fields | **DEFER** | Useful, and none of it blocks creating a room or uploading a file. Becomes an Asset panel, prompted once from Overview |

### Step 5 — Regulatory profile

| Field | Verdict | Reason |
|---|---|---|
| Target markets | **DEFER** | Was a keeper only while a region-specific Module 1 skeleton was generated. With no skeleton it changes nothing at creation |
| Dossier format | **DEFER** | Same. Modules 1–5 are identical for CTD, eCTD and NeeS — the format only ever mattered as a skeleton selector |
| Regulatory authorities | **DERIVE** | Implied by markets: US→FDA, EU→EMA, UK→MHRA, JP→PMDA… |
| Submission type | **DEFER** | Metadata; sits with the asset details |

### Step 6 — What are you sharing

| Field | Verdict | Reason |
|---|---|---|
| CMC · Clinical · Nonclinical · Quality · Manufacturing · Pharmacovigilance | **CUT** | **These are already Modules 1–5.** Quality *is* Module 3, Nonclinical *is* Module 4, Clinical *is* Module 5, CMC and Manufacturing are 3.2.S/3.2.P, PV is 1.8. As top-level categories they build a room where the same content has two homes |
| Intellectual Property · Commercial · Legal · Financial | **KEEP (optional)** | These genuinely sit outside the dossier. They became the **Documents** section (FR-NAV-02), off by default |
| "Use recommended structure" | **CUT** | There is no recommended structure to opt into — structure comes from what the user uploads |

### Step 7 — Invite your team

| Field | Verdict | Reason |
|---|---|---|
| Invitations | **KEEP (skippable)** | Step 2 of room creation, skippable outright — most people load the dossier first |
| Access level | **KEEP** | Three levels: Review · Review + Download · Admin (FR-ROOM-05) |
| Roles: Regulatory, CMC, Clinical, Legal… | **DEFER as a label** | **Disciplines, not permissions.** Access level controls what you can do; discipline is an optional tag. Never let a job title grant a permission |

### Step 8 — Counterparty

| Field | Verdict | Reason |
|---|---|---|
| Counterparty company + contact | **DEFER (skippable)** | The highest-value skip. Disclosers build and load rooms weeks before the counterparty is named; the room stays `draft` and says so |
| Transaction role ("You are: Seller") | **CUT** | The room creator is always the discloser in this release (D6). A question with one answer |

### Step 9 — Security configuration

| Field | Verdict | Reason |
|---|---|---|
| Watermark · Downloads · NDA | **DERIVE** | On, off, on. Shown as a confirmation of the defaults, not asked |
| Enable audit trail | **CUT** | **Append-only and always on** (FR-AUD-01). A toggle implies it can be turned off — untrue, and a bad thing to imply to a pharma buyer |
| Allow printing | **CUT** | We cannot prevent printing in a browser. The watermark is what makes a printed page traceable |
| Restrict external access · Document expiry | **CUT** | Not in this release. An inert toggle is worse than an absent one |

### Step 10 — Review & launch

| Field | Verdict | Reason |
|---|---|---|
| Summary | **KEEP** | Good instinct — but it belongs beside the room fields as a live preview, not as a tenth step |

---

## 3. The flow

Four screens, two of which are authentication. A provisioned admin reaches a working room in well under a minute.

### 1 · Sign in
The invitation carries a **one-time password**: single-use, dead the moment it signs you in, expired after 72 hours (FR-ONB-02). The field is labelled as temporary and says where it came from, so nobody mistakes it for a password they chose.

### 2 · Choose your password
Forced, and unskippable (FR-ONB-03). The screen states that the temporary password has already been used and no longer works — otherwise being asked again looks like a failure rather than a step. Setting it ends every other session.

### 3 · Create a data room · details
```
Room name            [ Project Alpha              ]   required
What kind of deal?   ( Out-licensing )  In-licensing  Asset acquisition …

Anything outside the dossier?         │   Your data room
[ ] Intellectual Property             │    Module 1  Administrative   empty
[ ] Commercial  [ ] Legal             │    Module 2  CTD Summaries    empty
[ ] Financial                         │    Module 3  Quality          empty
                                      │    Module 4  Nonclinical      empty
                                      │    Module 5  Clinical         empty
                                      │
                                      │   ✓ Watermarking on
                                      │   ✓ NDA required
                                      │   ✓ Downloads off
                                      │   ✓ Audit log on — always
                                                          [ Continue ]
```
Two required inputs. The right column is the reference form's step 10, turned into something you read while you type — and it carries the security reassurance without asking a question.

### 4 · Create a data room · invite
```
Who else needs access?

t.belasco@corvellis.com   Corvellis  matched   Admin   ×
s.chen@astrivax.com       Astrivax   matched   Review  ×
Add another email…

The company comes from the email domain, and the side follows
from the company. Anyone we can't place is asked about individually.

[ Invite Later ]                        [ Send 2 invitations ]
```
**The room already exists.** That is what makes this step genuinely optional rather than an exit without a product.

### Then · Overview
The room's landing screen — a work queue, not a status report. Anything skipped above appears there as a setup checklist item.

---

## 4. Building structure from uploads

With no skeleton, this is the mechanism that produces a room's shape, so it has to be obvious.

**An empty module has a job to do.** It is the first thing most users see, and it must teach the mechanism rather than look broken. It offers all three add routes, not just bulk upload:

| | |
|---|---|
| **New folder** | Empty, named on creation |
| **Upload files** | One or many, straight into this node |
| **Upload folder** | Keeps every sub-folder, at any depth |

**Add anywhere.** All three are available at **any node in the tree**, not only at a module root — and dropping files or folders onto any row puts them there without navigating first (FR-DOC-05a).

**Modules stay fixed.** The five CTD modules are the top level and cannot be created, renamed or reordered (FR-DOC-01). Everything below them is the user's.

---

## 5. Skip mechanics

**S1 · A skip always says where the field went.** Never a bare "Skip". A skip whose consequence is invisible reads as "lose this forever", so people fill the form anyway, resentfully.

**S2 · Skipping never blocks creation.** The room exists with all five modules and the safe security defaults regardless. No path through onboarding ends without a working room.

**S3 · Skipped work becomes a checklist, not a memory.** Each skip creates an item on Overview's setup card. One click to complete, gone when empty, dismissible permanently. It never nags twice.

**S4 · A skipped counterparty keeps the room in `draft`.** The room says so plainly. A real product state (FR-ROOM-01), not a UI warning — which is what makes the most valuable skip safe to take.

**S5 · Progress saves on every step.** Onboarding is interruptible because real onboarding gets interrupted.

**S6 · Nothing is asked twice.** Provisioned and derived values appear filled and editable. The user's job is to confirm or correct, never to type what we already have.

**S7 · Back is always available, and non-destructive.** What onboarding sets is what room settings exposes.

> **Where the skips actually are.** Only the invite step (screen 4) carries one. Screen 3's two fields are required and its extras default to off, so a skip control there would do nothing that **Continue** doesn't already do — and a control that does nothing is worse than no control.

---

## 6. Where deferred fields live

| Deferred from | Lives in | Surfaced by |
|---|---|---|
| Asset details (9 fields) | Asset panel, room settings | Overview checklist; asset summary once filled |
| Target markets, authorities, dossier format, submission type | Regulatory panel, beside the asset details | Same checklist item |
| Counterparty company & contact | Groups | Checklist item; `draft` badge until done |
| Team invitations | Groups | Checklist item |
| Discipline tags | Participant record | Optional field on the invite form |
| Company name, domains, type, country, size | Organisation settings | Provisioned by Veyra; never prompted |
| Non-dossier categories | The **Documents** section | Addable at any time |

---

## 7. What to do with the eCTD sheet

The second tab is a complete, correctly-nested dossier tree — 74 sections across five modules. It is not seeding anything, but it is the best reference we have for what these sections are called.

**Keep it as a reference list, not a template.** Two uses that don't reintroduce a skeleton:

- **Folder-name autocomplete.** Creating a folder inside Module 3 suggests `3.2.S.4 Control of Drug Substance` as you type. The user still adds the folder; we just save them the CTD numbering.
- **Naming consistency** across rooms, which matters later for anything reading across deals.

**If it is ever imported, fix one thing first.** Section **1.10 Information Relating to Paediatrics** is stored in the file as the *number* `1.1` — Excel dropped the trailing zero — colliding with **1.1 Comprehensive Table of Contents**. The column needs to be text before anything reads it.

---

## 8. Decisions

| # | Question | Status |
|---|---|---|
| 1 | Seed a dossier skeleton, or let structure come from uploads? | **Decided — no skeleton** (D10) |
| 2 | How does the admin arrive? | **Decided — Veyra provisions everything; one-time password, forced reset, straight into room creation** (D11) |
| 3 | One room or many? | **Decided — multi-room, with a switcher in the navigation** (D12) |
| 4 | Should "not a CTD dossier" be a room type with no modules? | Open. The only thing that would bring dossier format back into onboarding. Recommend **no** — every room gets Modules 1–5, and non-dossier material goes in Documents |
| 5 | Use the eCTD sheet for folder-name autocomplete? | Open. Recommend **yes**, as a small aid |
| 6 | Discipline tags — build now? | Open. Recommend **yes as an optional label**, never as anything that grants permission |

---

## 9. What this changed in the other docs

All folded in already:

- **FR-ONB-01…05** — provisioning, one-time password, forced reset, two-step room creation
- **FR-ONB-03a** — domains set at provisioning, edited in Settings, never asked
- **FR-ROOM-06a/06b** — multi-room and the switcher
- **FR-NAV-01…04** — the eight destinations, Dossier vs Documents, Q&A unrendered
- **FR-DOC-03a, FR-DOC-05a, FR-UPL-01a** — one tree, add at any node, three add modes
- **FR-DASH-01…06** — Overview as a work queue
- **PRD F-05, F-06, F-13, F-13a, F-12a, F-15, F-16, F-18a**
