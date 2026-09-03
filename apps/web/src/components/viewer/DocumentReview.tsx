import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Skeleton, Tooltip, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnnotationColor,
  AnnotationDto,
  CommentDto,
  Side,
  ThreadDto,
} from '@veyra/contracts';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { PdfView, type NewHighlight } from './PdfView';
import { ThreadPanel, type ThreadFilters } from './ThreadPanel';
import { PageNav } from './PageNav';
import { CloseIcon, UploadIcon } from '../icons';
import { useSession } from '../../app/session';
import { documentsApi, reviewApi } from '../../lib/api/endpoints';
import { messageOf } from '../../lib/errorMessage';
import { toBody } from '../../lib/commentBody';
import { annotationsQuery, contentQuery, documentQuery, qk, threadsQuery } from '../../lib/queries';

/**
 * The DOM's `document`, under a name this file can reach.
 *
 * `DocumentReview` calls its own query `document` — the thing on screen — and
 * that shadows the global inside the component. Renaming the query would be
 * the bigger lie: in here, "document" is the file.
 */
const dom = globalThis.document;

/** The thread a comment would become, drawn before the server agrees. */
function draftThread(
  annotation: AnnotationDto,
  text: string,
  authorName: string | null,
  documentVersionId: string,
  id: () => string,
): ThreadDto {
  const now = new Date().toISOString();
  return {
    id: id(),
    documentVersionId,
    annotationId: annotation.id,
    annotation,
    status: 'open',
    visibility: 'side',
    // Replaced wholesale by the server's row on success; nothing on the card
    // reads it in the meantime.
    authorSide: 'discloser',
    createdByParticipantId: '',
    createdByName: authorName,
    resolvedByName: null,
    resolvedAt: null,
    carriedFromVersionId: null,
    createdAt: now,
    comments: [
      {
        id: id(),
        threadId: '',
        authorParticipantId: '',
        authorName,
        body: toBody(text),
        mentions: [],
        createdAt: now,
        editedAt: null,
        deletedAt: null,
      },
    ],
  };
}

/**
 * Read a document, mark it up, and talk about it.
 *
 * The page and the rail are one object seen twice: a highlight on the page,
 * and its thread beside it. Selecting either selects the other, which is why
 * they live in one component rather than talking through a parent — the
 * selection is not the dossier's business.
 *
 * It renders as a pane, not a screen, so the dossier can put it where the file
 * listing was and keep the tree in place.
 */
