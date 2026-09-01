# Veyra — Product Plan (V1)

*A virtual data room platform for pharma dossier sharing, review, comment, and collaborative editing.*

---

## 1. Product Overview

Veyra is a virtual data room platform purpose-built for pharma companies to securely share regulatory and scientific dossiers with counterparties — during out-licensing negotiations, co-development partnerships, and M&A due diligence.

Unlike a generic VDR, Veyra supports structured, indexed document review; inline commenting anchored to specific sections; collaborative editing/redlining on deal documents; and a full audit trail — all under strict, granular permissioning appropriate for competitively sensitive scientific and regulatory content.

Veyra can be used two ways:
- **Directly** — a pharma company runs its own deal process and invites a counterparty.
- **Facilitated** — a neutral third party (advisory firm, broker, CRO) sets up and manages a room on behalf of two other companies, without being a deal party itself.

---

## 2. Core Concepts & Terminology

| Term | Definition |
|---|---|
| **Company** | An organization (e.g. Corvellis, Astrivax, Meridian). Exists as a record whether or not it's a paying customer. |
| **User** | A person, tied to an email address. May be linked to one or more companies over time, and may participate in multiple rooms independently of any single company relationship. |
| **Tenant** | A Company with a paid Veyra account — has a Tenant Admin, manages its own users, and can create rooms. |
| **Guest** | A person invited into a specific room, scoped to that room only. Has no account relationship beyond it — unless they already have a Veyra login from elsewhere, in which case the invite attaches to their existing account rather than creating a duplicate. |
| **Room** | A single deal workspace. Always created by a Tenant, who plays exactly one of three roles in it. |
| **Room Role** | **Discloser** (shares the dossier) · **Recipient** (reviews the dossier) · **Facilitator** (manages the room, not a deal party). Role is decided per-room by who creates it — never fixed to a company or account. |
| **Room Participant** | The link between a User + a Company + a Role + Permissions, scoped to one specific room. This is what lets the same person represent different companies, or hold different roles, across different rooms. |

**Key rule:** whoever *creates* a room is that room's Tenant (Discloser, Recipient, or Facilitator). Whoever they *invite* is a Guest in that room. Facilitator is always tenant-side by definition — a facilitator is never a deal party.

---

## 3. Roles & Permissions Matrix

| Role | Create/manage room | Upload docs | Set doc permissions | View docs | Comment | Propose edits | Accept/reject edits | View audit log | Tenant account/billing |
|---|---|---|---|---|---|---|---|---|---|
| **Veyra Admin** (platform) | — | — | — | — | — | — | — | Platform-level only | — |
| **Tenant Admin** | Enables room creation | — | — | — | — | — | — | — | ✓ |
| **Room Owner / Facilitator** | ✓ | — | — | Metadata only | — | — | — | Full room | — |
| **Discloser Admin** | — | ✓ | ✓ | ✓ | ✓ | Optional toggle | Owns dossier docs | Own side + shared | — |
| **Discloser Contributor** | — | — | — | Assigned docs | ✓ | Optional toggle | — | Own actions only | — |
| **Recipient Admin** | — | — | — | Per permission | ✓ | Optional toggle | Shared deal docs only | Own side + shared | — |
| **Recipient Reviewer** | — | — | — | Assigned docs | ✓ | Optional toggle | — | Own actions only | — |

