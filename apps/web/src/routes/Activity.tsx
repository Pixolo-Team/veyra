import { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Empty, Skeleton, Tooltip, Typography } from 'antd';
import type { ActivityEvent, ActivityWindow } from '@veyra/contracts';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { PageBody, PageHeader } from '../components/Page';
import {
  ChevronRightIcon,
  CommentIcon,
  DeleteIcon,
  EyeIcon,
  GroupsIcon,
  HighlighterIcon,
  RenameIcon,
  ResolveIcon,
  CloseIcon,
  UploadIcon,
} from '../components/icons';
import { overviewApi } from '../lib/api/endpoints';
import { activitySummaryQuery, qk } from '../lib/queries';
import { messageOf } from '../lib/errorMessage';
import { relativeTime } from '../lib/relativeTime';
import {
  describeAction,
  describeTarget,
  eventDetail,
  formatDuration,
  type EventGlyph,
  type EventTone,
} from '../lib/auditEvents';

const WINDOWS: { value: ActivityWindow; label: string }[] = [
  { value: '1', label: '24h' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'all', label: 'All' },
];

const PAGE_SIZE = 50;

const GLYPHS: Record<EventGlyph, React.ComponentType<{ size?: number }>> = {
  view: EyeIcon,
  download: DownloadGlyph,
  comment: CommentIcon,
  highlight: HighlighterIcon,
  resolve: ResolveIcon,
  delete: DeleteIcon,
  denied: CloseIcon,
  person: GroupsIcon,
  edit: RenameIcon,
};

/** The set ships one arrow; a download is it, turned. */
function DownloadGlyph({ size = 12 }: { size?: number }) {
  return <UploadIcon size={size} style={{ transform: 'rotate(180deg)' }} />;
}

/**
 * The audit trail: every recorded act in this room, newest first.
 *
 * A data room's log is not a feed — nobody reads it for news. It is read to
 * answer a question that has already been asked, usually by someone outside
 * the deal: who saw this, when, and did anything leave. So the screen is a
 * table rather than a timeline of cards, the timestamps are exact rather than
 * relative, and it exports.
 *
 * Nothing here is editable, by anyone. That is the point of it.
 */
