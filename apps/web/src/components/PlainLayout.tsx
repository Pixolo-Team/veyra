import type { ReactNode } from 'react';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { useVeyraTokens } from '@veyra/design-system';
import { Brand } from './Brand';
import { HeaderActions } from './HeaderBar';

/**
 * The signed-in frame for pages that sit *outside* a room — the room list and
 * room creation. Same identity affordances as the room shell, none of the room
 * navigation, because there is no room to navigate.
 */
export function PlainLayout({ children }: { children: ReactNode }) {
  const { colors, space } = useVeyraTokens();
  const matchRoute = useMatchRoute();

  const navLink = (to: string, label: string) => {
    const active = Boolean(matchRoute({ to }));
    return (
      <Link
        key={to}
        to={to}
        style={{
          padding: `${space.xs}px ${space.sm}px`,
          borderRadius: 8,
          fontWeight: active ? 600 : 400,
          fontSize: 14,
          color: active ? colors.textPrimary : colors.textSecondary,
          background: active ? colors.bgWash : 'transparent',
          textDecoration: 'none',
        }}
      >
        {label}
      </Link>
    );
  };

  return (
    <div style={{ minHeight: '100dvh', background: colors.bgCanvas }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.lg,
          padding: `${space.sm}px ${space.xl}px`,
          background: 'transparent',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space.xl }}>
          <Link to="/">
            <Brand size={18} />
          </Link>
          <nav style={{ display: 'flex', alignItems: 'center', gap: space.xs }}>
            {navLink('/rooms', 'Rooms')}
          </nav>
        </div>
        {/* No sidebar out here, so the avatar carries sign-out. */}
        <HeaderActions withUserMenu />
      </header>
      {children}
    </div>
  );
}