Notes:
- Editing is a **permission toggle** layered on a role, not a separate role tier — enabled per person, per document, by the owning side's Admin.
- For the locked regulatory dossier, the Discloser has final say on any proposed edit. For jointly negotiated deal documents (term sheets, agreements), both sides can propose *and* accept, since it's a genuine back-and-forth.
- The Facilitator sees room activity (who's active, response times, open comment threads) but not document content — this is a deliberate design choice to keep them useful for deal management without giving them access to competitively sensitive material.

---

## 4. User Flows

### 4.1 Direct Deal Flow
*(Example: Corvellis runs its own out-licensing process)*

1. Corvellis (Tenant) creates a room, is auto-assigned Discloser
2. Corvellis invites Astrivax's team as Recipient (Guest)
3. Invitees accept, complete NDA click-through
4. Corvellis uploads dossier documents
5. Astrivax reviews, comments, proposes edits on deal documents
6. Corvellis responds to comments, accepts/rejects proposed edits
7. Full audit trail logged throughout

### 4.2 Facilitated Deal Flow
*(Example: Meridian manages a deal between Corvellis and Astrivax)*

1. Meridian (Tenant) creates a room, marks itself as Facilitator — not a party
2. Meridian invites Corvellis's team as Discloser (Guest) and Astrivax's team as Recipient (Guest)
3. Both sets of invitees accept, complete NDA click-through
4. Corvellis uploads dossier documents
5. Astrivax reviews, comments, proposes edits
6. Corvellis responds, accepts/rejects proposed edits
7. Meridian sees room-level activity metadata (not content) to manage the process
8. Full audit trail logged; Corvellis and Meridian can see it, Astrivax's visibility is more limited by design

### 4.3 Invite & Company Resolution (shared sub-flow)
*Used by any inviter — Facilitator, Discloser Admin, or Recipient Admin.*

1. Inviter enters the invitee's email, picks their room role, and searches for a company match
2. System fuzzy-matches the typed company name against existing Company records and known domain aliases — shows "Did you mean: Corvellis Biopharma?" style suggestions rather than accepting free text
3. Inviter confirms a match, or explicitly creates a new Company record if nothing fits
4. System checks the invitee's **email** against existing Users:
   - Match found → new Room Participant added to their existing login, no duplicate account
   - No match → new User shell created, invite email sent to set a password
5. Invitee accepts, completes NDA click-through, gains access
6. Room Participant record (User + Company + Role + Permissions) is finalized for this room

---

## 5. Data Model (Core Entities)

| Entity | Key fields | Notes |
|---|---|---|
| **Company** | name, domain(s), tenant_status | Exists independently of tenancy — non-tenant companies are tracked too, for cross-deal consistency |
| **User** | email, name, credentials | One identity, reusable across any number of rooms and companies |
| **Tenant** | linked Company, billing info, Tenant Admin | Only exists for Companies with a paid account |
| **Room** | created_by (Tenant), room_type | room_type determines whether the creator is Discloser, Recipient, or Facilitator |
| **Room Participant** | User, Company, Role, Permissions, Room | The join table that makes per-room, per-company, per-role flexibility possible |
| **Document / Document Version** | room_id, storage location, version history | Supports accept/reject edit workflow and diffing |
| **Comment** | document/version, anchor (page/section), thread, author | Anchored, threaded |
| **Audit Log Entry** | room_id, user_id, action, timestamp | Full activity trail; visibility varies by role |

---

## 6. V1 Scope

**In scope:**
- Direct and facilitated room creation
- Email + password authentication (no SSO for v1)
- Company search/confirm at invite time (no free-text company entry)
- Existing-account detection on invite (no duplicate identities)
- Document upload, in-browser viewer
- Anchored commenting with threaded replies
- Editing/redlining on deal documents, with accept/reject and version history
- Basic activity/audit log
- Facilitator metadata-only dashboard (no document content access)

**Deferred to v2+:**
- Multi-tenant scaling beyond an initial pilot set of tenants (architecture supports it; rollout will start small)
- SSO / enterprise auth
- Tenant deactivation/suspension flow
- Full-text OCR search across documents
- AI-assisted features (smart Q&A routing, auto-tagging) — dependent on the anonymized training data pipeline, still being scoped
- Granular per-document permission tiers beyond the current role-based defaults
- Editing extended to the locked dossier itself (currently assumed out of scope — see open questions)

---

## 7. Phased Build Plan

1. **Foundations** — auth, Company/User/Tenant/Room data model, invite + company-resolution flow, document storage
2. **Viewer & Comments** — in-browser document viewer, anchored commenting, threaded replies
3. **Editing & Redlining** — structured editor for deal documents, track-changes-style proposed edits, version diffing, accept/reject workflow
4. **Audit Trail & Notifications** — activity log, email notifications on comments/edits/invites
5. **Hardening & Polish** — permission edge cases, security pass, UI polish, Facilitator dashboard

---

## 8. Open Questions / Decisions Needed

- **Editing scope**: confirmed assumption is that editing applies to deal documents (term sheets, agreements), not the locked regulatory dossier itself — needs explicit sign-off before build.
- **AI training data**: Veyra wants anonymized signals for model training, not raw content — exact scope (usage metadata vs. structural metadata vs. aggregated text patterns) still needs to be defined, since it affects both the data pipeline design and the consent language in tenant onboarding.
- **Tenant deactivation/suspension**: in scope for v1, or deferred until there are live tenants to actually offboard?
- **Guest-to-tenant linking**: decided — a guest invited via a facilitator stays a standalone identity by default; their employer's own Tenant Admin (if one exists) must deliberately link them rather than this happening automatically.
- **Facilitator visibility depth**: how much room-level metadata (response times, thread counts) is appropriate for the Facilitator dashboard — needs a final pass once that screen is designed.

---

*This document reflects planning discussions to date and should evolve as decisions are finalized — treat it as a living reference, not a frozen spec.*
