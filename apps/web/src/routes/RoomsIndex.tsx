import { Alert, Empty, Skeleton, Tag, Tooltip, Typography } from 'antd';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { RoomListItem } from '@veyra/contracts';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { PageBody, PageHeader, RoomStatusTag } from '../components/Page';
import { PlusIcon } from '../components/icons';
import { PlainLayout } from '../components/PlainLayout';
import { messageOf } from '../lib/errorMessage';
import { ROLE_SHORT } from '../lib/labels';
import { roomsQuery } from '../lib/queries';
import { absoluteTime, relativeTime } from '../lib/relativeTime';

/**
 * Every room this person is a participant in (D12). The list is their
 * `room_participants` rows, so a room they were removed from simply isn't here.
 */
export function RoomsIndex() {
  const rooms = useQuery(roomsQuery);
  const navigate = useNavigate();

  return (
    <PlainLayout>
      <PageHeader
        title="Rooms"
        subtitle="Every data room you have access to."
        actions={
          <Button intent="primary" icon={<PlusIcon />} onClick={() => void navigate({ to: '/rooms/new' })}>
            Create a data room
          </Button>
        }
      />
      <PageBody maxWidth={880}>
        {rooms.isPending ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : rooms.isError ? (
          <Alert type="error" showIcon title={messageOf(rooms.error, 'Could not load your rooms.')} />
        ) : rooms.data.length === 0 ? (
          <EmptyRooms />
        ) : (
          <Stack gap="sm">
            {rooms.data.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </Stack>
        )}
      </PageBody>
    </PlainLayout>
  );
}

function EmptyRooms() {
  const { colors, space } = useVeyraTokens();
  return (
    <div
      style={{
        border: `1px dashed ${colors.border}`,
        borderRadius: 12,
        background: colors.bgSurface,
        padding: space['4xl'],
        textAlign: 'center',
      }}
    >
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Stack gap="xs" align="center">
            <Typography.Text strong>No rooms yet</Typography.Text>
            <Typography.Text type="secondary">
              A data room holds one deal: the CTD dossier, the people reviewing it, and everything
              they do in it.
            </Typography.Text>
          </Stack>
        }
      >
        <Link to="/rooms/new">
          <Button intent="primary" icon={<PlusIcon />}>
            Create your first data room
          </Button>
        </Link>
      </Empty>
    </div>
  );
}

function RoomCard({ room }: { room: RoomListItem }) {
  const { colors, space, shadows } = useVeyraTokens();
  const relative = relativeTime(room.lastActivityAt);

  return (
    <Link
      to="/rooms/$roomId/overview"
      params={{ roomId: room.id }}
      style={{
        display: 'block',
        padding: space.lg,
        borderRadius: 10,
        // Elevation alone, no outline: the card is told from the page by the
        // step in ground, the way everything else in the shell now is.
        background: colors.bgSurface,
        boxShadow: shadows.sm,
        color: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {room.name}
            </Typography.Text>
            <RoomStatusTag status={room.status} />
            {room.participantStatus === 'invited' ? <Tag color="gold">Invitation pending</Tag> : null}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {room.side === 'discloser' ? 'You are disclosing' : 'You are reviewing'} ·{' '}
            {ROLE_SHORT[room.role]}
          </Typography.Text>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          {relative ? (
            <Tooltip title={absoluteTime(room.lastActivityAt)}>Last activity {relative}</Tooltip>
          ) : (
            'No activity yet'
          )}
        </Typography.Text>
      </div>
    </Link>
  );
}
