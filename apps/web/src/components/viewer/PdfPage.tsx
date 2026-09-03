import { useCallback, useEffect, useRef, useState } from 'react';
import { TextLayer } from 'pdfjs-dist';
import type { AnnotationDto } from '@veyra/contracts';
import { useVeyraTokens } from '@veyra/design-system';
import type { PDFDocumentProxy } from '../../lib/pdf';
import { annotationAt } from '../../lib/anchor';
import { HIGHLIGHT_FILL, HIGHLIGHT_FILL_ACTIVE } from './highlightColors';

/**
 * One page: a raster of the page, the highlights over it, and a transparent
 * copy of its text on top of both.
 *
 * The text layer is what makes any of this work. A PDF page rasterises to
 * pixels with no notion of words, so pdf.js re-lays the extracted text as
 * invisible positioned spans over the image — that is what the browser's own
 * selection then runs across, which is why a highlight can be made with a
 * normal drag and read out as a real quote rather than a screenshot region.
 *
 * That layer has to stay on top, which is what decides how a highlight is
 * clicked. Painting highlights as real buttons above the text would swallow
 * every drag that starts on one, so a reader could never select a sentence
 * they had already marked — and leaving them below it, as they were, means the
 * text layer eats the click instead and marking anything appears to do
 * nothing. So the fills are inert, and the page hit-tests clicks against the
 * anchors itself.
 *
 * Pages render only once they are near the viewport. A CTD report runs to
 * hundreds of pages, and rasterising them all on open would spend a minute of
 * CPU to draw a screenful.
 */
