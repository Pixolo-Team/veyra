# Benchmark — Drooms

Reference read of [Drooms](https://drooms.com), a European VDR vendor selling into life sciences among other verticals, checked against the Veyra MVP. Sources are public marketing and review pages, not the product itself — treat feature detail as directional.

Purpose: find what a buyer coming from an established data room platform will expect, and decide what we answer now versus later.

---

## 1. Where we are at parity

| Capability | Drooms | Veyra MVP |
|---|---|---|
| Bulk / drag-drop folder upload | ✓ | F-20, F-21 |
| File conversion and in-browser preview | ✓ | F-22 |
| Personalised watermarks | ✓ | F-24 |
| Granular permissions, activity tracking | ✓ | F-12, F-37 |
| Audit trail / user activity reports | ✓ | F-37, F-38 |
| Encryption at rest and in transit | ✓ | NFR-SEC-01, 02 |

Nothing here is a gap. On watermarking we are arguably stricter: ours is burned server-side into the page content stream as vector outlines, cached per viewer, with the exact identity string written to the audit log (FR-WM-02, 03, 04, 12). "Personalised watermark" as a marketing line does not tell us whether theirs survives a PDF tool.

---

## 2. Real gaps, in priority order

### G1 · Q&A as a module, not just comments — **the significant one**

Drooms runs a dedicated Q&A module: questions are centralised, **routed to subject-matter experts, and pass an approval step before the answer goes back** to the other side. Reviews reportedly reach 200+ questions.

We have anchored comment threads. Precise, and better than a question list for *asking*. But we have no answering machinery: no queue, no assignment, no internal draft-then-release. Today a discloser admin's reply is visible the moment they type it.

That is the wrong shape for a real negotiation. The discloser side needs to draft an answer internally, have the right person check it, and release it deliberately — the same discipline the recipient side already gets from side-only comments (FR-ANN-09).

**The pieces are already in place**, which is why this is worth flagging rather than fearing:

| Needed | What we already have |
|---|---|
| A question queue | Threads with `status` and colour; blue already means "question for the discloser" (FR-ANN-01) |
| Routing to an expert | The discipline tag from the invite form — Regulatory, CMC, Clinical, Quality (FR-INV-01b) |
| Draft privately, release deliberately | `visibility` on the thread: `side` → `room` (FR-ANN-09, 10) |
| Assignment | New: `assigned_participant_id` on `comment_threads` |

So: a **Questions view** — every open thread across the room, filtered by module and discipline, assignable, with the answer drafted side-only and released in one action. One new column and one screen, not a new subsystem.

**Recommendation:** first thing after MVP. It is the gap a buyer from Drooms will notice first.

### G2 · Redaction

Drooms offers AI-assisted redaction with GDPR presets — masking identifiers across many documents at once. For pharma this is not decorative: clinical study reports carry patient identifiers and third-party names that cannot cross to a counterparty.

Not in our MVP, and not trivial — a redaction has to be burned into the delivered bytes, and the un-redacted original must never be reachable.

**But we have already built the hard part.** The per-viewer watermark pipeline is exactly this: stamp server-side into the PDF content stream, cache the rendition per `(version, participant)`, never serve the original (FR-WM-02, 07, 08). Redaction is another stamp on the same pipeline. Worth stating in the plan so nobody rebuilds it.

### G3 · Search across the room

Drooms has OCR and full-text search. We deferred both.

A reviewer facing a 5,000-document room and no search is a reviewer who will complain, and it is the one omission that makes a room feel smaller than the file share it replaced.

Partial mitigation already exists: we extract a text layer on ingest (FR-UPL-09), so **search over born-digital PDFs needs an index, not OCR**. That is a much smaller job than full OCR and covers most of a modern dossier. Scanned pages stay unsearchable until OCR, but they are already handled for annotation by region anchors (FR-ANN-03).

**Recommendation:** promote text-layer search ahead of OCR; keep OCR deferred.

### G4 · Post-deal archive

Drooms sells an Online Archive for long-term storage after a deal closes. We have an `archived` room status (FR-ROOM-01) and no export.

Small but real: a closed deal leaves a compliance obligation, and the first customer to close a deal will ask what happens to the room. Not MVP; belongs on the list.

---

## 3. Where we diverge on purpose

**Auto-allocation and auto-indexing.** Drooms auto-files uploads into index points and suggests document names. That presupposes a pre-existing index — the skeleton we decided against. Our structure comes from the folder the user drops.

Ours is simpler and gives the user control. Theirs is less work when the index already exists. The decision stands; the thing to watch is whether reviewers coming from that world miss a **numbered index**, which is the convention in this market. If they do, the cheap answer is not a skeleton — it is folder-name autocomplete from the eCTD list, already proposed in [onboarding-ux.md §7](onboarding-ux.md).

**Chat.** They have a separate chat channel. We have anchored threads, which is the same conversation attached to the thing it is about. Not adding chat.

**Mobile and desktop apps.** Out of scope, and reading a dossier on a phone is not a real workflow.

---

## 4. Where we are ahead

Worth being deliberate about, because these are the reasons to pick Veyra over a general-purpose room:

- **CTD Modules 1–5 as native structure.** Drooms is industry-agnostic with life sciences as one listed vertical. A room that opens already shaped like a dossier is the product difference.
- **Anchored inline review.** A Q&A module collects questions; it does not put the question on the sentence that provoked it. Text-quote and region anchors with three-colour intent (F-27, F-28, F-29) are a more precise instrument.
- **Anchors that survive a re-upload.** FR-ANN-06 — re-anchor by quote, and where that fails say so rather than guess. Most rooms will simply lose the comment.
- **A watermark that does not corrupt the text layer.** FR-WM-04. An easy thing to get wrong, and getting it wrong quietly breaks every anchor on the page.

---

## 5. Net

Nothing here changes the MVP. Two things change the order of what follows it:

1. **Q&A routing with an approval step** (G1) — first after MVP, and mostly assembly of parts we already have
2. **Text-layer search** (G3) — promote above OCR
3. **Redaction** (G2) — real for pharma, and it rides the watermark pipeline
4. **Post-deal archive/export** (G4) — on the list, not urgent

---

*Sources: [drooms.com](https://drooms.com/en/) · [datarooms.org Drooms overview](https://datarooms.org/drooms-vdr/) · [dealroom.net VDR comparison](https://dealroom.net/resources/virtual-data-room-providers-comparison) · [orangedox Drooms overview](https://www.orangedox.com/blog/drooms-virtual-data-room). Public marketing and third-party review pages, September 2026 — not verified against the product.*
