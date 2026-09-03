import { useEffect, type ReactNode } from 'react';
import { Tooltip } from 'antd';
import { Link, Outlet, useMatchRoute, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { Brand } from './Brand';
import { HeaderBar } from './HeaderBar';
import {
  ActivityIcon,
  CollapseRailIcon,
  DocumentsIcon,
  DossierIcon,
  ExpandRailIcon,
  GroupsIcon,
  LogOutIcon,
  OverviewIcon,
  SettingsIcon,
} from './icons';
import { RoomSwitcher } from './RoomSwitcher';
import { roomQuery } from '../lib/queries';
import { rememberRoom } from '../lib/lastRoom';
import { useSidebarMode, type SidebarMode } from '../lib/sidebarMode';
import { useLogout } from '../app/session';

/** Lucide draws on a 24px grid; 18px is the size that sits right next to 14px text. */
const ICON = 18;

/*
 * Seven destinations, not eight: Q&A is the first thing after this release and
 * mvp-plan §1 keeps its slot reserved but unrendered, so nobody clicks into a
 * dead end.
 */
const NAV = [
  { to: '/rooms/$roomId/overview', label: 'Overview', icon: <OverviewIcon size={ICON} /> },
  { to: '/rooms/$roomId/dossier', label: 'Dossier', icon: <DossierIcon size={ICON} /> },
  { to: '/rooms/$roomId/documents', label: 'Documents', icon: <DocumentsIcon size={ICON} /> },
  { to: '/rooms/$roomId/groups', label: 'Groups', icon: <GroupsIcon size={ICON} /> },
  { to: '/rooms/$roomId/activity', label: 'Activity', icon: <ActivityIcon size={ICON} /> },
] as const;

/*
 * Settings is a destination like any other, but it belongs to the room's setup
 * rather than its content — so it sits at the foot of the rail with sign-out,
 * away from the five things people came here to do.
 */
const FOOT = { to: '/rooms/$roomId/settings', label: 'Settings', icon: <SettingsIcon size={ICON} /> } as const;

/** Wide enough for the longest label; narrow enough to be only its icons. */
const WIDTH: Record<SidebarMode, number> = { full: 244, compact: 76 };

/** The gutter of ground around the page panel. */
const INSET = 12;

/** One row of the rail. `Link` and `button` differ enough to be worth sharing the skin. */
function navRowStyle(args: {
  active: boolean;
  compact: boolean;
  colors: ReturnType<typeof useVeyraTokens>['colors'];
  space: ReturnType<typeof useVeyraTokens>['space'];
}): React.CSSProperties {
  const { active, compact, colors, space } = args;
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: compact ? 'center' : 'flex-start',
    gap: space.md,
    // Square when there's no label to give the row its width, so the hover and
    // selected fills stay centred on the icon instead of stretching past it.
    padding: compact ? `${space.sm + 2}px 0` : `${space.sm}px ${space.md}px`,
    borderRadius: 10,
    fontWeight: active ? 600 : 400,
    color: active ? colors.sidebarTextActive : colors.sidebarText,
    background: active ? colors.sidebarActiveBg : 'transparent',
  };
}

/**
 * The room chrome every in-room page renders inside. The route guard has
 * already resolved the room and bounced a pending NDA, so this only has to draw.
 *
 * Rail and header are the *shell*: they sit directly on the ground with no
 * surface of their own. The page is the one thing that gets a surface — a
 * single rounded panel every screen renders inside — so the app frame stays
 * still and only the middle changes as you navigate.
 */
