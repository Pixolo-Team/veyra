import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import type { ModuleSection } from '@veyra/contracts';
import { queryClient } from './queryClient';
import { RootLayout } from './RootLayout';
import { RoomLayout } from '../components/RoomLayout';
import { ApiError } from '../lib/api/client';
import { roomQuery, roomsQuery, sessionQuery } from '../lib/queries';
import { lastRoomId } from '../lib/lastRoom';
import { Login } from '../routes/Login';
import { ForgotPassword } from '../routes/ForgotPassword';
import { ResetPassword } from '../routes/ResetPassword';
import { SetPassword } from '../routes/SetPassword';
import { AcceptInvite } from '../routes/AcceptInvite';
import { RoomsIndex } from '../routes/RoomsIndex';
import { CreateRoom } from '../routes/CreateRoom';
import { RoomNda } from '../routes/RoomNda';
import { Overview } from '../routes/Overview';
import { Tree } from '../routes/Tree';
import { Groups } from '../routes/Groups';
import { Activity } from '../routes/Activity';
import { Settings } from '../routes/Settings';
import { Viewer } from '../routes/Viewer';
import { NotFound } from '../routes/NotFound';

export interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({ component: RootLayout });

// ── Public ──────────────────────────────────────────────────────────────────

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  // Returning the key only when it's present keeps `search` optional on links
  // to /login — every other screen links here without a redirect.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  component: Login,
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: ForgotPassword,
});

export const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === 'string' ? { token: search.token } : {},
  component: ResetPassword,
});

export const acceptInviteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/$token',
  component: AcceptInvite,
});

// ── Signed in ───────────────────────────────────────────────────────────────

/** Requires a session, nothing more — `/set-password` lives here. */
const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'session',
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQuery);
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: location.href }, replace: true });
    }
    return { user };
  },
});

const setPasswordRoute = createRoute({
  getParentRoute: () => sessionRoute,
  path: '/set-password',
  component: SetPassword,
});

/**
 * Everything past the forced reset. A one-time password gets you exactly one
 * screen (D11), so the check lives on the layout rather than on each page.
 */
const appRoute = createRoute({
  getParentRoute: () => sessionRoute,
  id: 'app',
  beforeLoad: ({ context }) => {
    if (context.user.mustResetPassword) {
      throw redirect({ to: '/set-password', replace: true });
    }
  },
});

/** `/` resolves to the room you were last in (D12), else the room list. */
const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const rooms = await context.queryClient.ensureQueryData(roomsQuery);
    if (rooms.length === 0) throw redirect({ to: '/rooms', replace: true });
    const remembered = lastRoomId();
    const target = rooms.find((room) => room.id === remembered) ?? rooms[0];
    throw redirect({
      to: '/rooms/$roomId/overview',
      params: { roomId: target.id },
      replace: true,
    });
  },
});

const roomsIndexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/rooms',
  component: RoomsIndex,
});

const createRoomRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/rooms/new',
  component: CreateRoom,
});

/** The NDA gate — outside the room chrome, because there is no room yet. */
const roomNdaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/rooms/$roomId/nda',
  component: RoomNda,
});

/**
 * Resolves the room and enforces the two gates every in-room page shares: the
 * room has to exist and be yours, and the NDA has to be accepted before any
 * content renders. Doing it here means no page has to remember to check.
 */
async function requireRoom<TParams extends { roomId: string }>({
  context,
  params,
}: {
  context: RouterContext;
  // Generic rather than `{ roomId: string }`: as a concrete annotation it
  // clamped the *route's* inferred params to just this one, so the viewer —
  // which also carries a documentId — lost it. The guard needs a roomId; it
  // shouldn't get a say in what else a route has.
  params: TParams;
}) {
  try {
    const room = await context.queryClient.ensureQueryData(roomQuery(params.roomId));
    if (room.ndaPending) {
      throw redirect({ to: '/rooms/$roomId/nda', params: { roomId: params.roomId }, replace: true });
    }
    return { room };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      throw redirect({ to: '/rooms', replace: true });
    }
    throw error;
  }
}

/** The room shell: navigation, switcher, header. */
const roomRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/rooms/$roomId',
  beforeLoad: requireRoom,
  component: RoomLayout,
});

const overviewRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/overview',
  component: Overview,
});

/** The selected tree node. In the URL so a reload keeps your place and a
 *  folder can be linked to. */
const nodeSearch = (search: Record<string, unknown>): { node?: string } =>
  typeof search.node === 'string' ? { node: search.node } : {};

const dossierRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/dossier',
  validateSearch: nodeSearch,
  component: () => <Tree section={'dossier' satisfies ModuleSection} />,
});

const documentsRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/documents',
  validateSearch: nodeSearch,
  component: () => <Tree section={'documents' satisfies ModuleSection} />,
});

const groupsRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/groups',
  component: Groups,
});

const activityRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/activity',
  component: Activity,
});

const settingsRoute = createRoute({
  getParentRoute: () => roomRoute,
  path: '/settings',
  component: Settings,
});

/**
 * The viewer is deliberately *not* a child of the room shell — it drops the
 * room navigation for a focused reading mode (mvp-plan §6).
 */
export const viewerRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/rooms/$roomId/documents/$documentId',
  validateSearch: (search: Record<string, unknown>): { versionId?: string; thread?: string } => ({
    ...(typeof search.versionId === 'string' ? { versionId: search.versionId } : {}),
    ...(typeof search.thread === 'string' ? { thread: search.thread } : {}),
  }),
  beforeLoad: requireRoom,
  component: Viewer,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  acceptInviteRoute,
  sessionRoute.addChildren([
    setPasswordRoute,
    appRoute.addChildren([
      indexRoute,
      roomsIndexRoute,
      createRoomRoute,
      roomNdaRoute,
      viewerRoute,
      roomRoute.addChildren([
        overviewRoute,
        dossierRoute,
        documentsRoute,
        groupsRoute,
        activityRoute,
        settingsRoute,
      ]),
    ]),
  ]),
]);

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0, // let react-query own freshness
  scrollRestoration: true,
  // Without this, an unrecognised URL renders TanStack's bare
  // `<p>Not Found</p>` — indistinguishable from a blank screen.
  defaultNotFoundComponent: NotFound,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export const roomRouteRef = roomRoute;
export const activityRouteRef = activityRoute;
