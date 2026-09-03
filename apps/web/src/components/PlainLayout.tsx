import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
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
        <Link to="/">
          <Brand size={18} />
        </Link>
        {/* No sidebar out here, so the avatar carries sign-out. */}
        <HeaderActions withUserMenu />
      </header>
      {children}
    </div>
  );
}