export function DocumentReview({
  documentId,
  versionId: pinnedVersion,
  allowDownload,
  companies,
  onClose,
}: {
  documentId: string;
  /** Pins a specific version — a link to a comment opens what it was written on. */
  versionId?: string;
  allowDownload: boolean;
  /** The two sides' company names, for the byline under a commenter's name. */
  companies?: Partial<Record<Side, string>>;
  onClose?: () => void;
}) {
  const { colors, space } = useVeyraTokens();
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const me = useSession();

  const document = useQuery(documentQuery(documentId));
  const versionId = pinnedVersion ?? document.data?.currentVersion?.id;

  const content = useQuery({ ...contentQuery(versionId!), enabled: Boolean(versionId) });
  const annotations = useQuery({ ...annotationsQuery(versionId!), enabled: Boolean(versionId) });

  /*
   * Every thread on this version, filtered in the rail rather than in the
   * request: the filter chips carry counts, and a count can't be read off a
   * list the server already narrowed. One document's threads are few.
   */
  const threads = useQuery({ ...threadsQuery(versionId!), enabled: Boolean(versionId) });
  const [filters, setFilters] = useState<ThreadFilters>({ status: 'open' });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<AnnotationDto | null>(null);
  /**
   * The highlight the reader is writing their first comment about.
   *
   * A thread cannot exist without a comment, so this is the gap between
   * marking a passage and having something to say about it. It used to be
   * closed by opening the thread with the quoted passage as its first comment,
   * which produced a rail full of threads where someone appeared to have said
   * "documents" — the document quoting itself back, in the reader's name.
   */
  const [draft, setDraft] = useState<AnnotationDto | null>(null);
  const [{ page, pageCount }, setPosition] = useState({ page: 1, pageCount: 0 });
  /** Carries a nonce so asking for the page you're already on still moves. */
  const [goToPage, setGoToPage] = useState<{ page: number; at: number } | null>(null);

  /*
   * How long this document was actually open.
   *
   * "Viewed" is already logged when the file opens, and on its own it cannot
   * tell a misclick from an afternoon with a stability dossier — which is the
   * distinction the counterparty's reading is judged on. Only the browser
   * knows, so the reader's own clock reports on the way out, and the server
   * bounds what it will believe.
   *
   * Hidden time is not counted: a tab left open behind other windows is not
   * reading, and counting it would make the one number here that is supposed
   * to mean attention mean nothing at all.
   */
  const readTimer = useRef<{ since: number | null; total: number }>({ since: null, total: 0 });

  useEffect(() => {
    if (!versionId) return;
    const clock = { since: dom.visibilityState === 'visible' ? Date.now() : null, total: 0 };
    readTimer.current = clock;

    const bank = () => {
      if (clock.since === null) return;
      clock.total += (Date.now() - clock.since) / 1000;
      clock.since = null;
    };
    const onVisibility = () => {
      if (dom.visibilityState === 'visible') clock.since ??= Date.now();
      else bank();
    };
    const report = () => {
      bank();
      const seconds = Math.round(clock.total);
      clock.total = 0;
      if (seconds >= 1) documentsApi.recordView(versionId, seconds);
    };

    dom.addEventListener('visibilitychange', onVisibility);
    // `pagehide` rather than `unload`, which a bfcache-eligible page never fires.
    window.addEventListener('pagehide', report);
    return () => {
      dom.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', report);
      // Closing the document, or opening another, is also the end of a read.
      report();
    };
  }, [versionId]);

  const jumpTo = useCallback((next: number) => {
    setGoToPage({ page: next, at: Date.now() });
  }, []);

  const onPageChange = useCallback(
    (current: number, total: number) => setPosition({ page: current, pageCount: total }),
    [],
  );

  const refresh = useCallback(() => {
    if (!versionId) return;
    void queryClient.invalidateQueries({ queryKey: qk.annotations(versionId) });
    void queryClient.invalidateQueries({ queryKey: ['versions', versionId, 'threads'] });
  }, [queryClient, versionId]);

  const fail = useCallback(
    (fallback: string) => (error: unknown) => message.error(messageOf(error, fallback)),
    [message],
  );

  /*
   * Every mutation here draws its result before the server has confirmed it.
   *
   * Marking a passage is a gesture, not a transaction: the reader drags, lets
   * go, and expects ink. Waiting for a POST and two refetches before anything
   * appears turned every highlight into a half-second of wondering whether the
   * click had landed, and made a comment feel slower to leave than to write.
   * So the caches are patched first and reconciled after, and a failure rolls
   * the patch back and says so.
   */
  const annotationsKey = qk.annotations(versionId ?? '');
  const threadsKey = qk.threads(versionId ?? '', {});

  const patchAnnotations = useCallback(
    (update: (current: AnnotationDto[]) => AnnotationDto[]) => {
      queryClient.setQueryData<AnnotationDto[]>(annotationsKey, (current) => update(current ?? []));
    },
    [annotationsKey, queryClient],
  );

  const patchThreads = useCallback(
    (update: (current: ThreadDto[]) => ThreadDto[]) => {
      queryClient.setQueryData<ThreadDto[]>(threadsKey, (current) => update(current ?? []));
    },
    [queryClient, threadsKey],
  );

  /** Snapshot both caches, so any handler can put them back as they were. */
  const snapshot = useCallback(async () => {
    await queryClient.cancelQueries({ queryKey: annotationsKey });
    await queryClient.cancelQueries({ queryKey: threadsKey });
    return {
      annotations: queryClient.getQueryData<AnnotationDto[]>(annotationsKey),
      threads: queryClient.getQueryData<ThreadDto[]>(threadsKey),
    };
  }, [annotationsKey, queryClient, threadsKey]);

  const rollback = useCallback(
    (previous?: { annotations?: AnnotationDto[]; threads?: ThreadDto[] }) => {
      if (!previous) return;
      queryClient.setQueryData(annotationsKey, previous.annotations);
      queryClient.setQueryData(threadsKey, previous.threads);
    },
    [annotationsKey, queryClient, threadsKey],
  );

  /** Distinguishes a row we invented from one the server has seen. */
  const pendingId = () => `pending:${Math.random().toString(36).slice(2)}`;
  const isPending = (id: string) => id.startsWith('pending:');

  /*
   * The in-flight creation behind an optimistic highlight. The composer opens
   * on a highlight that does not exist yet, so a reader who types quickly can
   * submit before the id is known — the thread waits on this rather than
   * posting against an id we made up.
   */
  const settling = useRef<Promise<AnnotationDto> | null>(null);

  const createAnnotation = useMutation({
    mutationFn: ({ color, anchor }: NewHighlight) =>
      reviewApi.createAnnotation(versionId!, { color, anchorType: 'text_quote', anchor }),
    onMutate: async ({ color, anchor, withComment }: NewHighlight) => {
      const previous = await snapshot();
      const optimistic: AnnotationDto = {
        id: pendingId(),
        documentVersionId: versionId!,
        color,
        anchorType: 'text_quote',
        anchor,
        authorParticipantId: '',
        authorName: me?.name ?? null,
        hasThread: false,
        createdAt: new Date().toISOString(),
      };
      patchAnnotations((current) => [...current, optimistic]);
      if (withComment) startDraft(optimistic);
      return { previous, optimistic };
    },
    onSuccess: (saved, _input, context) => {
      patchAnnotations((current) =>
        current.map((entry) => (entry.id === context?.optimistic.id ? saved : entry)),
      );
      // The composer was opened on the placeholder; point it at the real row.
      setDraft((current) => (current?.id === context?.optimistic.id ? saved : current));
    },
    onError: (error, _input, context) => {
      rollback(context?.previous);
      setDraft((current) => (current?.id === context?.optimistic.id ? null : current));
      fail('The highlight could not be saved.')(error);
    },
    onSettled: refresh,
  });

  /*
   * Recolouring is create-then-delete, because annotations have no update
   * route. In that order on purpose: a failure part-way leaves a duplicate the
   * reader can remove, rather than losing the mark they made.
   */
  const recolour = useMutation({
    mutationFn: async ({
      annotation,
      color,
    }: {
      annotation: AnnotationDto;
      color: AnnotationColor;
    }) => {
      const replacement = await reviewApi.createAnnotation(versionId!, {
        color,
        anchorType: annotation.anchorType,
        anchor: annotation.anchor,
      });
      await reviewApi.deleteAnnotation(annotation.id);
      return replacement;
    },
    onMutate: async ({ annotation, color }) => {
      const previous = await snapshot();
      patchAnnotations((current) =>
        current.map((entry) => (entry.id === annotation.id ? { ...entry, color } : entry)),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      rollback(context?.previous);
      fail('The highlight could not be recoloured.')(error);
    },
    onSettled: refresh,
  });

  const deleteAnnotation = useMutation({
    mutationFn: (annotation: AnnotationDto) => reviewApi.deleteAnnotation(annotation.id),
    onMutate: async (annotation) => {
      const previous = await snapshot();
      patchAnnotations((current) => current.filter((entry) => entry.id !== annotation.id));
      return { previous };
    },
    onError: (error, _input, context) => {
      rollback(context?.previous);
      fail('The highlight could not be removed.')(error);
    },
    onSettled: refresh,
  });

  const createThread = useMutation({
    mutationFn: async ({ annotation, text }: { annotation: AnnotationDto; text: string }) => {
      // Wait out the highlight this thread hangs on, if it is still in flight.
      const target = isPending(annotation.id) ? ((await settling.current) ?? annotation) : annotation;
      return reviewApi.createThread(versionId!, {
        annotationId: target.id,
        visibility: 'side',
        body: toBody(text),
      });
    },
    onMutate: async ({ annotation, text }) => {
      const previous = await snapshot();
      const optimistic = draftThread(annotation, text, me?.name ?? null, versionId!, pendingId);
      patchThreads((current) => [...current, optimistic]);
      patchAnnotations((current) =>
        current.map((entry) =>
          entry.id === annotation.id ? { ...entry, hasThread: true } : entry,
        ),
      );
      // The rail shows the thread the moment it is written, so the composer
      // has already done its job.
      setDraft(null);
      setFilters((state) => ({ ...state, status: 'open', color: undefined }));
      setActiveThreadId(optimistic.id);
      return { previous, optimistic };
    },
    onSuccess: (saved, _input, context) => {
      patchThreads((current) =>
        current.map((entry) => (entry.id === context?.optimistic.id ? saved : entry)),
      );
      setActiveThreadId((current) => (current === context?.optimistic.id ? saved.id : current));
    },
    onError: (error, input, context) => {
      rollback(context?.previous);
      setActiveThreadId(null);
      // Give the reader their words back rather than making them retype.
      setDraft(input.annotation);
      fail('The comment could not be posted.')(error);
    },
    onSettled: refresh,
  });

  const addComment = useMutation({
    mutationFn: ({ threadId, text }: { threadId: string; text: string }) =>
      reviewApi.addComment(threadId, { body: toBody(text) }),
    onMutate: async ({ threadId, text }) => {
      const previous = await snapshot();
      const optimistic: CommentDto = {
        id: pendingId(),
        threadId,
        authorParticipantId: '',
        authorName: me?.name ?? null,
        body: toBody(text),
        mentions: [],
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
      };
      patchThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, comments: [...thread.comments, optimistic] }
            : thread,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      rollback(context?.previous);
      fail('The comment could not be posted.')(error);
    },
    onSettled: refresh,
  });

  const updateThread = useMutation({
    mutationFn: ({
      thread,
      ...body
    }: {
      thread: ThreadDto;
      status?: 'open' | 'resolved';
      visibility?: 'room';
    }) => reviewApi.updateThread(thread.id, body),
    onMutate: async ({ thread, status, visibility }) => {
      const previous = await snapshot();
      patchThreads((current) =>
        current.map((entry) =>
          entry.id === thread.id
            ? {
                ...entry,
                status: status ?? entry.status,
                visibility: visibility ?? entry.visibility,
                resolvedAt:
                  status === 'resolved' ? new Date().toISOString() : status ? null : entry.resolvedAt,
              }
            : entry,
        ),
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      rollback(context?.previous);
      fail('The thread could not be updated.')(error);
    },
    onSettled: refresh,
  });

  const list = useMemo(() => threads.data ?? [], [threads.data]);
  const activeAnnotationId =
    draft?.id ?? list.find((thread) => thread.id === activeThreadId)?.annotationId ?? null;

  /** Opens the composer on a highlight, and makes sure the reader can see it. */
  function startDraft(annotation: AnnotationDto) {
    setActiveThreadId(null);
    setDraft(annotation);
  }

  const openAnnotation = (annotation: AnnotationDto) => {
    const owning = list.find((thread) => thread.annotationId === annotation.id);
    if (!owning) {
      // No thread on it yet — the page's own menu offers to start one.
      setDraft((current) => (current?.id === annotation.id ? current : null));
      return;
    }
    setActiveThreadId(owning.id);
    setDraft(null);
    /*
     * Widen only as far as this thread needs. Clearing every filter to reveal
     * one thread throws away a narrowing the reader chose on purpose, and on a
     * document with a hundred threads that is a worse surprise than the click
     * appearing to do nothing.
     */
    setFilters((current) => ({
      status: current.status && current.status !== owning.status ? undefined : current.status,
    }));
  };

  const version = document.data?.versions.find((entry) => entry.id === versionId);
  // A non-PDF has no rendition to show yet — the conversion job (D2) is what
  // will produce one, and until then there is nothing to highlight *on*.
  const readable = version?.renderStatus === 'ready';

  return (
    <div style={{ display: 'flex', minHeight: 0, height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          style={{
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: space.md,
            padding: `${space.sm}px ${space.lg}px`,
          }}
        >
          <Stack gap="none" style={{ flex: 1, minWidth: 0 }}>
            <Typography.Paragraph ellipsis style={{ margin: 0, fontWeight: 600 }}>
              {document.data?.name ?? 'Document'}
            </Typography.Paragraph>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {version ? `v${version.versionNo}` : '—'}
            </Typography.Text>
          </Stack>

          {readable && pageCount > 0 ? (
            <PageNav page={page} pageCount={pageCount} onJump={jumpTo} />
          ) : null}
          {allowDownload && versionId ? (
            <Tooltip title="Download the original">
              <Button
                size="small"
                icon={<UploadIcon style={{ transform: 'rotate(180deg)' }} />}
                onClick={() => window.open(`/api/document-versions/${versionId}/download`)}
              >
                Download
              </Button>
            </Tooltip>
          ) : null}
          {onClose ? (
            /*
             * A cross and the word, on a ground of its own — the way a task
             * panel closes in ClickUp or Linear. Prominence comes from the
             * filled pill and the ring around it rather than from size: it is
             * the same height as Download beside it, and quieter in weight,
             * because leaving the document is not a peer of acting on it.
             */
            <button
              type="button"
              onClick={onClose}
              className="veyra-viewer-close"
              aria-label="Close the document"
              title="Close the document"
              // Read back by `.veyra-viewer-close` in index.css.
              style={{
                ['--veyra-close-fg' as string]: colors.textPrimary,
                ['--veyra-close-bg' as string]: colors.bgHover,
                ['--veyra-close-ring' as string]: colors.border,
                ['--veyra-close-hover-fg' as string]: colors.textPrimary,
                ['--veyra-close-hover-bg' as string]: colors.bgWash,
              }}
            >
              <CloseIcon size={13} />
              <span>Close</span>
            </button>
          ) : null}
        </div>

        {document.isPending || (versionId && content.isPending) ? (
          <div style={{ flex: 1, padding: space.xl }}>
            <Skeleton active paragraph={{ rows: 10 }} />
          </div>
        ) : !versionId ? (
          <Note text="This document has no versions yet." />
        ) : !readable ? (
          <Note text="This file is still being prepared for reading. Highlights and comments open once it is ready." />
        ) : content.data ? (
          <PdfView
            url={content.data.url}
            annotations={annotations.data ?? []}
            activeAnnotationId={activeAnnotationId}
            onAnnotationClick={openAnnotation}
            onCreate={(highlight) => {
              const saving = createAnnotation.mutateAsync(highlight);
              // Held so a comment written before the POST lands can wait for
              // the real id; the mutation's own onError does the reporting.
              if (highlight.withComment) settling.current = saving;
              void saving.catch(() => undefined);
            }}
            onRecolour={(annotation, color) => recolour.mutate({ annotation, color })}
            onDelete={(annotation) => {
              if (draft?.id === annotation.id) setDraft(null);
              deleteAnnotation.mutate(annotation);
            }}
            onComment={startDraft}
            onPageChange={onPageChange}
            scrollToAnnotation={scrollTo}
            watermark={content.data.watermark}
            goToPage={goToPage}
          />
        ) : (
          <Note text="This document could not be opened." />
        )}
      </div>

      {readable ? (
        <div style={{ borderInlineStart: `1px solid ${colors.divider}`, display: 'flex', minHeight: 0 }}>
          <ThreadPanel
            threads={list}
            loading={threads.isPending}
            error={threads.error ? messageOf(threads.error, 'Comments could not be loaded.') : null}
            filters={filters}
            onFiltersChange={setFilters}
            activeThreadId={activeThreadId}
            onDeselect={() => setActiveThreadId(null)}
            draft={draft}
            onDraftSubmit={(text) => draft && createThread.mutate({ annotation: draft, text })}
            onDraftCancel={() => {
              // The highlight stays. Deciding not to write a comment is not
              // the same as deciding not to have marked the passage.
              setDraft(null);
            }}
            draftBusy={createThread.isPending}
            companies={companies}
            onSelect={(thread) => {
              setActiveThreadId(thread.id);
              setDraft(null);
              // A fresh object each time, so clicking the open thread again
              // takes you back to its line rather than doing nothing.
              if (thread.annotation) setScrollTo({ ...thread.annotation });
            }}
            onReply={(threadId, text) => addComment.mutate({ threadId, text })}
            onResolve={(thread) => {
              const status = thread.status === 'resolved' ? 'open' : 'resolved';
              /*
               * Widen the filter to whatever the thread is about to become.
               * Resolving while the rail shows only open threads makes the
               * card vanish under the cursor, which reads as the button
               * having thrown the conversation away rather than settled it.
               */
              setFilters((current) =>
                current.status && current.status !== status
                  ? { ...current, status: undefined }
                  : current,
              );
              updateThread.mutate({ thread, status });
            }}
            onVisibility={(thread) => updateThread.mutate({ thread, visibility: 'room' })}
            busy={addComment.isPending || updateThread.isPending}
            document={document.data}
            version={version}
          />
        </div>
      ) : null}
    </div>
  );

  function Note({ text }: { text: string }) {
    return (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: space['2xl'] }}>
        <Typography.Text type="secondary" style={{ maxWidth: 380, textAlign: 'center' }}>
          {text}
        </Typography.Text>
      </div>
    );
  }
}