export function Activity() {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId' });
  const { colors, radius, space } = useVeyraTokens();
  const [days, setDays] = useState<ActivityWindow>('7');
  const [page, setPage] = useState(1);

  // Changing the window changes what page 3 even means.
  useEffect(() => setPage(1), [days]);

  const summary = useQuery(activitySummaryQuery(roomId, days));

  const log = useQuery({
    ...(() => {
      const query = { limit: PAGE_SIZE, days, page };
      return {
        queryKey: qk.activity(roomId, query),
        queryFn: () => overviewApi.activity(roomId, query),
      };
    })(),
    /*
     * The previous page stays on screen while the next one loads. Without
     * this the table empties to a skeleton on every click, and paging through
     * a log turns into a flicker — the rows are the thing being read.
     */
    placeholderData: keepPreviousData,
  });

  const rows = log.data?.items ?? [];
  const total = log.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  /*
   * The page the rows on screen actually came from, echoed by the server.
   *
   * Not `page`: while the next one is in flight the previous rows are still
   * shown, and a range read off the click would say "151–182" over page one's
   * rows. The highlighted *number* follows the click, because that is the
   * feedback that the click landed — but the range describes what is there.
   */
  const shownPage = log.data?.page ?? page;
  const totals = summary.data;

  return (
    <>
      <PageHeader
        title="Activity"
        subtitle="Every view, download, comment and refusal in this room. Append-only."
        actions={
          <>
            <WindowPicker />
            <Tooltip title="Downloads the full log as CSV. Admins only.">
              <button
                type="button"
                className="veyra-menu-action"
                onClick={() => window.open(overviewApi.activityCsvUrl(roomId))}
                style={{
                  borderRadius: radius.md,
                  ['--veyra-action-fg' as string]: colors.textPrimary,
                  ['--veyra-action-hover-bg' as string]: colors.bgHover,
                }}
              >
                <span aria-hidden style={{ display: 'inline-flex', opacity: 0.75 }}>
                  <DownloadGlyph size={14} />
                </span>
                Export log
              </button>
            </Tooltip>
          </>
        }
      />

      <PageBody maxWidth="none">
        <Stack gap="lg">
          {/* The four questions the log is opened to answer, answered before
              anyone scrolls. Counted over the window chosen above, so a
              headline never quietly measures a different period than the
              table beneath it. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: space.md,
            }}
          >
            <Stat
              label={`Events · ${labelFor(days)}`}
              value={totals ? totals.events.toLocaleString() : null}
              note={
                totals ? `across ${totals.actors} ${plural(totals.actors, 'person', 'people')}` : ''
              }
            />
            <Stat
              label="Downloads"
              value={totals ? totals.downloads.toLocaleString() : null}
              note="files that left the room"
            />
            <Stat
              label="Denied attempts"
              value={totals ? totals.denied.toLocaleString() : null}
              note="outside granted scope"
              alarming={Boolean(totals?.denied)}
            />
            <Stat
              label="Reading time"
              value={totals ? formatDuration(totals.readingSeconds) : null}
              note={
                totals?.mostActive
                  ? `${totals.mostActive.name} · ${Math.round(totals.mostActive.shareOfReading * 100)}%`
                  : 'no reading recorded yet'
              }
            />
          </div>

          {log.error ? (
            <Alert
              type="error"
              showIcon
              title="The log could not be loaded"
              description={messageOf(log.error, 'Please try again.')}
            />
          ) : null}

          <div
            style={{
              border: `1px solid ${colors.divider}`,
              borderRadius: radius.lg,
              background: colors.bgSurface,
            }}
          >
            <table
              className="veyra-log"
              style={{
                width: '100%',
                tableLayout: 'fixed',
                // Says the click landed, without emptying the table to a
                // skeleton and making the whole page jump on every step.
                opacity: log.isPlaceholderData ? 0.55 : 1,
                transition: 'opacity 120ms ease',
              }}
            >
              <thead>
                <tr>
                  <Th width={116}>Timestamp</Th>
                  <Th width={210}>Actor</Th>
                  <Th width={170}>Event</Th>
                  <Th>Object</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((event) => (
                  <Row key={event.id} event={event} />
                ))}
              </tbody>
            </table>

            {log.isPending && !log.isPlaceholderData ? (
              <div style={{ padding: space.lg }}>
                <Skeleton active paragraph={{ rows: 6 }} />
              </div>
            ) : null}

            {!log.isPending && rows.length === 0 ? (
              <div style={{ padding: space['2xl'] }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                      Nothing recorded in this window.
                    </Typography.Text>
                  }
                />
              </div>
            ) : null}

            {total > 0 ? <Pager /> : null}
          </div>
        </Stack>
      </PageBody>
    </>
  );

  /**
   * Page numbers, a range, and two arrows.
   *
   * Numbered rather than "load older", because the audit log is the one list
   * people are asked to cite — "page 3 of the July window" has to be a thing
   * you can go back to, and an endlessly growing single page is not. The
   * range on the left is there for the same reason: it says what you are
   * looking at out of what exists, which is the first thing anyone checks.
   */
  function Pager() {
    const first = (shownPage - 1) * PAGE_SIZE + 1;
    const last = Math.min(first + rows.length - 1, total);

    return (
      <nav
        aria-label="Log pages"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.md,
          flexWrap: 'wrap',
          padding: `${space.sm}px ${space.md}px`,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {`${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`}
        </Typography.Text>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Step direction="prev" />
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <span
                key={`gap-${index}`}
                aria-hidden
                style={{ padding: '0 4px', color: colors.textTertiary, fontSize: 13 }}
              >
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                className="veyra-page"
                aria-label={`Page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => setPage(entry)}
                style={{
                  borderRadius: radius.sm,
                  background: entry === page ? colors.brandSubtle : 'transparent',
                  color: entry === page ? colors.brand : colors.textSecondary,
                  fontWeight: entry === page ? 600 : 400,
                  ['--veyra-page-hover' as string]: colors.bgHover,
                }}
              >
                {entry}
              </button>
            ),
          )}
          <Step direction="next" />
        </div>
      </nav>
    );
  }

  function Step({ direction }: { direction: 'prev' | 'next' }) {
    const isPrev = direction === 'prev';
    const target = isPrev ? page - 1 : page + 1;
    const disabled = isPrev ? page <= 1 : page >= pageCount;
    return (
      <button
        type="button"
        className="veyra-page"
        aria-label={isPrev ? 'Previous page' : 'Next page'}
        disabled={disabled}
        onClick={() => setPage(target)}
        style={{
          borderRadius: radius.sm,
          color: colors.textSecondary,
          ['--veyra-page-hover' as string]: colors.bgHover,
        }}
      >
        <ChevronRightIcon
          size={14}
          style={isPrev ? { transform: 'rotate(180deg)' } : undefined}
        />
      </button>
    );
  }

  /**
   * The window, as one control rather than four buttons.
   *
   * An inset track with the choice raised out of it, so the row reads as a
   * single switch. Outlined buttons side by side read as four separate things
   * to press, only one of which happens to be on.
   */
  function WindowPicker() {
    return (
      <div
        role="group"
        aria-label="Time window"
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 2,
          borderRadius: radius.md,
          background: colors.bgWash,
        }}
      >
        {WINDOWS.map((entry) => {
          const on = days === entry.value;
          return (
            <button
              key={entry.value}
              type="button"
              aria-pressed={on}
              onClick={() => setDays(entry.value)}
              className="veyra-window-option"
              style={{
                borderRadius: radius.sm,
                background: on ? colors.bgSurface : 'transparent',
                color: on ? colors.textPrimary : colors.textSecondary,
                fontWeight: on ? 600 : 400,
                boxShadow: on ? '0 1px 2px rgba(16, 24, 40, 0.08)' : 'none',
              }}
            >
              {entry.label}
            </button>
          );
        })}
      </div>
    );
  }

  function Stat({
    label,
    value,
    note,
    alarming = false,
  }: {
    label: string;
    value: string | null;
    note: string;
    alarming?: boolean;
  }) {
    return (
      <div
        style={{
          padding: space.lg,
          borderRadius: radius.lg,
          border: `1px solid ${colors.divider}`,
          background: colors.bgSurface,
        }}
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}
        >
          {label}
        </Typography.Text>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.2,
            margin: `${space.xxs}px 0`,
            // A non-zero count of refusals is the one number on this screen
            // that asks for someone's attention.
            color: alarming ? colors.danger : colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value ?? '—'}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {note}
        </Typography.Text>
      </div>
    );
  }

  function Th({ children, width }: { children: React.ReactNode; width?: number }) {
    return (
      <th
        style={{
          width,
          // Sticks to the top of the page panel, which is the scroller. The
          // ground has to be opaque or the rows read through it.
          position: 'sticky',
          top: 0,
          zIndex: 2,
          textAlign: 'left',
          padding: `${space.sm}px ${space.md}px`,
          background: colors.bgWash,
          boxShadow: `inset 0 -1px 0 ${colors.divider}`,
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: colors.textTertiary,
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </th>
    );
  }

  function Row({ event }: { event: ActivityEvent }) {
    const { label, tone, glyph } = describeAction(event.action);
    const detail = eventDetail(event);
    const when = new Date(event.createdAt);
    const object = describeTarget(event);

    return (
      <tr className="veyra-log-row" style={{ ['--veyra-row-hover' as string]: colors.bgHover }}>
        <Td>
          {/* Exact to the second, and tabular, because the reason to read a
              log is usually to line two events up against each other. */}
          <Tooltip title={`${when.toLocaleString()} · ${relativeTime(event.createdAt) ?? ''}`}>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: 12,
                color: colors.textSecondary,
              }}
            >
              {timestamp(when)}
            </span>
          </Tooltip>
        </Td>

        <Td>
          <div style={{ fontSize: 13, color: colors.textPrimary }}>
            {event.actorName ?? 'System'}
          </div>
          {event.actorCompany ? (
            <div style={{ fontSize: 12, color: colors.textTertiary }}>{event.actorCompany}</div>
          ) : null}
        </Td>

        <Td>
          <EventLabel tone={tone} glyph={glyph}>
            {label}
          </EventLabel>
        </Td>

        <Td>
          <div
            style={{
              fontSize: 13,
              color: colors.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={object}
          >
            {object}
          </div>
          {detail ? <div style={{ fontSize: 12, color: colors.textTertiary }}>{detail}</div> : null}
        </Td>
      </tr>
    );
  }

  function Td({ children }: { children: React.ReactNode }) {
    return (
      <td
        style={{
          padding: `${space.sm}px ${space.md}px`,
          verticalAlign: 'top',
          minWidth: 0,
          borderTop: `1px solid ${colors.divider}`,
        }}
      >
        {children}
      </td>
    );
  }

  /**
   * The event, as a glyph and a word.
   *
   * No chip behind it. Fifty rows of filled pills makes a column of coloured
   * blocks that the eye reads before any of the text in it, and on a screen
   * whose job is the *other* columns — who, what, when — that is the loudest
   * thing on the page saying the least. Colour alone still separates a
   * refusal from a download, and the glyph does the scanning.
   */
  function EventLabel({
    tone,
    glyph,
    children,
  }: {
    tone: EventTone;
    glyph: EventGlyph;
    children: React.ReactNode;
  }) {
    const palette: Record<EventTone, string> = {
      read: colors.textSecondary,
      egress: colors.success,
      write: colors.brand,
      people: colors.info,
      denied: colors.danger,
    };
    const Glyph = GLYPHS[glyph];
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          color: palette[tone],
          fontSize: 12,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
      >
        <span aria-hidden style={{ display: 'inline-flex', flex: '0 0 auto', opacity: 0.8 }}>
          <Glyph size={13} />
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
      </span>
    );
  }
}

/**
 * Which page numbers to print: always the first, the last, and the
 * neighbourhood of the current one, with gaps for the rest.
 *
 * A log can run to hundreds of pages, and a pager that prints all of them is
 * a second scrollbar with worse aim.
 */
function pageWindow(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);

  const pages = new Set([1, count, current, current - 1, current + 1]);
  // Keep the row a constant width near the ends, where the window would
  // otherwise be lopsided and the pager would visibly resize as you page.
  if (current <= 3) [2, 3, 4].forEach((n) => pages.add(n));
  if (current >= count - 2) [count - 3, count - 2, count - 1].forEach((n) => pages.add(n));

  const sorted = [...pages].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let previous = 0;
  for (const n of sorted) {
    if (previous && n - previous > 1) out.push('gap');
    out.push(n);
    previous = n;
  }
  return out;
}

/** Today's events show a clock; older ones need their date. */
function timestamp(when: Date): string {
  const today = new Date();
  const sameDay =
    when.getFullYear() === today.getFullYear() &&
    when.getMonth() === today.getMonth() &&
    when.getDate() === today.getDate();
  if (sameDay) {
    return when.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  const date = when.toLocaleDateString([], { day: '2-digit', month: 'short' });
  return `${date} ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function labelFor(days: ActivityWindow): string {
  return days === 'all' ? 'all time' : `${days}d`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
