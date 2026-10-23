import { useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Alert, Breadcrumb, Empty, Progress, Skeleton, Tag, Typography } from 'antd';
import { Link } from '@tanstack/react-router';
import type { CompanyDashboard, CompanyDashboardRoom } from '@veyra/contracts';
import { PlusIcon, useVeyraTokens } from '@veyra/design-system';
import { Button, Stack } from '@veyra/design-system';
import { PageBody, PageHeader, RoomStatusTag } from '../components/Page';
import { PlainLayout } from '../components/PlainLayout';
import { companyDashboardQuery } from '../lib/queries';
import { messageOf } from '../lib/errorMessage';
import { relativeTime } from '../lib/relativeTime';
import { describeAction, describeTarget } from '../lib/auditEvents';

/**
 * The company dashboard (Image 1): the rollup across every data room the
 * viewer belongs to for this company.
 *
 * Two hero numbers answer "how much is open" at a glance; the dossier table
 * below is where the work is — one row per room, with coverage and open
 * questions. The server only returns rooms the caller is an active
 * participant in, so this page never filters on the client.
 */
export function CompanyDashboard() {
  const { companyId } = useParams({ from: '/session/app/companies/$companyId/dashboard' });
  const dashboard = useQuery(companyDashboardQuery(companyId));

  if (dashboard.isPending) {
    return (
      <PlainLayout>
        <PageHeader title="Dashboard" subtitle="Loading…" />
        <PageBody maxWidth="none">
          <Skeleton active paragraph={{ rows: 8 }} />
        </PageBody>
      </PlainLayout>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <PlainLayout>
        <PageHeader title="Dashboard" />
        <PageBody maxWidth="none">
          <Alert
            type="error"
            showIcon
            title="The company dashboard could not be loaded"
            description={messageOf(dashboard.error, 'Please try again.')}
          />
        </PageBody>
      </PlainLayout>
    );
  }

  return <CompanyDashboardView data={dashboard.data} />;
}

function CompanyDashboardView({ data }: { data: CompanyDashboard }) {
  const { colors, radius, space } = useVeyraTokens();
  const { summary, rooms, recentActivity, companyName } = data;
  const roleLabel = data.viewer.role === 'admin' ? 'Admin' : data.viewer.role === 'contributor' ? 'Contributor' : 'Reviewer';

  // Breadcrumb items based on reference design
  const breadcrumbItems = [
    { label: companyName, href: '#' },
    { label: 'Product Exchange', href: '#' },
    { label: 'Out-Licensing', href: '#' },
  ];

  return (
    <PlainLayout>
      <Breadcrumb
        style={{ marginBottom: space.md }}
        items={breadcrumbItems}
        separator="/"
      />
      <PageHeader
        title={`${companyName} Data Room`}
        subtitle={`Dashboard · ${roleLabel}`}
        tag={<RoomStatusTag status={rooms[0]?.status ?? 'active'} />}
        actions={
          <Button icon={<PlusIcon />}>
            New Dossier
          </Button>
        }
      />
      <PageBody maxWidth="none">
        <Stack gap="lg">
          {/* Hero numbers — the company at a glance. */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: space.md,
            }}
          >
            <HeroStat
              icon="dossier"
              value={String(summary.totalRooms)}
              label="Dossiers"
              note="Across this data room"
            />
            <HeroStat
              icon="questions"
              value={String(summary.openQuestions)}
              label="Open Questions"
              note="Awaiting response"
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
            {/* The dossier list — one row per room. */}
            <Section title="Dossiers">
              {rooms.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No data rooms yet."
                />
              ) : (
                <DossierTable rooms={rooms} />
              )}
            </Section>

            {/* Recent activity across the company's rooms. */}
            <Section title="Recent Activity">
              {recentActivity.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No activity recorded yet."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: space.sm }}>
                  {recentActivity.map((event) => (
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
          </div>
        </Stack>
      </PageBody>
    </PlainLayout>
  );
}

/** A big number with an icon, like the reference design's hero cards. */
function HeroStat({
  icon,
  value,
  label,
  note,
}: {
  icon: 'dossier' | 'questions';
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
          background: icon === 'dossier' ? colors.brandSubtle : colors.infoSubtle,
          color: icon === 'dossier' ? colors.brand : colors.info,
          fontSize: 22,
        }}
      >
        {icon === 'dossier' ? '📁' : '💬'}
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

/** The dossier table: room, status, documents, coverage, open questions. */
function DossierTable({ rooms }: { rooms: CompanyDashboardRoom[] }) {
  const { colors, radius, space } = useVeyraTokens();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xs }}>
      {rooms.map((room) => (
        <Link
          key={room.roomId}
          to="/rooms/$roomId/overview"
          params={{ roomId: room.roomId }}
          style={{ textDecoration: 'none' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 2fr) 100px 90px 140px 110px',
              gap: space.md,
              alignItems: 'center',
              padding: `${space.sm}px ${space.md}px`,
              borderRadius: radius.md,
              border: `1px solid ${colors.divider}`,
              background: colors.bgSurface,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <Typography.Text strong style={{ fontSize: 14 }} ellipsis>
                {room.roomName}
              </Typography.Text>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>
                {room.lastActivityAt ? `Active ${relativeTime(room.lastActivityAt)}` : 'No activity yet'}
              </div>
            </div>
            <RoomStatusTag status={room.status} />
            <Typography.Text style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
              {room.documentCount} docs
            </Typography.Text>
            <div>
              {room.coveragePct === null ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  —
                </Typography.Text>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                  <Progress
                    percent={room.coveragePct}
                    size="small"
                    showInfo={false}
                    style={{ flex: 1, minWidth: 40 }}
                  />
                  <Typography.Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {room.coveragePct}%
                  </Typography.Text>
                </div>
              )}
            </div>
            <div>
              {room.openThreads > 0 ? (
                <Tag color="warning" style={{ marginInlineEnd: 0 }}>
                  {room.openThreads} open
                </Tag>
              ) : (
                <Tag style={{ marginInlineEnd: 0 }}>Clear</Tag>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
      <Typography.Title level={5} style={{ margin: `0 0 ${space.md}px` }}>
        {title}
      </Typography.Title>
      {children}
    </section>
  );
}