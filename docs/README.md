# Veyra — Documentation

Product and engineering documents for Veyra. Code documentation lives in the root [README](../README.md).

| Document | What it is | Read it when |
|---|---|---|
| [prd.md](prd.md) | **Product Requirements Document.** Problem, goals, users, and the full feature catalogue — 39 features across 11 epics, each with a user story, priority and acceptance criteria. | You need to know *what* we are building and *why* |
| [requirements.md](requirements.md) | **Requirements specification.** ~135 numbered, testable requirements (`FR-`, `NFR-`). No schedule. | You are implementing, reviewing or testing a feature |
| [onboarding-ux.md](onboarding-ux.md) | **Onboarding UX.** Field-by-field triage of the reference form (~50 fields → 2 required), the arrival flow, and how skipping works. | You are designing or building onboarding |
| [wireframes/](wireframes/) | **Wireframes.** 14 low-fidelity screens, one `.dc.html` file each, laid out by `canvas.json`. `veyra-wireframes.html` opens the whole canvas in a browser. | You want to see a screen before building it |
| [benchmark-drooms.md](benchmark-drooms.md) | **Competitive read.** Drooms checked against the MVP — parity, four real gaps ranked, and where we diverge on purpose. | You are deciding what comes after the MVP, or answering "how does this compare to X?" |
| [mvp-plan.md](mvp-plan.md) | **Build plan.** Architecture, data model, decisions with rationale, phasing, risks. | You need the technical shape, the sequencing, or the reason behind a decision |
| [product-plan-v1.md](product-plan-v1.md) | **Source product plan.** The original V1 vision, including the facilitator flow. Superseded by the documents above for anything MVP. | You need the wider product context beyond this release |

## How they relate

```
product-plan-v1.md     the full V1 vision (incl. facilitator, redlining)
        │
        ▼
    prd.md             MVP scope: features, stories, acceptance      ← start here
        │
        ├──► requirements.md   FR-/NFR- IDs the PRD features link to
        ├──► mvp-plan.md       architecture, schema, decisions, phasing
        ├──► onboarding-ux.md   onboarding: what we ask, what we skip
        ├──► benchmark-drooms.md what a VDR buyer expects that we don't do yet
        └──► wireframes/         every screen, low-fidelity
```

Features in the PRD (`F-01`…`F-39`) link down to requirement IDs (`FR-VIEW-03`, `NFR-SEC-01`). Decisions in the build plan (`D1`…`D9`) explain why a requirement reads the way it does. Use those IDs in branch names, commits and tests.

## Scope of this release

Discloser ⇄ Recipient rooms. CTD Modules 1–5 in one expandable tree, plus a Documents section for non-dossier material. Watermarked in-browser review with three-colour highlighting and anchored comments. Multi-room from day one.

Tenants are provisioned by Veyra — the admin arrives on a one-time password, resets it, and lands in room creation.

Out of scope, with the data model shaped to accept them later: facilitator rooms, redlining, SSO, search, billing, AI. **Q&A** is also out — its navigation slot is reserved and unrendered, and it is the first thing after this release ([benchmark-drooms.md](benchmark-drooms.md) G1).

## Status

All documents are living. Open decisions are tracked in [prd.md §10](prd.md#10-open-decisions); the data-residency question blocks the storage layer and should be settled first.
