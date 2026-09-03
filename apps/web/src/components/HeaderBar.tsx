import { useEffect, useRef, useState } from 'react';
import { Avatar, Badge, Button, Dropdown, Input, Popover, Tooltip, Typography } from 'antd';
import type { InputRef } from 'antd';
import { ThemeToggle, useVeyraTokens } from '@veyra/design-system';
import { useLogout, useRequiredSession } from '../app/session';
import { BellIcon, LogOutIcon, SearchIcon } from './icons';

/**
 * One letter — the first of the name, or of the email when there is no name.
 *
 * A single initial at 30px reads at a glance; two letters at that size are a
 * word you have to stop and parse, and the tooltip beside it already carries
 * the full name.
 */
function initial(name: string | null, email: string): string {
  const source = name?.trim() || email;
  return source.slice(0, 1).toUpperCase();
}

/**
 * Notifications. There is no feed behind this yet — mentions reach people by
 * email (see ThreadsService) — so the bell says so plainly rather than opening
 * an empty panel that reads as broken.
 */
function Notifications() {
  const { colors, space } = useVeyraTokens();
  return (
    <Popover
      trigger="click"
      placement="bottomRight"
      title="Notifications"
      content={
        <Typography.Paragraph
          style={{ margin: 0, maxWidth: 220, color: colors.textSecondary, paddingBlock: space.xs }}
        >
          Nothing yet. Mentions reach you by email for now.
        </Typography.Paragraph>
      }
    >
      <Badge count={0}>
        <Button type="text" aria-label="Notifications" icon={<BellIcon size={18} />} />
      </Badge>
    </Popover>
  );
}

function UserAvatar({ withMenu }: { withMenu: boolean }) {
  const { colors, space } = useVeyraTokens();
  const user = useRequiredSession();
  const logout = useLogout();

  const avatar = (
    <Avatar
      size={30}
      style={{
        background: colors.brandMark,
        marginLeft: space.xs,
        cursor: withMenu ? 'pointer' : 'default',
      }}
    >
      {initial(user.name, user.email)}
    </Avatar>
  );

  // Inside a room, signing out lives at the foot of the sidebar and the avatar
  // is pure identity. Outside one there is no sidebar, so it carries the menu.
  if (!withMenu) {
    return (
      <Tooltip title={user.name ? `${user.name} · ${user.email}` : user.email} placement="bottomRight">
        {avatar}
      </Tooltip>
    );
  }

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'email', label: user.email, disabled: true },
          { type: 'divider' },
          {
            key: 'logout',
            icon: <LogOutIcon size={14} />,
            label: 'Log out',
            onClick: () => void logout(),
          },
        ],
      }}
    >
      <button
        type="button"
        aria-label={`Account: ${user.name ?? user.email}`}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}
      >
        {avatar}
      </button>
    </Dropdown>
  );
}

/**
 * The controls that belong to the person rather than the page.
 *
 * The avatar carries no name beside it: in your own session the name answers a
 * question you aren't asking, and hover covers the "which account is this?"
 * case. Theme is a permanent icon here rather than a menu item — one press,
 * cycling light → dark → system.
 */
export function HeaderActions({ withUserMenu = false }: { withUserMenu?: boolean }) {
  const { space } = useVeyraTokens();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
      <Notifications />
      <ThemeToggle compact />
      <UserAvatar withMenu={withUserMenu} />
    </div>
  );
}

/**
 * Is this a Mac? The shortcut hint has to name the key the person actually
 * has — printing ⌘ on Windows is worse than printing nothing.
 */
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Room-wide search.
 *
 * Parked in the header rather than on a page because what people look for in a
 * data room is a document, and a document is reachable from every screen —
 * having to navigate to the dossier first in order to find something in it is
 * the wrong way round.
 *
 * There is no search endpoint yet, so this doesn't pretend to have one: it
 * takes the query and says where it will go rather than returning nothing and
 * letting that read as "no matches".
 */
function RoomSearch() {
  const { colors, radius, space } = useVeyraTokens();
  const [query, setQuery] = useState('');
  const input = useRef<InputRef>(null);

  // The hint is a promise, so the shortcut is real. A ⌘K badge on a field that
  // doesn't answer to ⌘K is decoration pretending to be an affordance.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      open={query.trim().length > 0}
      content={
        <Typography.Paragraph
          style={{ margin: 0, maxWidth: 260, color: colors.textSecondary, paddingBlock: space.xs }}
        >
          Search isn't wired up yet — this will look across document names and
          their contents in this room.
        </Typography.Paragraph>
      }
    >
      <Input
        ref={input}
        allowClear
        size="large"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search anything"
        aria-label="Search this room"
        aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
        prefix={
          <SearchIcon size={18} style={{ color: colors.textTertiary, marginInlineEnd: space.xs }} />
        }
        suffix={
          <kbd
            style={{
              fontFamily: 'inherit',
              fontSize: 11,
              lineHeight: 1.6,
              padding: `0 ${space.xs}px`,
              borderRadius: radius.sm,
              border: `1px solid ${colors.divider}`,
              color: colors.textTertiary,
              whiteSpace: 'nowrap',
            }}
          >
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        }
        style={{
          // Wide enough to balance the icon cluster on the other side, and
          // soft-edged: at full border strength the field was the loudest thing
          // in a header that is meant to sit behind the page.
          flex: '1 1 420px',
          maxWidth: 460,
          borderRadius: radius.lg,
          borderColor: colors.divider,
          background: colors.bgSurface,
        }}
      />
    </Popover>
  );
}

/** The room shell's header: search on the left, the person's controls on the right. */
export function HeaderBar() {
  const { space } = useVeyraTokens();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: space.lg,
        padding: `${space.sm}px ${space.xl}px`,
        // No rule and no surface of its own: the header reads as part of the
        // page it sits above, and the sidebar's tint is what draws the edge.
        background: 'transparent',
      }}
    >
      <RoomSearch />
      <HeaderActions />
    </div>
  );
}
