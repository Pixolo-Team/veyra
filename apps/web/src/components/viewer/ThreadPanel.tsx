import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Empty, Input, Segmented, Skeleton, Tag, Tooltip, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type {
  AnnotationDto,
  DocumentDetail,
  DocumentVersionDto,
  Side,
  ThreadDto,
  ThreadStatus,
} from '@veyra/contracts';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { bodyText } from '../../lib/commentBody';
import { relativeTime } from '../../lib/relativeTime';
import { formatBytes } from '../../lib/tree';
import { CloseIcon, EyeIcon, ReopenIcon, ReplyIcon, ResolveIcon } from '../icons';
import { HIGHLIGHT_DOT } from './highlightColors';

/*
 * Sharing a thread with the counterparty cannot be undone, and the flow around
 * it isn't settled — so the action is held back rather than shipped as a
 * button that is one mis-click from irreversible. The prop stays wired so
 * turning it back on is this line.
 */
const SHOW_SHARE = false;

export interface ThreadFilters {
  status?: ThreadStatus;
}

const STATUSES: { value: ThreadStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

/** First letter of a name, or a dash when we don't have one. */
function initial(name: string | null | undefined): string {
  const letter = (name ?? '').trim().charAt(0);
  return letter ? letter.toUpperCase() : '—';
}

/**
 * The rail beside the page: what people said about this document, what it is,
 * and what versions of it exist.
 *
 * Threads rather than a flat comment list, because a data-room comment is
 * almost always about a *place* in a document — the rail and the page are two
 * views of one object, so selecting either selects the other.
 */
export function ThreadPanel({
  threads,
  loading,
  error,
  filters,
  onFiltersChange,
  activeThreadId,
  onDeselect,
  draft,
  onDraftSubmit,
  onDraftCancel,
  draftBusy,
  onSelect,
  onReply,
  onResolve,
  onVisibility,
  busy,
  companies,
  document,
  version,
}: {
  threads: ThreadDto[];
  loading: boolean;
  error: string | null;
  filters: ThreadFilters;
  onFiltersChange: (filters: ThreadFilters) => void;
  activeThreadId: string | null;
  /** Collapses the open thread without changing it. */
  onDeselect: () => void;
  /** A highlight waiting for the comment that will open its thread. */
  draft: AnnotationDto | null;
  onDraftSubmit: (text: string) => void;
  onDraftCancel: () => void;
  draftBusy: boolean;
  onSelect: (thread: ThreadDto) => void;
  onReply: (threadId: string, text: string) => void;
  onResolve: (thread: ThreadDto) => void;
  onVisibility: (thread: ThreadDto) => void;
  busy: boolean;
  /** Company name per side, for the line under an author's name. */
  companies?: Partial<Record<Side, string>>;
  document: DocumentDetail | undefined;
  /** The version on screen — not necessarily the current one. */
  version: DocumentVersionDto | undefined;
}) {
  const { colors, radius, space } = useVeyraTokens();
  const [tab, setTab] = useState<'comments' | 'attributes' | 'document'>('comments');

  /*
   * Filtering happens here rather than in the request. A count on a chip has to
   * be the number of threads that choice *would* leave, which can't be known
   * from a list the server has already narrowed — and one document's threads
   * are few enough that fetching them all beats the round trip.
   */
  const counts = useMemo(
    () => ({
      all: threads.length,
      open: threads.filter((thread) => thread.status === 'open').length,
      resolved: threads.filter((thread) => thread.status === 'resolved').length,
    }),
    [threads],
  );

  const visible = useMemo(
    () =>
      threads.filter((thread) => !filters.status || thread.status === filters.status),
    [threads, filters],
  );

  /*
   * Read back by `.veyra-comment-box` in index.css. Passed as custom
   * properties rather than an antd theme override because only these two
   * boxes want it — an input inside a dialog still wants to look like an
   * input.
   */
  const commentBox: React.CSSProperties = {
    ['--veyra-box-border' as string]: 'transparent',
    ['--veyra-box-border-hover' as string]: colors.border,
    ['--veyra-box-border-focus' as string]: colors.brandBorder,
    ['--veyra-box-bg' as string]: colors.bgSurface,
    ['--veyra-box-bg-focus' as string]: colors.bgSurface,
  };

  const scroller: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    padding: `0 ${space.md}px ${space.md}px`,
  };

  return (
    <aside
      aria-label="Document rail"
      style={{
        width: 340,
        flex: '0 0 340px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: colors.bgSurface,
      }}
    >
      <div style={{ flex: '0 0 auto', padding: space.md, paddingBottom: space.sm }}>
        <Segmented<'comments' | 'attributes' | 'document'>
          block
          size="small"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'comments', label: `Comments${counts.all ? ` · ${counts.all}` : ''}` },
            { value: 'attributes', label: 'Attributes' },
            { value: 'document', label: 'Document' },
          ]}
        />
      </div>

      {tab === 'comments' ? (
        <>
          <FilterRow />
          <div style={scroller}>
            {error ? <Alert type="error" showIcon title={error} /> : null}
            {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : null}

            {draft ? <DraftCard annotation={draft} /> : null}

            {!loading && !error && !draft && visible.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {counts.all === 0
                      ? 'Select text in the document and choose Comment.'
                      : 'No threads match these filters.'}
                  </Typography.Text>
                }
              />
            ) : null}

            <Stack gap="sm" style={{ marginTop: draft ? space.sm : 0 }}>
              {visible.map((thread) => (
                <ThreadCard key={thread.id} thread={thread} />
              ))}
            </Stack>
          </div>
          <div style={{ flex: '0 0 auto', padding: `${space.sm}px ${space.md}px` }}>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, lineHeight: 1.4, display: 'block' }}
            >
              Side threads stay with your own side. Shared threads are visible to the
              counterparty, and cannot be unshared.
            </Typography.Text>
          </div>
        </>
      ) : tab === 'attributes' ? (
        <div style={scroller}>
          <Facts
            rows={[
              ['File', document?.name],
              ['Version', version ? `v${version.versionNo}` : undefined],
              ['Type', version?.mimeType],
              ['Size', version ? formatBytes(version.byteSize) : undefined],
              ['Pages', version?.pageCount ? String(version.pageCount) : undefined],
              ['Added', version ? (relativeTime(version.createdAt) ?? undefined) : undefined],
              ['Rendition', version?.renderStatus],
              // The eCTD metadata the design shows — submission type, tracking
              // number, operation — isn't modelled yet, so it is absent rather
              // than invented. Inventing it is how a demo becomes a promise.
              ['Checksum', version?.checksumSha256?.slice(0, 16)],
            ]}
          />
        </div>
      ) : (
        <div style={scroller}>
          <Stack gap="sm">
            <Caption>Versions</Caption>
            {(document?.versions ?? [])
              .slice()
              .sort((a, b) => b.versionNo - a.versionNo)
              .map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: space.sm,
                    borderRadius: radius.md,
                    background: entry.id === version?.id ? colors.bgWash : colors.bgHover,
                  }}
                >
                  <div style={{ display: 'flex', gap: space.xs, alignItems: 'center' }}>
                    <Typography.Text strong style={{ fontSize: 13, flex: 1 }}>
                      v{entry.versionNo}
                    </Typography.Text>
                    {entry.id === version?.id ? <Tag color="blue">Showing</Tag> : null}
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {formatBytes(entry.byteSize)} · {relativeTime(entry.createdAt) ?? '—'}
                  </Typography.Text>
                </div>
              ))}
          </Stack>
        </div>
      )}
    </aside>
  );

  /**
   * One filter row, not a second bar of tabs.
   *
   * Open/Resolved in a full-width segmented control read as sub-navigation — a
   * level *below* Comments/Attributes/Document — when it is only a way of
   * narrowing one list. Chips with counts also say how much each choice hides
   * before it is made.
   */
  function FilterRow() {
    return (
      <div
        style={{
          flex: '0 0 auto',
          padding: `0 ${space.md}px ${space.sm}px`,
          display: 'flex',
          alignItems: 'center',
          gap: space.xs,
          flexWrap: 'wrap',
        }}
      >
        {STATUSES.map(({ value, label }) => {
          const on = (filters.status ?? 'all') === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              onClick={() =>
                onFiltersChange({ ...filters, status: value === 'all' ? undefined : value })
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: `0 ${space.sm}px`,
                borderRadius: radius.pill,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: on ? 600 : 400,
                color: on ? colors.brand : colors.textSecondary,
                background: on ? colors.brandSubtle : colors.bgHover,
              }}
            >
              {label}
              <span style={{ color: on ? colors.brand : colors.textTertiary }}>{counts[value]}</span>
            </button>
          );
        })}

      </div>
    );
  }

  /**
   * The composer that turns a highlight into a thread.
   *
   * It sits in the rail rather than in a popover on the page because that is
   * where the comment is about to live, and because a first comment on a
   * regulatory document is rarely one line — a box that grows beats a bubble
   * that scrolls. The passage is shown above it as the quote it is, so nobody
   * has to retype what they just selected in order to refer to it.
   */
  function DraftCard({ annotation }: { annotation: AnnotationDto }) {
    const [text, setText] = useState('');
    const box = useRef<TextAreaRef>(null);
    const quote = annotation.anchor.quote?.exact;

    // Focused on open: the reader asked for this box by pressing Comment, and
    // making them click it again is a step that says nothing.
    useEffect(() => {
      box.current?.focus();
    }, []);

    const send = () => {
      const value = text.trim();
      if (value) onDraftSubmit(value);
    };

    return (
      <div
        style={{
          padding: space.md,
          borderRadius: radius.lg,
          background: colors.bgWash,
          // A hairline and a tinted ground, not a 2px ring. The composer is
          // already the only thing in the rail with a cursor in it.
          border: `1px solid ${colors.brandBorder}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space.xs,
            marginBottom: space.sm,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              flex: '0 0 8px',
              background: HIGHLIGHT_DOT[annotation.color],
            }}
          />
          <Typography.Text strong style={{ fontSize: 13, flex: 1 }}>
            New comment
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            p.{annotation.anchor.page}
          </Typography.Text>
          {/* Discarding the draft belongs in the corner of the thing being
              discarded, not beside the button that would post it — a Cancel
              the width of Comment invited the wrong click, and the two words
              read as a choice between equals when only one of them writes
              anything down. */}
          <Tooltip title="Discard this comment">
            <Button
              intent="ghost"
              size="small"
              shape="circle"
              aria-label="Discard this comment"
              icon={<CloseIcon size={12} />}
              onClick={onDraftCancel}
              disabled={draftBusy}
              style={{
                // Pulled into the card's own padding so the cross sits on the
                // corner rather than a step inside it.
                marginInlineEnd: -space.xs,
                marginBlock: -space.xs,
                color: colors.textSecondary,
              }}
            />
          </Tooltip>
        </div>

        {quote ? (
          <Typography.Paragraph
            ellipsis={{ rows: 3, tooltip: quote }}
            style={{
              margin: `0 0 ${space.sm}px`,
              paddingInlineStart: space.sm,
              borderInlineStart: `2px solid ${HIGHLIGHT_DOT[annotation.color]}`,
              fontSize: 12,
              fontStyle: 'italic',
              color: colors.textSecondary,
            }}
          >
            {quote}
          </Typography.Paragraph>
        ) : null}

        <Stack gap="xs">
          <Input.TextArea
            ref={box}
            className="veyra-comment-box"
            style={commentBox}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="What about this passage?"
            autoSize={{ minRows: 3, maxRows: 10 }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                send();
              }
              if (event.key === 'Escape') onDraftCancel();
            }}
          />
          <div style={{ display: 'flex', marginTop: space.xs }}>
            <Button
              intent="primary"
              size="small"
              icon={<ReplyIcon size={14} />}
              loading={draftBusy}
              disabled={!text.trim()}
              onClick={send}
            >
              Comment
            </Button>
          </div>
        </Stack>
      </div>
    );
  }

  function Caption({ children }: { children: React.ReactNode }) {
    return (
      <Typography.Text
        type="secondary"
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {children}
      </Typography.Text>
    );
  }

  /** Key/value rows. Anything we don't hold is left out, not guessed. */
  function Facts({ rows }: { rows: [label: string, value: string | undefined][] }) {
    return (
      <Stack gap="xs">
        {rows
          .filter(([, value]) => Boolean(value))
          .map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: space.sm, alignItems: 'baseline' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, flex: '0 0 92px' }}>
                {label}
              </Typography.Text>
              <Typography.Text style={{ fontSize: 12, flex: 1, wordBreak: 'break-word' }}>
                {value}
              </Typography.Text>
            </div>
          ))}
      </Stack>
    );
  }

  function ThreadCard({ thread }: { thread: ThreadDto }) {
    const [draft, setDraft] = useState('');
    const card = useRef<HTMLDivElement>(null);
    const active = thread.id === activeThreadId;

    // Selecting a highlight on the page selects its thread here; if that card
    // is a hundred threads down the rail, saying so off-screen is not saying
    // it at all.
    useEffect(() => {
      if (active) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [active]);
    const resolved = thread.status === 'resolved';
    const shared = thread.visibility === 'room';
    const quote = thread.annotation?.anchor.quote?.exact;
    const opened = thread.comments[0];
    const company = companies?.[thread.authorSide] ?? null;

    const send = () => {
      const text = draft.trim();
      if (!text) return;
      onReply(thread.id, text);
      setDraft('');
    };

    return (
      <div
        ref={card}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(thread)}
        onKeyDown={(event) => event.key === 'Enter' && onSelect(thread)}
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          cursor: 'pointer',
          background: active ? colors.bgWash : colors.bgHover,
          // Selection reads from the ground and a hairline. A 2px ring around
          // a card that is already a different colour is the same thing said
          // twice, loudly.
          border: `1px solid ${active ? colors.brandBorder : 'transparent'}`,
        }}
      >
        {/* Who said it, on whose behalf, and when — stacked, because in a
            deal room "which side is this person on" is read as often as their
            name, and a single line has room for one of the two. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: space.sm,
            marginBottom: space.md,
          }}
        >
          {/* One initial, not a photograph: a data room has no avatars to
              upload, and a coloured disc with a letter identifies a person at
              this size better than a generic silhouette. The ring carries the
              highlight colour the loose dot used to. */}
          <Avatar
            name={thread.createdByName}
            ring={thread.annotation ? HIGHLIGHT_DOT[thread.annotation.color] : undefined}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Text strong style={{ fontSize: 13, display: 'block' }} ellipsis>
              {thread.createdByName ?? 'Someone'}
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, display: 'block', lineHeight: 1.5 }}
              ellipsis
            >
              {company ? `${company} · ` : ''}
              {thread.annotation ? (
                <Tooltip title="Go to this passage">
                  {/* Selecting the card already jumps; this makes the jump the
                      visible promise rather than a side effect of clicking. */}
                  <span style={{ color: colors.brand, cursor: 'pointer' }}>
                    p.{thread.annotation.anchor.page}
                  </span>
                </Tooltip>
              ) : null}
              {thread.annotation ? ' · ' : ''}
              {relativeTime(opened?.createdAt ?? thread.createdAt) ?? 'just now'}
            </Typography.Text>
          </div>
          {resolved ? <Tag color="green">Resolved</Tag> : null}
          {shared ? <Tag color="blue">Shared</Tag> : null}
        </div>

        {quote ? (
          <Typography.Paragraph
            ellipsis={{ rows: 2, tooltip: quote }}
            style={{
              margin: `0 0 ${space.md}px`,
              paddingInlineStart: space.sm,
              borderInlineStart: `2px solid ${
                thread.annotation ? HIGHLIGHT_DOT[thread.annotation.color] : colors.border
              }`,
              fontSize: 12,
              fontStyle: 'italic',
              color: colors.textSecondary,
            }}
          >
            {quote}
          </Typography.Paragraph>
        ) : null}

        {/* Collapsed, a thread shows its latest word and how many led to it —
            enough to decide whether to open it, without becoming a wall. */}
        {active ? (
          <Stack gap="md">
            {thread.comments.map((comment, index) => (
              // The first comment's byline is the card's own header, one line
              // up. Printing it again under the text is the same sentence
              // twice in a rail 340px wide.
              <Comment key={comment.id} comment={comment} byline={index > 0} />
            ))}
          </Stack>
        ) : (
          <>
            <Comment comment={thread.comments[thread.comments.length - 1]} clamp />
            {thread.comments.length > 1 ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {thread.comments.length} comments
              </Typography.Text>
            ) : null}
          </>
        )}

        {active ? (
          <Stack
            gap="xs"
            style={{ marginTop: space.lg }}
            onClick={(event) => event.stopPropagation()}
          >
            <Input.TextArea
              className="veyra-comment-box"
              style={commentBox}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Reply"
              autoSize={{ minRows: 2, maxRows: 6 }}
              // ⌘/Ctrl+Enter sends; plain Enter is a newline, because a comment
              // on a regulatory document is usually more than one line.
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <div
              style={{
                display: 'flex',
                gap: space.xs,
                alignItems: 'center',
                // One line, always. Three labelled buttons only just fit a
                // 340px rail, and a wrapped Close reads as a second row of
                // chrome under a thread that is mostly text.
                flexWrap: 'nowrap',
                // The composer and its actions are two steps, not one control:
                // the gap is what says the box is finished before the buttons
                // begin.
                marginTop: space.md,
              }}
            >
              <Button
                intent="primary"
                size="small"
                icon={<ReplyIcon size={14} />}
                loading={busy}
                disabled={!draft.trim()}
                onClick={send}
              >
                Reply
              </Button>

              {/* Filled, not outlined. Three bordered pills in a 340px rail
                  read as a form; a tinted ground carries "this one is the
                  affirmative action" with less ink. Green only on the action
                  that closes something — reopening is deliberately neutral. */}
              <Tooltip title={resolved ? 'Reopen this thread' : 'Resolve this thread'}>
                <Button
                  intent="tertiary"
                  size="small"
                  aria-pressed={resolved}
                  icon={resolved ? <ReopenIcon size={14} /> : <ResolveIcon size={14} />}
                  onClick={() => onResolve(thread)}
                  disabled={busy}
                  style={
                    resolved
                      ? undefined
                      : { color: colors.success, background: colors.successSubtle }
                  }
                >
                  {resolved ? 'Reopen' : 'Resolve'}
                </Button>
              </Tooltip>

              {SHOW_SHARE && !shared ? (
                <Tooltip title="Makes this thread visible to the counterparty. This cannot be undone.">
                  <Button
                    intent="tertiary"
                    size="small"
                    icon={<EyeIcon size={14} />}
                    onClick={() => onVisibility(thread)}
                    disabled={busy}
                  >
                    Share
                  </Button>
                </Tooltip>
              ) : null}

              {/* Collapsing the card changes nothing about the thread, so it
                  is the quietest control here and sits away from the two that
                  do — far enough right that Close is never the neighbour of
                  Resolve under a fast cursor. */}
              <Tooltip title="Collapse this thread">
                <Button
                  intent="ghost"
                  size="small"
                  icon={<CloseIcon size={12} />}
                  onClick={onDeselect}
                  disabled={busy}
                  style={{
                    marginInlineStart: 'auto',
                    paddingInline: space.sm,
                    color: colors.textSecondary,
                  }}
                >
                  Close
                </Button>
              </Tooltip>
            </div>
          </Stack>
        ) : null}
      </div>
    );
  }

  /** A person, at rail size: their initial on a tinted disc. */
  function Avatar({ name, ring }: { name?: string | null; ring?: string }) {
    return (
      <span
        aria-hidden
        title={name ?? undefined}
        style={{
          width: 26,
          height: 26,
          flex: '0 0 26px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          color: colors.brand,
          background: colors.brandSubtle,
          boxShadow: ring ? `0 0 0 2px ${colors.bgSurface}, 0 0 0 3px ${ring}` : 'none',
        }}
      >
        {initial(name)}
      </span>
    );
  }

  function Comment({
    comment,
    clamp = false,
    byline = true,
  }: {
    comment: ThreadDto['comments'][number] | undefined;
    clamp?: boolean;
    /** Off for the comment the card's header already attributes. */
    byline?: boolean;
  }) {
    if (!comment) return null;
    const text = comment.deletedAt ? 'Comment deleted' : bodyText(comment.body);

    return (
      <div style={{ display: 'flex', gap: space.sm, alignItems: 'flex-start' }}>
        {clamp || !byline ? null : <Avatar name={comment.authorName} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Paragraph
            {...(clamp ? { ellipsis: { rows: 2 } } : {})}
            style={{
              margin: 0,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              color: comment.deletedAt ? colors.textTertiary : colors.textPrimary,
              fontStyle: comment.deletedAt ? 'italic' : undefined,
            }}
          >
            {text}
          </Typography.Paragraph>
          {clamp || !byline ? null : (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 11, display: 'block', marginTop: space.xxs }}
            >
              {comment.authorName ?? 'Someone'} · {relativeTime(comment.createdAt) ?? 'just now'}
              {comment.editedAt ? ' · edited' : ''}
            </Typography.Text>
          )}
        </div>
      </div>
    );
  }
}
