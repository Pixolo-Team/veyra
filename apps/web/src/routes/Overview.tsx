import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Empty, Progress, Skeleton, Tag, Typography } from 'antd';
import type { Dashboard } from '@veyra/contracts';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { PageBody, PageHeader, RoomStatusTag } from '../components/Page';
import { dashboardQuery } from '../lib/queries';
import { messageOf } from '../lib/errorMessage';
import { relativeTime } from '../lib/relativeTime';
import { formatDuration } from '../lib/auditEvents';

/**
 * The per-dataroom Overview: what needs someone, without them clicking.
 *
 * One endpoint answers every role (D1/R1/D2/R2) and nulls the blocks a role
 * must not see, so this file only does layout: admins get the room-wide
 * numbers, contributors get theirs, everyone gets the checklist, their own
 * time, and what needs their attention.
 */
export function Overview() {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId' });
  const { colors, radius, space } = useVeyraTokens();
  const dashboard = useQuery(dashboardQuery(roomId));

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

  return (
    <>
      <PageHeader
        title={d.roomName}
        subtitle={`Overview · ${roleLabel(d)}`}
        tag={<RoomStatusTag status={d.status} />}
      />

      <PageBody maxWidth="none">
        <Stack gap="lg">
          {/* Headline numbers — the room at a glance. Admins see the
              room-wide counts; contributors see theirs. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: space.md,
            }}
          >
            <Stat label="Total documents" value={String(d.documents.total)} note="in this dataroom" />
            {isAdmin ? (
              <>
                <Stat
                  label="Dossier coverage"
                  value={d.coverage.pct === null ? '—' : `${d.coverage.pct}%`}
                  note={`${d.coverage.viewed} of ${d.coverage.total} opened by recipient`}
                />
                <Stat label="Unread by recipient" value={String(d.documents.unread)} note="never opened" />
                <Stat label="Unopened" value={String(d.documents.unopened)} note="by anyone yet" />
                <Stat label="Revised" value={String(d.documents.revised)} note="more than one version" />
                <Stat
                  label="Unresolved"
                  value={String(d.documents.unresolved)}
                  note="docs with open threads"
                  alarming={d.documents.unresolved > 0}
                />
              </>
            ) : (
              <>
                <Stat
                  label="Dossier opened by me"
                  value={d.dossierOpened.pct === null ? '—' : `${d.dossierOpened.pct}%`}
                  note={`${d.dossierOpened.viewed} of ${d.dossierOpened.total} documents`}
                />
                <Stat
                  label="My open threads"
                  value={String(d.threads.myOpen)}
                  note={`${d.threads.myTotal} started by me`}
                  alarming={d.threads.myOpen > 0}
                />
              </>
            )}
            <Stat
              label="Docs with feedback"
              value={String(d.documents.withFeedback)}
              note="at least one comment"
            />
            <Stat label="My reading time" value={formatDuration(d.reading.mySeconds)} note="time on docs" />
            {isD1 && d.downloads ? (
              <Stat label="Downloads" value={String(d.downloads.count)} note="files that left the room" />
            ) : null}
          </div>

          {/* Admins: question/comment totals + reply medians + recipient pulse. */}
          {isAdmin ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: space.md,
              }}
            >
              <Stat
                label="Open threads"
                value={String(d.threads.open)}
                note={`${d.threads.resolved} resolved`}
                alarming={d.threads.open > 0}
              />
              <Stat label="My open threads" value={String(d.threads.myOpen)} note="started by me" />
              {isD1 && d.medians ? (
                <>
                  <Stat
                    label="Median time to reply"
                    value={d.medians.replySeconds === null ? '—' : formatDuration(d.medians.replySeconds)}
                    note="first answer on a thread"
                  />
                  <Stat
                    label="Median time to resolve"
                    value={
                      d.medians.resolveSeconds === null ? '—' : formatDuration(d.medians.resolveSeconds)
                    }
                    note="open to resolved"
                  />
                </>
              ) : null}
              {isD1 && d.recipient ? (
                <Stat
                  label="Recipient last active"
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
                      : 'no activity recorded'
                  }
                />
              ) : null}
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: space.md,
              alignItems: 'start',
            }}
          >
            <Section title={`Setup checklist · ${d.checklist.completedCount}/${d.checklist.totalCount} modules`}>
              {d.checklist.totalCount > 0 ? (
                <div style={{ marginBottom: space.md }}>
                  <Progress
                    percent={Math.round((d.checklist.completedCount / d.checklist.totalCount) * 100)}
                    size="small"
                  />
                </div>
              ) : null}
              {d.checklist.modules.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No modules in this room yet."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
                  {d.checklist.modules.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: space.sm,
                        padding: `${space.xs}px ${space.sm}px`,
                        borderRadius: radius.md,
                        background: m.completed ? colors.brandSubtle : colors.bgWash,
                      }}
                    >
                      <Typography.Text style={{ fontSize: 13 }} ellipsis>
                        {m.code} · {m.title}
                      </Typography.Text>
                      <Tag color={m.completed ? 'success' : 'default'}>
                        {m.completed ? `${m.documentCount} docs` : 'Empty'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={`Needs your attention · ${d.attention.length}`}>
              {d.attention.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Nothing needs you — no mentions, no unanswered threads."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
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
              )}
            </Section>
          </div>

          {/* Reading leaderboard — admins see everyone, contributors already
              have their own time above. */}
          {isAdmin ? (
            <Section
              title="Reading time · leaderboard"
              extra={`${formatDuration(d.reading.totalSeconds)} total`}
            >
              {d.reading.leaderboard.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No reading recorded yet."
                />
              ) : (
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
              )}
            </Section>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: space.md,
              alignItems: 'start',
            }}
          >
            {d.invitations ? (
              <Section title={`Pending invitations · ${d.invitations.pendingCount}`}>
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
                            {invite.email}
                          </Typography.Text>
                          <div style={{ fontSize: 12, color: colors.textTertiary }}>
                            {invite.companyName ?? ''} · invited{' '}
                            {relativeTime(invite.createdAt) ?? ''}
                          </div>
                        </div>
                        <Stack gap="xxs" style={{ alignItems: 'flex-end' }}>
                          <Tag>{invite.role}</Tag>
                          <Tag color={invite.side === 'discloser' ? 'blue' : 'purple'}>
                            {invite.side}
                          </Tag>
                        </Stack>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            ) : null}

            {d.participants ? (
              <Section
                title={`Users & their access · ${d.participants.reduce((n, g) => n + g.participants.length, 0)}`}
              >
                {d.participants.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Nobody here yet."
                  />
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
                        <div
                          style={{ display: 'flex', flexDirection: 'column', gap: space.xxs }}
                        >
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
                                <span style={{ color: colors.textTertiary }}> · {p.email}</span>
                              </Typography.Text>
                              <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
                                <Tag>{p.role}</Tag>
                                <Tag color={p.status === 'active' ? 'success' : 'default'}>
                                  {p.status}
                                </Tag>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            ) : null}
          </div>
        </Stack>
      </PageBody>
    </>
  );

  function Section({
    title,
    extra,
    children,
  }: {
    title: string;
    extra?: string;
    children: React.ReactNode;
  }) {
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

  function Stat({
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
