/**
 * Turning a reader's text selection into a durable anchor.
 *
 * The stored anchor carries three things, and each answers a different
 * question (see `anchorPayloadSchema`):
 *
 * - **rects**, normalised 0–1 against the page box, are how the highlight is
 *   drawn. Normalised and not pixels because the same anchor has to survive a
 *   zoom, a window resize, and a different screen — a highlight recorded at
 *   one scale and replayed at another would sit next to its own sentence.
 * - **quote** — the exact text plus a little either side — is how the anchor
 *   survives the *document* changing. When v5 of a report arrives, the rects
 *   are meaningless but the sentence usually still exists; prefix and suffix
 *   are what tell two identical sentences apart.
 * - **page** narrows both.
 *
 * Nothing here re-anchors onto a new version yet. The quote is captured now
 * because it can only be captured now: once the selection is gone, the context
 * around it cannot be recovered from the rects.
 */

import type { AnchorPayload, AnnotationDto } from '@veyra/contracts';

/** Enough context to disambiguate a repeated sentence, without storing the page. */
const CONTEXT_CHARS = 48;

/** A selection can span pages; each page gets its own anchor. */
export interface PageSelection {
  page: number;
  anchor: AnchorPayload;
}

/** Every rendered page, with the box it currently occupies on screen. */
interface PageBox {
  page: number;
  element: HTMLElement;
  box: DOMRect;
}

function pageBoxes(root: HTMLElement): PageBox[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-page]'))
    .map((element) => ({
      page: Number(element.dataset.page),
      element,
      box: element.getBoundingClientRect(),
    }))
    .filter((entry) => entry.page > 0 && entry.box.width > 0 && entry.box.height > 0);
}

/**
 * Which page a rect belongs to, by overlap rather than by hit-testing.
 *
 * The obvious implementation asks `elementFromPoint` what is under the middle
 * of the rect, and it is wrong in a way that only shows up on long selections:
 * that call answers for the *viewport*, so every line of a drag that runs off
 * the top or bottom of the pane returns null and is silently dropped. Reading
 * the page boxes and comparing geometry costs one layout pass and keeps the
 * lines nobody can see.
 */
function pageOf(rect: DOMRect, pages: PageBox[]): PageBox | null {
  let best: PageBox | null = null;
  let bestOverlap = 0;
  for (const candidate of pages) {
    const { box } = candidate;
    const overlap =
      Math.max(0, Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top)) *
      Math.max(0, Math.min(box.right, rect.right) - Math.max(box.left, rect.left));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = candidate;
    }
  }
  return best;
}

/**
 * Merges rects that describe the same line.
 *
 * A selection across styled runs produces one rect per run, so a single line of
 * text can arrive as a dozen slivers with hairline gaps between them. Drawn as
 * they are, the highlight looks striped.
 */
function mergeLines(rects: DOMRect[]): DOMRect[] {
  const sorted = [...rects].sort((a, b) => a.top - b.top || a.left - b.left);
  const lines: DOMRect[] = [];

  for (const rect of sorted) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const last = lines[lines.length - 1];
    // Same line if they overlap vertically by most of their height.
    const sameLine =
      last &&
      Math.min(last.bottom, rect.bottom) - Math.max(last.top, rect.top) > rect.height * 0.5;

    if (!sameLine) {
      lines.push(new DOMRect(rect.x, rect.y, rect.width, rect.height));
      continue;
    }
    const left = Math.min(last.left, rect.left);
    const right = Math.max(last.right, rect.right);
    const top = Math.min(last.top, rect.top);
    const bottom = Math.max(last.bottom, rect.bottom);
    lines[lines.length - 1] = new DOMRect(left, top, right - left, bottom - top);
  }
  return lines;
}

/**
 * The text either side of the selection, for telling repeats apart.
 *
 * Both the context and the quote are read off the same string and normalised
 * the same way. Measuring the offset in raw DOM text but slicing out of
 * `innerText` — which collapses runs of whitespace — puts prefix and suffix a
 * few characters out on any page with justified spacing, which is most of them.
 */
function contextAround(range: Range, page: HTMLElement): { prefix?: string; suffix?: string } {
  const layer = page.querySelector<HTMLElement>('.textLayer') ?? page;

  const before = document.createRange();
  before.selectNodeContents(layer);
  try {
    before.setEnd(range.startContainer, range.startOffset);
  } catch {
    return {};
  }

  const after = document.createRange();
  after.selectNodeContents(layer);
  try {
    after.setStart(range.endContainer, range.endOffset);
  } catch {
    return {};
  }

  const prefix = normalise(before.toString()).slice(-CONTEXT_CHARS);
  const suffix = normalise(after.toString()).slice(0, CONTEXT_CHARS);
  return { prefix: prefix || undefined, suffix: suffix || undefined };
}

/** One space, no edges — the shape a quote is compared in. */
export function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Reads the live selection into one anchor per page it covers.
 *
 * Returns `[]` for a collapsed selection or one that lands outside the pages —
 * a click is not a highlight, and neither is dragging across the sidebar.
 */
export function selectionAnchors(root: HTMLElement): PageSelection[] {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return [];

  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return [];

  const exact = normalise(selection.toString());
  if (!exact) return [];

  const pages = pageBoxes(root);
  if (pages.length === 0) return [];

  // Group the client rects by the page they fall on.
  const byPage = new Map<number, { page: PageBox; rects: DOMRect[] }>();
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width <= 0 || rect.height <= 0) continue;
    const page = pageOf(rect, pages);
    if (!page) continue;
    const entry = byPage.get(page.page) ?? { page, rects: [] };
    entry.rects.push(rect);
    byPage.set(page.page, entry);
  }

  const context = contextAround(range, pages[0].element);

  const anchors: PageSelection[] = [];
  for (const [page, entry] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const { box } = entry.page;

    const normalised = mergeLines(entry.rects).map((rect) => ({
      // Clamped because the contract stores fractions of the page, and a
      // selection that runs a hair past the trim edge would otherwise be
      // rejected by the API rather than drawn at the margin.
      x: clamp((rect.left - box.left) / box.width),
      y: clamp((rect.top - box.top) / box.height),
      w: clamp(rect.width / box.width),
      h: clamp(rect.height / box.height),
    }));
    if (normalised.length === 0) continue;

    anchors.push({ page, anchor: { page, quote: { exact, ...context }, rects: normalised } });
  }
  return anchors;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The highlight under a point on a page, if any.
 *
 * Hit-testing in JavaScript rather than letting the browser do it with real
 * elements, because the highlight fills have to sit *under* pdf.js's text
 * layer: anything painted over that layer swallows the drag that starts a new
 * selection, and a reader who cannot select the sentence they just highlighted
 * has lost more than they gained. So the fills are inert, and this turns a
 * click on the page into the annotation the reader meant.
 *
 * Smallest-area first, so a phrase highlighted inside a highlighted paragraph
 * is reachable rather than buried under the bigger one.
 */
export function annotationAt(
  point: { x: number; y: number },
  box: DOMRect,
  annotations: AnnotationDto[],
): AnnotationDto | null {
  const x = (point.x - box.left) / box.width;
  const y = (point.y - box.top) / box.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;

  let best: AnnotationDto | null = null;
  let bestArea = Infinity;
  for (const annotation of annotations) {
    for (const rect of annotation.anchor.rects) {
      if (x < rect.x || x > rect.x + rect.w || y < rect.y || y > rect.y + rect.h) continue;
      const area = rect.w * rect.h;
      if (area < bestArea) {
        bestArea = area;
        best = annotation;
      }
    }
  }
  return best;
}