export function PdfPage({
  pdf,
  pageNumber,
  width,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  watermark,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  annotations: AnnotationDto[];
  activeAnnotationId: string | null;
  onAnnotationClick: (annotation: AnnotationDto) => void;
  /** The stamped mark, so its own text can be kept out of selections. */
  watermark: string | null;
}) {
  const { colors, shadows } = useVeyraTokens();
  const container = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** Holds the live `.textLayer`, which is swapped wholesale on every render. */
  const textHost = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  /*
   * One pass at a time, per page.
   *
   * pdf.js refuses two concurrent renders onto one canvas, and a cancelled
   * render unwinds asynchronously — so a resize that restarts the pass has to
   * wait for the previous one to finish unwinding rather than race it.
   */
  const pass = useRef<Promise<void> | null>(null);
  const task = useRef<{ cancel: () => void } | null>(null);

  // "Near" rather than "visible": a page that starts rendering as its top edge
  // appears arrives blank and fills in under the reader's eyes.
  useEffect(() => {
    const element = container.current;
    if (!element || near) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setNear(true),
      { rootMargin: '1200px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let cancelled = false;
    const previous = pass.current;

    const current = (async () => {
      // Let the pass this one replaces finish unwinding first.
      await previous?.catch(() => undefined);
      if (cancelled) return;

      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const viewport = page.getViewport({ scale: width / base.width });

      const target = canvas.current;
      const context = target?.getContext('2d');
      if (!target || !context) return;

      // Rasterise at device resolution, then scale down in CSS — at 1× the
      // text on a retina screen is visibly soft.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      target.width = Math.floor(viewport.width * dpr);
      target.height = Math.floor(viewport.height * dpr);
      target.style.width = `${viewport.width}px`;
      target.style.height = `${viewport.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const render = page.render({ canvas: target, canvasContext: context, viewport });
      task.current = render;
      try {
        await render.promise;
      } catch {
        return; // Cancelled, or a page we cannot rasterise; either way, stop.
      } finally {
        if (task.current === render) task.current = null;
      }
      if (cancelled) return;

      /*
       * Built detached and swapped in, rather than emptied and refilled.
       *
       * The text layer is the selectable copy of the page, so clearing it up
       * front means every resize has a window in which the words cannot be
       * selected — and if that pass is then cancelled, as the drag on a window
       * edge cancels a great many, the window never closes and the page is
       * left permanently unselectable.
       */
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      // pdf.js positions its spans from this variable; without it every line
      // stacks at the origin.
      layer.style.setProperty('--total-scale-factor', String(viewport.scale));
      try {
        await new TextLayer({
          textContentSource: page.streamTextContent(),
          container: layer,
          viewport,
        }).render();
      } catch {
        return;
      }
      if (cancelled) return;

      /*
       * The watermark is stamped into the page as real text, so pdf.js extracts
       * it like any other run and a drag across the page selects the reader's
       * own name along with the sentence — and worse, that name lands in the
       * quote a highlight is anchored by.
       *
       * Removing the spans is safe here: the mark is still painted, because it
       * is in the rasterised page underneath. This layer is only the invisible
       * copy the browser selects against. The real fix is stamping the mark as
       * outlines server-side (see WatermarkService); until then this is what
       * keeps anchors honest.
       */
      if (watermark) {
        const needle = watermark.trim();
        for (const span of Array.from(layer.querySelectorAll('span'))) {
          const text = span.textContent?.trim();
          if (text && (text === needle || needle.includes(text)) && text.length > 3) span.remove();
        }
      }

      textHost.current?.replaceChildren(layer);
    })();

    pass.current = current;

    return () => {
      cancelled = true;
      task.current?.cancel();
    };
  }, [pdf, pageNumber, width, near, watermark]);

  /** The annotation under a pointer event, in this page's own coordinates. */
  const hit = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const element = container.current;
      if (!element || annotations.length === 0) return null;
      return annotationAt(
        { x: event.clientX, y: event.clientY },
        element.getBoundingClientRect(),
        annotations,
      );
    },
    [annotations],
  );

  return (
    <div
      ref={container}
      data-page={pageNumber}
      className="veyra-pdf-page"
      // Set while a highlight is under the cursor, so the CSS can override the
      // text caret pdf.js puts on every span.
      data-hit={hovered ? '1' : undefined}
      onMouseMove={(event) => {
        const found = hit(event)?.id ?? null;
        setHovered((current) => (current === found ? current : found));
      }}
      onMouseLeave={() => setHovered(null)}
      onClick={(event) => {
        // A click that ends a drag is the end of a selection, not a click on
        // whatever happens to sit under the cursor.
        if (!window.getSelection()?.isCollapsed) return;
        const found = hit(event);
        if (found) onAnnotationClick(found);
      }}
      style={{
        position: 'relative',
        width,
        // Reserve the page's height before it renders, so the scrollbar doesn't
        // jump as pages fill in. A4 until the real ratio is known.
        height: width * (ratio ?? 1.414),
        margin: '0 auto',
        background: colors.bgSurface,
        boxShadow: shadows.sm,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <canvas ref={canvas} style={{ display: 'block' }} />

      {/*
        Under the text layer and inert — see the note at the top.

        Deliberately without a `z-index`: the fills below blend with the page
        raster through `mix-blend-mode`, and blending only reaches as far as
        the nearest stacking context. Giving this wrapper a z-index makes one,
        which leaves each fill blending against its empty parent — an opaque
        block of colour laid over the words instead of ink laid into them.
        Painting order is settled by the text layer's own z-index instead.
      */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {annotations.map((annotation) =>
          annotation.anchor.rects.map((rect, index) => (
            <span
              key={`${annotation.id}-${index}`}
              style={{
                position: 'absolute',
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.w * 100}%`,
                height: `${rect.h * 100}%`,
                borderRadius: 2,
                // Multiply keeps the words legible through the ink; a plain
                // alpha fill greys the text underneath it.
                mixBlendMode: 'multiply',
                background:
                  annotation.id === activeAnnotationId || annotation.id === hovered
                    ? HIGHLIGHT_FILL_ACTIVE[annotation.color]
                    : HIGHLIGHT_FILL[annotation.color],
                transition: 'background 120ms ease',
              }}
            />
          )),
        )}
      </div>

      <div ref={textHost} />

      {/*
        The keyboard's way in. The fills are inert and the hit-test is a mouse
        affordance, so without these a highlight could not be reached without a
        pointer. Off-screen rather than hidden, because `display: none` is not
        focusable either.
      */}
      <div className="veyra-visually-hidden">
        {annotations.map((annotation) => (
          <button
            key={annotation.id}
            type="button"
            onClick={() => onAnnotationClick(annotation)}
            onFocus={() => setHovered(annotation.id)}
            onBlur={() => setHovered(null)}
          >
            {`Highlight on page ${pageNumber}: ${annotation.anchor.quote?.exact ?? 'region'}`}
          </button>
        ))}
      </div>
    </div>
  );
}
