import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Skeleton, Tooltip } from 'antd';
import type { AnchorPayload, AnnotationColor, AnnotationDto } from '@veyra/contracts';
import { useVeyraTokens } from '@veyra/design-system';
import { loadPdf, MAX_PAGE_WIDTH, type PDFDocumentProxy } from '../../lib/pdf';
import { selectionAnchors } from '../../lib/anchor';
import { PdfPage } from './PdfPage';
import { CommentIcon, DeleteIcon } from '../icons';
import { HIGHLIGHT_COLORS, HIGHLIGHT_DOT, HIGHLIGHT_LABEL } from './highlightColors';

export interface NewHighlight {
  color: AnnotationColor;
  anchor: AnchorPayload;
  /** True when the reader asked to comment, not just to mark. */
  withComment: boolean;
}

/**
 * What the floating menu is currently about: a fresh selection, or a highlight
 * that is already on the page.
 */
type MenuTarget =
  | { kind: 'selection'; anchors: AnchorPayload[] }
  | { kind: 'annotation'; annotation: AnnotationDto };

interface Menu {
  /** In the scroller's own coordinates, so it stays put as the page scrolls. */
  top: number;
  left: number;
  /** Set when the menu had to flip above its subject to stay in the pane. */
  above: boolean;
  target: MenuTarget;
}

const MENU_WIDTH = 210;
const MENU_HEIGHT = 40;

/**
 * The document: every page in one scroller, with highlights drawn over them and
 * a menu that appears on a text selection or on a highlight.
 */
