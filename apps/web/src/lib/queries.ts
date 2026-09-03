/**
 * Query keys and shared query options.
 *
 * Keys are built here rather than inline so an invalidation can name a whole
 * subtree — `qk.room(roomId)` invalidates the room, its tree, its people and
 * its overview in one call after a mutation that touches several of them.
 */
import { queryOptions } from '@tanstack/react-query';
import type {
  ActivityQuery,
  ActivityWindow,
  ModuleSection,
  SessionUser,
  ThreadListQuery,
} from '@veyra/contracts';
import { ApiError } from './api/client';
import {
  authApi,
  documentsApi,
  invitationsApi,
  overviewApi,
  reviewApi,
  roomsApi,
  treeApi,
} from './api/endpoints';

export const qk = {
  session: ['session'] as const,
  rooms: ['rooms'] as const,
  room: (roomId: string) => ['rooms', roomId] as const,
  overview: (roomId: string) => ['rooms', roomId, 'overview'] as const,
  participants: (roomId: string) => ['rooms', roomId, 'participants'] as const,
  invitations: (roomId: string) => ['rooms', roomId, 'invitations'] as const,
  tree: (roomId: string, section: ModuleSection) => ['rooms', roomId, 'tree', section] as const,
  activity: (roomId: string, query: ActivityQuery) =>
    ['rooms', roomId, 'activity', query] as const,
  activitySummary: (roomId: string, days: ActivityWindow) =>
    ['rooms', roomId, 'activity-summary', days] as const,
  document: (documentId: string) => ['documents', documentId] as const,
  content: (versionId: string) => ['versions', versionId, 'content'] as const,
  annotations: (versionId: string) => ['versions', versionId, 'annotations'] as const,
  threads: (versionId: string, query: ThreadListQuery) =>
    ['versions', versionId, 'threads', query] as const,
  invitationPreview: (token: string) => ['invitation-preview', token] as const,
};

/**
 * The signed-in user, or `null`.
 *
 * The endpoint answers `null` rather than 401 — "nobody is signed in" is the
 * answer to this question, not a failure to answer it. The 401 branch is kept
 * for an older API, and every other error still propagates so a broken server
 * doesn't masquerade as a sign-out.
 */
export const sessionQuery = queryOptions({
  queryKey: qk.session,
  queryFn: async (): Promise<SessionUser | null> => {
    try {
      const { user } = await authApi.me();
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.isAuth) return null;
      throw error;
    }
  },
  retry: false,
  staleTime: 60_000,
});

export const roomsQuery = queryOptions({
  queryKey: qk.rooms,
  queryFn: () => roomsApi.list(),
});

export const roomQuery = (roomId: string) =>
  queryOptions({ queryKey: qk.room(roomId), queryFn: () => roomsApi.get(roomId) });

export const overviewQuery = (roomId: string) =>
  queryOptions({ queryKey: qk.overview(roomId), queryFn: () => overviewApi.get(roomId) });

export const participantsQuery = (roomId: string) =>
  queryOptions({ queryKey: qk.participants(roomId), queryFn: () => roomsApi.participants(roomId) });

export const invitationsQuery = (roomId: string) =>
  queryOptions({ queryKey: qk.invitations(roomId), queryFn: () => invitationsApi.list(roomId) });

export const treeQuery = (roomId: string, section: ModuleSection) =>
  queryOptions({ queryKey: qk.tree(roomId, section), queryFn: () => treeApi.get(roomId, section) });

export const documentQuery = (documentId: string) =>
  queryOptions({ queryKey: qk.document(documentId), queryFn: () => documentsApi.get(documentId) });

/** Signed content URLs expire (5 min); refetch well before that. */
export const contentQuery = (versionId: string) =>
  queryOptions({
    queryKey: qk.content(versionId),
    queryFn: () => documentsApi.contentUrl(versionId),
    staleTime: 3 * 60_000,
    gcTime: 3 * 60_000,
  });

export const annotationsQuery = (versionId: string) =>
  queryOptions({
    queryKey: qk.annotations(versionId),
    queryFn: () => reviewApi.listAnnotations(versionId),
  });

export const threadsQuery = (versionId: string, query: ThreadListQuery = {}) =>
  queryOptions({
    queryKey: qk.threads(versionId, query),
    queryFn: () => reviewApi.listThreads(versionId, query),
  });

export const activitySummaryQuery = (roomId: string, days: ActivityWindow) =>
  queryOptions({
    queryKey: qk.activitySummary(roomId, days),
    queryFn: () => overviewApi.activitySummary(roomId, days),
  });

export const invitationPreviewQuery = (token: string) =>
  queryOptions({
    queryKey: qk.invitationPreview(token),
    queryFn: () => invitationsApi.preview(token),
    retry: false,
  });
