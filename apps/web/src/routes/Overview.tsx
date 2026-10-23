import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Progress, Skeleton, Tag, Typography } from 'antd';
import type { Dashboard } from '@veyra/contracts';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { PageBody, PageHeader, RoomStatusTag } from '../components/Page';
import { dashboardQuery, overviewQuery } from '../lib/queries';
import { messageOf } from '../lib/errorMessage';
import { relativeTime } from '../lib/relativeTime';
import { describeAction, describeTarget, formatDuration } from '../lib/auditEvents';

/**
 * The per-dataroom Overview (Image 2): what needs someone, without them clicking.
 *
 * One endpoint answers every role (D1/R1/D2/R2) and nulls the blocks a role
 * must not see, so this file only does layout: two hero numbers at the top,
 * the module status table on the left, the attention sidebar on the right, and
 * the recent activity feed at the bottom.
 */
export function Overview() {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId' });
  const { colors, radius, space } = useVeyraTokens();
  const dashboard = useQuery(dashboardQuery(roomId));
  // The legacy overview endpoint still carries recentActivity; the dashboard
  // endpoint doesn't, so we pull both until the dashboard contract grows it.
  const overview = useQuery(overviewQuery(roomId));

  if (dashboard.isPending) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Loading the room dashboard…" />
        <PageBody maxWidth="none">
          <Skeleton active paragraph={{ rows: 8 }} />
        </PageBody>
      </>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <>
        <PageHeader title="Overview" />
        <PageBody maxWidth="none">
          <Alert
            type="error"
            showIcon
            title="The dashboard could not be loaded"
            description={messageOf(dashboard.error, 'Please try again.')}
          />
        </PageBody>
      </>
    );
  }

  const d = dashboard.data;
  const isAdmin = d.viewer.role === 'admin';
  const isD1 = d.viewer.side === 'discloser' && isAdmin;
  const recentActivity = overview.data?.recentActivity ?? [];

  return (
    <>
      <PageHeader
        title={d.roomName}
        subtitle={`Overview · ${roleLabel(d)}`}
        tag={<RoomStatusTag status={d.status} />}
      />

      <PageBody maxWidth="none">
        <Stack gap="lg">
          {/* Hero numbers — the two things the design puts above the fold. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: space.md,
            }}
          >
            <HeroStat
              icon="documents"
              value={String(d.documents.total)}
              label="Total Documents"
              note={`Across ${d.checklist.totalCount} modules`}
            />
            <HeroStat
              icon="questions"
              value={String(d.threads.open)}
              label="Open Review Items"
              note="Questions and comments"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
              gap: space.md,
              alignItems: 'start',
            }}
          >
            {/* Left column: Module Status + admin detail + leaderboard. */}
            <Stack gap="lg">
              <Section title="Module Status">
                {d.checklist.totalCount > 0 ? (
                  <ModuleStatusTable modules={d.checklist.modules} />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No modules in this room yet."
                  />
                )}
              </Section>

              {/* Admins get the room-wide numbers contributors don't need. */}
              {isAdmin ? (
                <Section title="Room at a Glance">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: space.md,
                    }}
                  >
                    <MiniStat
                      label="Dossier coverage"
                      value={d.coverage.pct === null ? '—' : `${d.coverage.pct}%`}
                      note={`${d.coverage.viewed} of ${d.coverage.total} opened`}
                    />
                    <MiniStat
                      label="Unread by recipient"
                      value={String(d.documents.unread)}
                      note="never opened"
                    />
                    <MiniStat
                      label="Unopened"
                      value={String(d.documents.unopened)}
                      note="by anyone yet"
                    />
                    <MiniStat
                      label="Revised"
                      value={String(d.documents.revised)}
                      note="more than one version"
                    />
                    <MiniStat
                      label="Unresolved"
                      value={String(d.documents.unresolved)}
                      note="docs with open threads"
                      alarming={d.documents.unresolved > 0}
                    />
                    <MiniStat
                      label="Docs with feedback"
                      value={String(d.documents.withFeedback)}
                      note="at least one comment"
                    />
                    {isD1 && d.medians ? (
                      <>
                        <MiniStat
                          label="Median reply"
                          value={
                            d.medians.replySeconds === null
                              ? '—'
                              : formatDuration(d.medians.replySeconds)
                          }
                          note="first answer"
                        />
                        <MiniStat
                          label="Median resolve"
                          value={
                            d.medians.resolveSeconds === null
                              ? '—'
                              : formatDuration(d.medians.resolveSeconds)
                          }
                          note="open to resolved"
                        />
                      </>
                    ) : null}
                    {isD1 && d.recipient ? (
                      <MiniStat
                        label="Recipient active"
                        value={
                          d.recipient.daysSinceActive === null
                            ? 'Never'
                            : d.recipient.daysSinceActive === 0
                              ? 'Today'
                              : `${d.recipient.daysSinceActive}d ago`
                        }
                        note={
                          d.recipient.lastActiveAt
                            ? new Date(d.recipient.lastActiveAt).toLocaleString()
                            : 'no activity'
                        }
                      />
                    ) : null}
                    {isD1 && d.downloads ? (
                      <MiniStat
                        label="Downloads"
                        value={String(d.downloads.count)}
                        note="files that left"
                      />
                    ) : null}
                  </div>
                </Section>
              ) : (
                /* Contributors see their own numbers instead. */
                <Section title="My Dossier">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: space.md,
                    }}
                  >
                    <MiniStat
                      label="Opened by me"
                      value={d.dossierOpened.pct === null ? '—' : `${d.dossierOpened.pct}%`}
                      note={`${d.dossierOpened.viewed} of ${d.dossierOpened.total} documents`}
                    />
                    <MiniStat
                      label="My open threads"
                      value={String(d.threads.myOpen)}
                      note={`${d.threads.myTotal} started by me`}
                      alarming={d.threads.myOpen > 0}
                    />
                    <MiniStat
                      label="My reading time"
                      value={formatDuration(d.reading.mySeconds)}
                      note="time on docs"
                    />
                  </div>
                </Section>
              )}

              {/* Reading leaderboard — admins only. */}
              {isAdmin && d.reading.leaderboard.length > 0 ? (
                <Section
                  title="Reading Time · Leaderboard"
                  extra={`${formatDuration(d.reading.totalSeconds)} total`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
                    {d.reading.leaderboard.map((entry, index) => (
                      <div
                        key={`${entry.name}-${index}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: space.md,
                          padding: `${space.xs}px ${space.sm}px`,
                          borderRadius: radius.md,
                          background: index === 0 ? colors.brandSubtle : colors.bgWash,
                        }}
                      >
                        <Typography.Text
                          type="secondary"
                          style={{ width: 20, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                        >
                          {index + 1}
                        </Typography.Text>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Typography.Text style={{ fontSize: 13 }} ellipsis>
                            {entry.name}
                            {entry.company ? ` · ${entry.company}` : ''}
                          </Typography.Text>
                        </div>
                        {entry.side ? (
                          <Tag color={entry.side === 'discloser' ? 'blue' : 'purple'}>
                            {entry.side === 'discloser' ? 'Disclosure' : 'Recipient'}
                          </Tag>
                        ) : null}
                        <Typography.Text
                          style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
                        >
                          {formatDuration(entry.seconds)}
                        </Typography.Text>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : null}
            </Stack>

            {/* Right column: Needs Your Attention sidebar. */}
            <Stack gap="lg">
              <AttentionSidebar dashboard={d} />

              {d.invitations ? (
                <Section title={`Pending Invitations · ${d.invitations.pendingCount}`}>
                  {d.invitations.items.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Everyone invited has accepted."
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
                      {d.invitations.items.map((invite) => (
                        <div
                          key={invite.id}
                          style={{
                            padding: `${space.xs}px ${space.sm}px`,
                            borderRadius: radius.md,
                            background: colors.bgWash,
                          }}
                        >
                          <Typography.Text style={{ fontSize: 13 }} ellipsis>
                            {invite.email}
                          </Typography.Text>
                          <div style={{ fontSize: 12, color: colors.textTertiary }}>
                            {invite.companyName ?? ''} · {invite.role}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              ) : null}

              {d.participants ? (
                <Section title="Participants">
                  {d.participants.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nobody here yet." />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: space.md }}>
                      {d.participants.map((group) => (
                        <div key={group.companyId}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: space.xs,
                              marginBottom: space.xs,
                            }}
                          >
                            <Typography.Text strong style={{ fontSize: 13 }}>
                              {group.companyName}
                            </Typography.Text>
                            <Tag color={group.side === 'discloser' ? 'blue' : 'purple'}>
                              {group.side === 'discloser' ? 'Disclosure' : 'Recipient'}
                            </Tag>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: space.xxs }}>
                            {group.participants.map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: space.sm,
                                  fontSize: 13,
                                }}
                              >
                                <Typography.Text style={{ fontSize: 13 }} ellipsis>
                                  {p.name ?? p.email}
                                </Typography.Text>
                                <Tag>{p.role}</Tag>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              ) : null}
            </Stack>
          </div>

          {/* Recent Activity — full width at the bottom. */}
          <Section title="Recent Activity">
            {recentActivity.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No activity recorded yet."
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                {recentActivity.slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      gap: space.sm,
                      padding: `${space.xs}px ${space.sm}px`,
                      borderRadius: radius.md,
                      background: colors.bgWash,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        marginTop: 6,
                        flexShrink: 0,
                        background: event.actorSide === 'discloser' ? colors.brand : colors.info,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <Typography.Text style={{ fontSize: 13 }}>
                        <strong>{event.actorName ?? 'Someone'}</strong>{' '}
                        {describeAction(event.action).label.toLowerCase()}{' '}
                        <span style={{ color: colors.textTertiary }}>{describeTarget(event)}</span>
                      </Typography.Text>
                      <div style={{ fontSize: 12, color: colors.textTertiary }}>
                        {relativeTime(event.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Stack>
      </PageBody>
    </>
  );
}

/** A big number with an icon, like the reference design's hero cards. */
function HeroStat({
  icon,
  value,
  label,
  note,
}: {
  icon: 'documents' | 'questions';
  value: string;
  label: string;
  note: string;
}) {
  const { colors, radius, space } = useVeyraTokens();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.lg,
        padding: space.lg,
        borderRadius: radius.lg,
        border: `1px solid ${colors.divider}`,
        background: colors.bgSurface,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: icon === 'documents' ? colors.brandSubtle : colors.infoSubtle,
          color: icon === 'documents' ? colors.brand : colors.info,
          fontSize: 22,
        }}
      >
        {icon === 'documents' ? '📄' : '💬'}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.1,
            color: colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        <Typography.Text strong style={{ fontSize: 14, display: 'block' }}>
          {label}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {note}
        </Typography.Text>
      </div>
    </div>
  );
}

/** A small stat card for the "Room at a Glance" grid. */
function MiniStat({
  label,
  value,
  note,
  alarming = false,
}: {
  label: string;
  value: string;
  note: string;
  alarming?: boolean;
}) {
  const { colors, radius, space } = useVeyraTokens();
  return (
    <div
      style={{
        padding: space.md,
        borderRadius: radius.md,
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
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.2,
          margin: `${space.xxs}px 0`,
          color: alarming ? colors.danger : colors.textPrimary,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {note}
      </Typography.Text>
    </div>
  );
}

/**
 * The Module Status table (Image 2): one row per eCTD module, with a progress
 * bar and a Complete / In Progress tag.
 *
 * There is no "required" count in the data model, so the bar is binary — a
 * module is complete once it holds a document — rather than a partial fill.
 */
function ModuleStatusTable({
  modules,
}: {
  modules: Dashboard['checklist']['modules'];
}) {
  const { colors, radius, space } = useVeyraTokens();
  const maxDocs = Math.max(1, ...modules.map((m) => m.documentCount));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
      {/* Header row. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px minmax(0, 1fr) 100px 140px 110px',
          gap: space.md,
          padding: `${space.xs}px ${space.md}px`,
          fontSize: 12,
          fontWeight: 600,
          color: colors.textTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <div>Module</div>
        <div>Title</div>
        <div style={{ textAlign: 'right' }}>Documents</div>
        <div>Status</div>
        <div />
      </div>

      {modules.map((m) => (
        <div
          key={m.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px minmax(0, 1fr) 100px 140px 110px',
            gap: space.md,
            alignItems: 'center',
            padding: `${space.sm}px ${space.md}px`,
            borderRadius: radius.md,
            border: `1px solid ${colors.divider}`,
            background: colors.bgSurface,
          }}
        >
          {/* Module code badge. */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              background: m.completed ? colors.brandSubtle : colors.bgWash,
              color: m.completed ? colors.brand : colors.textTertiary,
            }}
          >
            {m.code}
          </div>

          <Typography.Text style={{ fontSize: 13 }} ellipsis>
            {m.title}
          </Typography.Text>

          <Typography.Text
            style={{ fontSize: 13, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
          >
            {m.documentCount}
          </Typography.Text>

          {/* Progress bar: binary complete / in-progress, scaled to the fullest module. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <Progress
              percent={m.completed ? 100 : Math.round((m.documentCount / maxDocs) * 100)}
              size="small"
              showInfo={false}
              strokeColor={m.completed ? colors.success : colors.brand}
              style={{ flex: 1, minWidth: 50 }}
            />
            <Typography.Text
              style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', width: 36, textAlign: 'right' }}
            >
              {m.completed ? '100%' : `${Math.round((m.documentCount / maxDocs) * 100)}%`}
            </Typography.Text>
          </div>

          <Tag color={m.completed ? 'success' : 'processing'} style={{ marginInlineEnd: 0 }}>
            {m.completed ? 'Complete' : 'In Progress'}
          </Tag>
        </div>
      ))}
    </div>
  );
}

/**
 * The Needs Your Attention sidebar (Image 2): three summary rows that count
 * what's waiting on the viewer, plus the individual items below.
 */
function AttentionSidebar({ dashboard: d }: { dashboard: Dashboard }) {
  const { colors, radius, space } = useVeyraTokens();
  const isAdmin = d.viewer.role === 'admin';

  // Three summary rows: open questions, missing/unopened docs, awaiting review.
  const openQuestions = isAdmin ? d.threads.open : d.threads.myOpen;
  const missingDocs = isAdmin ? d.documents.unread : d.documents.unopened;
  const awaitingReview = d.attention.length;

  return (
    <Section title="Needs Your Attention">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
        <AttentionRow
          icon="💬"
          count={openQuestions}
          label="open questions"
          note={isAdmin ? 'Awaiting response' : 'Started by me'}
          tone={openQuestions > 0 ? 'warning' : 'default'}
        />
        <AttentionRow
          icon="📄"
          count={missingDocs}
          label="missing documents"
          note={isAdmin ? 'Never opened by recipient' : 'Never opened by anyone'}
          tone={missingDocs > 0 ? 'info' : 'default'}
        />
        <AttentionRow
          icon="✅"
          count={awaitingReview}
          label="items need you"
          note="Mentions & unanswered"
          tone={awaitingReview > 0 ? 'success' : 'default'}
        />
      </div>

      {d.attention.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs, marginTop: space.md }}>
          {d.attention.map((item) => (
            <div
              key={item.threadId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space.sm,
                padding: `${space.xs}px ${space.sm}px`,
                borderRadius: radius.md,
                background: colors.bgWash,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Typography.Text style={{ fontSize: 13 }} ellipsis>
                  {item.documentName ?? 'Comment thread'}
                </Typography.Text>
                <div style={{ fontSize: 12, color: colors.textTertiary }}>
                  {relativeTime(item.createdAt) ?? ''}
                </div>
              </div>
              <Tag color={item.reason === 'mention' ? 'warning' : 'processing'}>
                {item.reason === 'mention' ? 'Mentioned you' : 'Unanswered'}
              </Tag>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function AttentionRow({
  icon,
  count,
  label,
  note,
  tone,
}: {
  icon: string;
  count: number;
  label: string;
  note: string;
  tone: 'warning' | 'info' | 'success' | 'default';
}) {
  const { colors, radius, space } = useVeyraTokens();
  const toneBg =
    tone === 'warning'
      ? colors.warningSubtle
      : tone === 'info'
        ? colors.infoSubtle
        : tone === 'success'
          ? colors.successSubtle
          : colors.bgWash;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        padding: `${space.sm}px ${space.md}px`,
        borderRadius: radius.md,
        background: toneBg,
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Typography.Text strong style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {count}{' '}
        </Typography.Text>
        <Typography.Text style={{ fontSize: 13 }}>{label}</Typography.Text>
        <div style={{ fontSize: 12, color: colors.textTertiary }}>{note}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  extra,
  children,
}: {
  title: string;
  extra?: string;
  children: React.ReactNode;
}) {
  const { colors, radius, space } = useVeyraTokens();
  return (
    <section
      style={{
        padding: space.lg,
        borderRadius: radius.lg,
        border: `1px solid ${colors.divider}`,
        background: colors.bgSurface,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: space.sm,
          marginBottom: space.md,
        }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {extra ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {extra}
          </Typography.Text>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** "Disclosure Admin", "Recipient Contributor", … — the acceptance-test name. */
function roleLabel(d: Dashboard): string {
  const side = d.viewer.side === 'discloser' ? 'Disclosure' : 'Recipient';
  const role =
    d.viewer.role === 'admin'
      ? 'Admin'
      : d.viewer.role === 'contributor'
        ? 'Contributor'
        : 'Reviewer';
  return `${side} ${role}`;
}