export function PdfView({
  url,
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  onCreate,
  onRecolour,
  onDelete,
  onComment,
  onPageChange,
  scrollToAnnotation,
  watermark,
  goToPage,
}: {
  url: string;
  annotations: AnnotationDto[];
  activeAnnotationId: string | null;
  onAnnotationClick: (annotation: AnnotationDto) => void;
  onCreate: (highlight: NewHighlight) => void;
  /** Change an existing highlight's ink. */
  onRecolour: (annotation: AnnotationDto, color: AnnotationColor) => void;
  /** Remove a highlight of the reader's own that carries no thread. */
  onDelete: (annotation: AnnotationDto) => void;
  /** Start a comment on a highlight that hasn't got one yet. */
  onComment: (annotation: AnnotationDto) => void;
  /** Reports the page under the reader's eye, and how many there are. */
  onPageChange: (page: number, pageCount: number) => void;
  /** Set to scroll a highlight into view — cleared by the caller afterwards. */
  scrollToAnnotation: AnnotationDto | null;
  /** The stamped mark, kept out of the selectable text layer. */
  watermark: string | null;
  /** A page to jump to. Re-sent as `{page, at}` so asking twice still moves. */
  goToPage: { page: number; at: number } | null;
}) {
  const { colors, radius, shadows, space } = useVeyraTokens();
  const scroller = useRef<HTMLDivElement>(null);
  const pages = useRef<HTMLDivElement>(null);
  /*
   * Keyed by the url they came from, so switching documents can never show the
   * previous one's pages while the new one loads — and so neither has to be
   * cleared by an effect on the way in.
   */
  const [loaded, setLoaded] = useState<{ url: string; pdf: PDFDocumentProxy } | null>(null);
  const [failed, setFailed] = useState<{ url: string; message: string } | null>(null);
  const pdf = loaded?.url === url ? loaded.pdf : null;
  const error = failed?.url === url ? failed.message : null;
  const [width, setWidth] = useState(820);
  const [menu, setMenu] = useState<Menu | null>(null);

  useEffect(() => {
    // Cancelling a load rejects its promise ("Worker was destroyed"), and in
    // development every effect runs twice — so without this flag the first,
    // deliberately abandoned attempt reports itself as a failure to open.
    let live = true;
    const task = loadPdf(url);
    task.promise.then(
      (document) => live && setLoaded({ url, pdf: document }),
      (err: Error) =>
        live && setFailed({ url, message: err?.message ?? 'This document could not be opened.' }),
    );
    return () => {
      live = false;
      task.cancel();
    };
  }, [url]);

  // Fit the page to the pane, within reason. Measured rather than assumed, so
  // opening the thread sidebar reflows the page instead of clipping it.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    let timer = 0;
    const observer = new ResizeObserver(([entry]) => {
      const available = entry.contentRect.width - 48;
      const next = Math.max(320, Math.min(MAX_PAGE_WIDTH, available));
      // Settle before re-rasterising. Dragging a window edge fires this on
      // every frame, and each width is a full re-render of every visible page.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setWidth((current) => (current === next ? current : next)), 120);
    });
    observer.observe(element);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  const byPage = useMemo(() => {
    const map = new Map<number, AnnotationDto[]>();
    for (const annotation of annotations) {
      const list = map.get(annotation.anchor.page) ?? [];
      list.push(annotation);
      map.set(annotation.anchor.page, list);
    }
    return map;
  }, [annotations]);

  /** Which page is under the top of the viewport — the one the reader is on. */
  const trackPage = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const pageElements = Array.from(element.querySelectorAll<HTMLElement>('[data-page]'));
    const top = element.getBoundingClientRect().top + 80;
    const current = pageElements.find((page) => page.getBoundingClientRect().bottom > top);
    if (current?.dataset.page) onPageChange(Number(current.dataset.page), pageElements.length);
  }, [onPageChange]);

  // Report the count as soon as the document is known, not on first scroll —
  // a one-page document never scrolls, and "page 1 of ?" is not a page count.
  useEffect(() => {
    if (pdf) onPageChange(1, pdf.numPages);
  }, [pdf, onPageChange]);

  /** Scrolls a page's top to just under the pane's edge. */
  const scrollToPage = useCallback((page: number, offsetWithin = 0) => {
    const element = scroller.current;
    const target = element?.querySelector<HTMLElement>(`[data-page="${page}"]`);
    if (!element || !target) return;
    element.scrollTo({ top: target.offsetTop + offsetWithin - 16, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (goToPage) scrollToPage(goToPage.page);
  }, [goToPage, scrollToPage]);

  /** Places the menu against a box given in viewport coordinates. */
  const placeMenu = useCallback((rect: DOMRect, target: MenuTarget) => {
    const element = scroller.current;
    if (!element) return;
    const box = element.getBoundingClientRect();

    // Below the subject by default, above it when the pane's bottom edge is
    // closer than the menu is tall — otherwise the choices sit off-screen and
    // the reader has to scroll away from their own selection to reach them.
    const above = rect.bottom + MENU_HEIGHT + 8 > box.bottom;
    const top = above
      ? rect.top - box.top + element.scrollTop - MENU_HEIGHT - 8
      : rect.bottom - box.top + element.scrollTop + 8;

    // Clamped so a selection at the right-hand margin doesn't push the menu
    // out of the pane, where it would be clipped by the scroller.
    const rawLeft = rect.left - box.left + element.scrollLeft;
    const left = Math.max(8, Math.min(rawLeft, element.clientWidth - MENU_WIDTH - 8));

    setMenu({ top: Math.max(8, top), left, above, target });
  }, []);

  /**
   * Reads whatever is selected and offers the highlighter for it.
   *
   * Bound to the document rather than the scroller: a drag that ends over the
   * thread rail, the header, or past the window edge still ends a selection,
   * and dropping those was most of why marking a passage felt unreliable.
   */
  const readSelection = useCallback(() => {
    const root = pages.current;
    if (!root) return;

    const found = selectionAnchors(root);
    if (found.length === 0) {
      // Only a selection menu is dismissed here. One opened by clicking a
      // highlight has nothing to do with the selection that just collapsed.
      setMenu((current) => (current?.target.kind === 'selection' ? null : current));
      return;
    }

    const rects = window.getSelection()?.getRangeAt(0).getClientRects();
    const last = rects?.[rects.length - 1];
    if (!last) return;
    placeMenu(last, { kind: 'selection', anchors: found.map((selection) => selection.anchor) });
  }, [placeMenu]);

  useEffect(() => {
    // `pointerup` rather than a click handler on the pane, so a drag released
    // anywhere still counts; the timeout lets the browser finish settling the
    // selection before it is read.
    const onPointerUp = () => window.setTimeout(readSelection, 0);
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.shiftKey || event.key.startsWith('Arrow')) window.setTimeout(readSelection, 0);
    };
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [readSelection]);

  // Dismiss the menu on a click that isn't in it, and on Escape.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenu(null);
      window.getSelection()?.removeAllRanges();
    };
    const onDown = (event: MouseEvent) => {
      if (!(event.target as Element)?.closest?.('.veyra-highlight-menu')) setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [menu]);

  /*
   * Jumping to a comment lands on its *line*, not the top of its page. The
   * anchor's first rect is a fraction of the page box, so the offset is exact
   * even before that page has rendered — and a margin above it keeps the line
   * off the very edge of the pane, where it reads as cut off.
   */
  useEffect(() => {
    if (!scrollToAnnotation) return;
    const page = scroller.current?.querySelector<HTMLElement>(
      `[data-page="${scrollToAnnotation.anchor.page}"]`,
    );
    if (!page) return;
    const within = (scrollToAnnotation.anchor.rects[0]?.y ?? 0) * page.offsetHeight;
    scrollToPage(scrollToAnnotation.anchor.page, within - 104);
  }, [scrollToAnnotation, scrollToPage]);

  /**
   * Opens the menu on a highlight the reader clicked.
   *
   * A highlight that already carries a thread belongs to the rail, so it
   * selects there instead; one that doesn't has nowhere else to be acted on.
   */
  const openAnnotation = useCallback(
    (annotation: AnnotationDto) => {
      onAnnotationClick(annotation);
      /*
       * A highlight that already carries a thread belongs to the rail, which
       * is where its conversation is. One without a thread is necessarily the
       * reader's own — the list endpoint hides everyone else's bare markers —
       * so the menu can offer to act on it.
       */
      if (annotation.hasThread) {
        setMenu(null);
        return;
      }
      const page = scroller.current?.querySelector<HTMLElement>(
        `[data-page="${annotation.anchor.page}"]`,
      );
      const rect = annotation.anchor.rects[0];
      if (!page || !rect) return;
      const box = page.getBoundingClientRect();
      placeMenu(
        new DOMRect(
          box.left + rect.x * box.width,
          box.top + rect.y * box.height,
          rect.w * box.width,
          rect.h * box.height,
        ),
        { kind: 'annotation', annotation },
      );
    },
    [onAnnotationClick, placeMenu],
  );

  const pick = (color: AnnotationColor, withComment: boolean) => {
    if (!menu) return;
    if (menu.target.kind === 'annotation') {
      const { annotation } = menu.target;
      if (annotation.color !== color) onRecolour(annotation, color);
      if (withComment) onComment(annotation);
      setMenu(null);
      return;
    }
    // A selection spanning a page break is two highlights; the comment, if any,
    // belongs on the first, where the reader started.
    menu.target.anchors.forEach((anchor, index) =>
      onCreate({ color, anchor, withComment: withComment && index === 0 }),
    );
    window.getSelection()?.removeAllRanges();
    setMenu(null);
  };

  if (error) {
    return (
      <div style={{ padding: space['2xl'] }}>
        <Alert
          type="error"
          showIcon
          title="This document could not be opened"
          description={error}
        />
      </div>
    );
  }

  const current = menu?.target.kind === 'annotation' ? menu.target.annotation : null;

  return (
    <div
      ref={scroller}
      onScroll={trackPage}
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: colors.bgCanvas,
        padding: space.xl,
      }}
    >
      {pdf ? (
        <div ref={pages} style={{ display: 'grid', gap: space.lg, justifyContent: 'center' }}>
          {Array.from({ length: pdf.numPages }, (_, index) => (
            <PdfPage
              key={index + 1}
              pdf={pdf}
              pageNumber={index + 1}
              width={width}
              annotations={byPage.get(index + 1) ?? []}
              activeAnnotationId={activeAnnotationId}
              onAnnotationClick={openAnnotation}
              watermark={watermark}
            />
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: width, margin: '0 auto' }}>
          <Skeleton active paragraph={{ rows: 12 }} />
        </div>
      )}

      {menu ? (
        <div
          className="veyra-highlight-menu"
          role="toolbar"
          aria-label={current ? 'Highlight' : 'Highlight selection'}
          style={{
            position: 'absolute',
            top: menu.top,
            left: menu.left,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: space.xs,
            padding: space.xs,
            borderRadius: radius.lg,
            background: colors.bgSurfaceRaised,
            // A hairline as well as the shadow: the bar floats over white
            // paper, where a shadow alone leaves it without an edge.
            border: `1px solid ${colors.border}`,
            boxShadow: shadows.lg,
          }}
        >
          {HIGHLIGHT_COLORS.map((color) => {
            const on = current?.color === color;
            return (
              <Tooltip key={color} title={`${HIGHLIGHT_LABEL[color]} highlight`}>
                <button
                  type="button"
                  className="veyra-ink-dot"
                  aria-label={`${HIGHLIGHT_LABEL[color]} highlight`}
                  aria-pressed={current ? on : undefined}
                  onClick={() => pick(color, false)}
                  style={{
                    background: HIGHLIGHT_DOT[color],
                    // The ring sits outside the dot, so the picked colour reads
                    // as chosen without the three becoming three sizes.
                    boxShadow: on
                      ? `0 0 0 2px ${colors.bgSurfaceRaised}, 0 0 0 3px ${colors.textPrimary}`
                      : 'none',
                  }}
                />
              </Tooltip>
            );
          })}

          <span aria-hidden style={{ width: 1, height: 20, background: colors.divider }} />

          <MenuAction
            icon={<CommentIcon size={14} />}
            onClick={() => pick(current?.color ?? 'amber', true)}
          >
            Comment
          </MenuAction>

          {current ? (
            <MenuAction
              danger
              icon={<DeleteIcon size={14} />}
              onClick={() => {
                onDelete(current);
                setMenu(null);
              }}
            >
              Remove
            </MenuAction>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  /**
   * One labelled action in the bar.
   *
   * Icon *and* word, and a shape that lifts on hover: bare text in a floating
   * toolbar reads as a caption rather than something to press, which is how a
   * reader ends up clicking the coloured dots and never finding Comment at
   * all. The glyph gives it a target; the word says which one it is.
   */
  function MenuAction({
    children,
    icon,
    danger = false,
    onClick,
  }: {
    children: React.ReactNode;
    icon: React.ReactNode;
    danger?: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        className="veyra-menu-action"
        onClick={onClick}
        // Read back by `.veyra-menu-action:hover` in index.css.
        style={{
          borderRadius: radius.md,
          ['--veyra-action-fg' as string]: danger ? colors.danger : colors.textPrimary,
          ['--veyra-action-hover-bg' as string]: danger ? colors.dangerSubtle : colors.bgHover,
        }}
      >
        <span aria-hidden style={{ display: 'inline-flex', opacity: 0.75 }}>
          {icon}
        </span>
        {children}
      </button>
    );
  }
}
