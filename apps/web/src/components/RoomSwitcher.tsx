import { Dropdown, Tag, Tooltip, Typography } from 'antd';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { RoomDetail } from '@veyra/contracts';
import { useVeyraTokens } from '@veyra/design-system';
import { roomsQuery } from '../lib/queries';
import { ROOM_STATUS_LABELS } from '../lib/labels';
import { CheckIcon, PlusIcon, SwitchRoomIcon } from './icons';

/**
 * The multi-room switcher (D12). A person's rooms are just their participant
 * rows, so this is a query rather than a feature — but it has to be reachable
 * from every page, which is why it sits in the sidebar header.
 */
export function RoomSwitcher({ room, compact = false }: { room: RoomDetail; compact?: boolean }) {
  const { colors, space } = useVeyraTokens();
  const navigate = useNavigate();
  const rooms = useQuery(roomsQuery);

  const counterparty =
    room.side === 'discloser' ? room.recipientCompany?.name : room.discloserCompany?.name;

  const items = [
    ...(rooms.data ?? []).map((entry) => ({
      key: entry.id,
      icon: entry.id === room.id ? <CheckIcon /> : <span style={{ width: 14 }} />,
      label: (
        <span style={{ display: 'inline-flex', gap: space.sm, alignItems: 'center' }}>
          {entry.name}
          {entry.status !== 'active' ? <Tag>{entry.status}</Tag> : null}
        </span>
      ),
      onClick: () => void navigate({ to: '/rooms/$roomId/overview', params: { roomId: entry.id } }),
    })),
    { type: 'divider' as const },
    {
      key: 'all',
      icon: <SwitchRoomIcon />,
      label: 'All rooms',
      onClick: () => void navigate({ to: '/rooms' }),
    },
    {
      key: 'new',
      icon: <PlusIcon />,
      label: 'Create a data room',
      onClick: () => void navigate({ to: '/rooms/new' }),
    },
  ];

  // Collapsed, the trigger is one square the width of a nav icon. The room's
  // name has nowhere to go at that width, so its initial stands in and the
  // tooltip carries the rest.
  if (compact) {
    return (
      <Dropdown menu={{ items, selectable: false }} trigger={['click']} placement="bottomLeft">
        <Tooltip title={`${room.name} — switch room`} placement="right">
          <button
            type="button"
            aria-label={`${room.name} — switch room`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              aspectRatio: '1',
              background: colors.sidebarActiveBg,
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              color: colors.sidebarTextActive,
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {room.name.trim().slice(0, 1).toUpperCase()}
          </button>
        </Tooltip>
      </Dropdown>
    );
  }

  return (
    <Dropdown menu={{ items, selectable: false }} trigger={['click']} placement="bottomLeft">
      <button
        type="button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          width: '100%',
          padding: `${space.sm}px ${space.md}px`,
          // A tinted block on the rail's white, not an outlined box — the
          // rail separates things by ground like everything else here.
          background: colors.sidebarHoverBg,
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
          textAlign: 'left',
          color: colors.textPrimary,
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <Typography.Paragraph
            ellipsis
            style={{ margin: 0, fontWeight: 600, color: colors.textPrimary }}
          >
            {room.name}
          </Typography.Paragraph>
          <Typography.Paragraph
            ellipsis
            style={{ margin: 0, fontSize: 12, color: colors.textSecondary }}
          >
            {/* Status first: it is true of every room, where a counterparty is
                not — and "No counterparty yet" told you nothing you could act on. */}
            {counterparty
              ? `${ROOM_STATUS_LABELS[room.status]} · ${counterparty}`
              : ROOM_STATUS_LABELS[room.status]}
          </Typography.Paragraph>
        </span>
        <SwitchRoomIcon style={{ color: colors.textTertiary, flex: '0 0 auto' }} />
      </button>
    </Dropdown>
  );
}
