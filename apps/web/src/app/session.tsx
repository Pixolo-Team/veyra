import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { SessionUser } from '@veyra/contracts';
import { useCallback } from 'react';
import { authApi } from '../lib/api/endpoints';
import { qk, sessionQuery } from '../lib/queries';

/** The signed-in user, or null. Resolved once at the router root. */
export function useSession(): SessionUser | null {
  return useSuspenseQuery(sessionQuery).data;
}

/** For routes behind the auth guard, where null is already impossible. */
export function useRequiredSession(): SessionUser {
  const user = useSession();
  if (!user) throw new Error('useRequiredSession used outside an authenticated route');
  return user;
}

export function useLogout(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Everything cached was scoped to that session.
      queryClient.clear();
      queryClient.setQueryData(qk.session, null);
      await navigate({ to: '/login', replace: true });
    }
  }, [queryClient, navigate]);
}
