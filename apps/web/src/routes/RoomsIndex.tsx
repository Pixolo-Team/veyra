import { Alert, App, Empty, Skeleton, Tag, Tooltip, Typography } from 'antd';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { RoomListItem } from '@veyra/contracts';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { PageBody, PageHeader, RoomStatusTag } from '../components/Page';
import { PlusIcon } from '../components/icons';
import { PlainLayout } from '../components/PlainLayout';
import { messageOf } from '../lib/errorMessage';
import { ROLE_SHORT } from '../lib/labels';
import { companiesQuery, roomsQuery } from '../lib/queries';
import { absoluteTime, relativeTime } from '../lib/relativeTime';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Every room this person is a participant in (D12). The list is their
 * `room_participants` rows, so a room they were removed from simply isn't here.
 */
export function RoomsIndex() {
  const rooms = useQuery(roomsQuery);
  const companies = useQuery(companiesQuery);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
const deleteMutation = useMutation({
  mutationFn: async (roomId: string) => {
    const res = await fetch(`/api/rooms/${roomId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'deleted' }),
    });

    if (!res.ok) {
      throw new Error('Failed to delete room');
    }

    return res;
  },

  onSuccess: async (_, roomId) => {
    await queryClient.invalidateQueries({
      queryKey: ['rooms'],
    });

    await queryClient.invalidateQueries({
      queryKey: ['room', roomId],
    });
  },

  onError: (error) => {
    console.error('Room deletion failed:', error);
  },
})
  const primaryCompany = companies.data?.[0];

  return (
    <PlainLayout>
      <PageHeader
        title="Rooms"
        subtitle="Every data room you have access to."
        actions={
          <>
            {primaryCompany ? (
              <Button
                onClick={() =>
                  void navigate({
                    to: '/companies/$companyId/dashboard',
                    params: { companyId: primaryCompany.companyId },
                  })
                }
              >
                Company Dashboard
              </Button>
            ) : null}
            <Button intent="primary" icon={<PlusIcon />} onClick={() => void navigate({ to: '/rooms/new' })}>
              Create a data room
            </Button>
          </>
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
              <RoomCard key={room.id} room={room} deleteMutation={deleteMutation} />
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

function RoomCard({
  room,
  deleteMutation,
}: {
  room: RoomListItem;
  deleteMutation: { mutate: (id: string) => void; mutateAsync: (id: string) => Promise<unknown> };
}) {
  const { colors, space, shadows } = useVeyraTokens();
  const { modal } = App.useApp();
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
        {/* Delete Button */}
        {room.participantStatus !== 'revoked' && room.status !== 'deleted' && (
          <Button
            onClick={(event) => {
              // The card is a link into the room — don't navigate on Delete.
              event.preventDefault();
              event.stopPropagation();
              modal.confirm({
                title: `Delete “${room.name}”?`,
                content:
                  'This data room will be permanently marked as deleted. This action cannot be undone.',
                okText: 'Delete',
                okButtonProps: { danger: true },
                cancelText: 'Cancel',
                onOk: () => deleteMutation.mutateAsync(room.id),
              });
            }}
            style={{ marginLeft: 8 }}
            intent="danger"
          >
            Delete
          </Button>
        )}
      </div>
    </Link>
  );
}