export function RoomLayout() {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId' });
  const { colors, radius, shadows, space } = useVeyraTokens();
  const room = useQuery(roomQuery(roomId)).data;
  const matchRoute = useMatchRoute();
  const logout = useLogout();
  const { mode, toggle } = useSidebarMode();

  useEffect(() => rememberRoom(roomId), [roomId]);

  if (!room) return null; // resolved by the guard; this covers the first paint

  const compact = mode === 'compact';

  /** A collapsed row has no label, so the tooltip carries the name instead. */
  const withLabel = (text: string, node: ReactNode) =>
    compact ? (
      <Tooltip key={text} title={text} placement="right">
        {node}
      </Tooltip>
    ) : (
      node
    );

  const row = (to: string, text: string, icon: ReactNode) => {
    const active = Boolean(matchRoute({ to, params: { roomId } }));
    return withLabel(
      text,
      <Link
        key={to}
        to={to}
        params={{ roomId }}
        aria-current={active ? 'page' : undefined}
        aria-label={compact ? text : undefined}
        className="veyra-rail-row"
        style={navRowStyle({ active, compact, colors, space })}
      >
        {icon}
        {compact ? null : text}
      </Link>,
    );
  };

  const toggleButton = (
    <Tooltip title={compact ? 'Expand the sidebar' : 'Collapse the sidebar'} placement="right">
      <button
        type="button"
        aria-label={compact ? 'Expand the sidebar' : 'Collapse the sidebar'}
        className="veyra-rail-row"
        onClick={toggle}
        style={{
          ...navRowStyle({ active: false, compact, colors, space }),
          ...(compact ? { width: '100%' } : { padding: space.xs }),
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        {compact ? <ExpandRailIcon size={ICON} /> : <CollapseRailIcon size={ICON} />}
      </button>
    </Tooltip>
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: INSET,
        // A fixed height, not a minimum: the shell is the window, and anything
        // that outgrows it scrolls *inside* a panel. With `minHeight` a long
        // dossier pushed the whole frame taller and took the header with it.
        height: '100dvh',
        overflow: 'hidden',
        padding: INSET,
        boxSizing: 'border-box',
        background: colors.bgCanvas,
      }}
    >
      <nav
        aria-label="Room"
        style={{
          width: WIDTH[mode],
          flex: `0 0 ${WIDTH[mode]}px`,
          position: 'sticky',
          top: INSET,
          alignSelf: 'flex-start',
          height: `calc(100dvh - ${INSET * 2}px)`,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: space.lg,
          paddingBlock: space.sm,
          background: 'transparent',
          // Read back by `.veyra-rail-row:hover` in index.css.
          ['--veyra-rail-hover' as string]: colors.sidebarHoverBg,
          ['--veyra-rail-active' as string]: colors.sidebarActiveBg,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: compact ? 'center' : 'space-between',
            gap: space.sm,
            paddingInline: compact ? 0 : space.xs,
          }}
        >
          <Link to="/" style={{ display: 'block' }} aria-label="Veyra">
            <Brand size={18} showWordmark={!compact} />
          </Link>
          {compact ? null : toggleButton}
        </div>

        {compact ? toggleButton : null}

        <RoomSwitcher room={room} compact={compact} />

        <Stack gap="xxs" style={{ flex: 1 }}>
          {NAV.map((item) => row(item.to, item.label, item.icon))}
        </Stack>

        {/* Room admin and the way out. Pinned to the foot with a gap above —
            the distance is the separation, so no rule is needed. */}
        <Stack gap="xxs" style={{ paddingTop: space.md }}>
          {row(FOOT.to, FOOT.label, FOOT.icon)}
          {withLabel(
            'Log out',
            <button
              type="button"
              aria-label={compact ? 'Log out' : undefined}
              className="veyra-rail-row"
              onClick={() => void logout()}
              style={{
                ...navRowStyle({ active: false, compact, colors, space }),
                width: '100%',
                background: 'transparent',
                border: 'none',
                font: 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <LogOutIcon size={ICON} />
              {compact ? null : 'Log out'}
            </button>,
          )}
        </Stack>
      </nav>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: space.sm,
        }}
      >
        <HeaderBar />
        {/* The page panel. `minHeight: 0` is what lets a page build a
            full-height, independently scrolling layout instead of growing the
            whole document; `overflow: hidden` is what keeps its corners round
            when it does. */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: radius.xl,
            // `auto` rather than `hidden`: a page that outgrows the panel
            // scrolls within it, and the corners still clip either way.
            overflowY: 'auto',
            background: colors.bgSurface,
            boxShadow: shadows.sm,
          }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
