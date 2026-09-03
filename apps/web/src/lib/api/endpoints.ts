/**
 * Typed wrappers over every route the MVP client uses. One function per
 * endpoint, named for the route — types come from `@veyra/contracts`, so a
 * server-side shape change surfaces here at typecheck time.
 *
 * Imports are type-only on purpose: `@veyra/contracts` emits CommonJS for the
 * Node API, and the client only ever needs the types.
 */
import type {
  ActivityPage,
  ActivityQuery,
  ActivitySummary,
  ActivityWindow,
  AddCommentRequest,
  AnnotationDto,
  CompanySuggestion,
  CreateAnnotationRequest,
  CreateInvitationRequest,
  CreateRoomRequest,
  CreateThreadRequest,
  DocumentDetail,
  InvitationDto,
  InvitationPreview,
  ModuleSection,
  ModuleTree,
  Overview,
  ParticipantGroup,
  RoomDetail,
  RoomListItem,
  SessionUser,
  ThreadDto,
  ThreadListQuery,
  UpdateThreadRequest,
  UploadBatchDto,
} from '@veyra/contracts';
import { api } from './client';

// ── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  /** Answers `null` rather than 401 when nobody is signed in. */
  me: () => api.get<{ user: SessionUser | null }>('/auth/me'),
  login: (body: { email: string; password: string }) =>
    api.post<{ user: SessionUser }>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  setPassword: (body: { currentPassword: string; newPassword: string }) =>
    api.post<void>('/auth/set-password', body),
  requestPasswordReset: (email: string) => api.post<{ ok: true }>('/auth/password-reset', { email }),
  confirmPasswordReset: (body: { token: string; newPassword: string }) =>
    api.post<void>('/auth/password-reset/confirm', body),
};

// ── Rooms ───────────────────────────────────────────────────────────────────

export const roomsApi = {
  list: () => api.get<RoomListItem[]>('/rooms'),
  get: (roomId: string) => api.get<RoomDetail>(`/rooms/${roomId}`),
  create: (body: CreateRoomRequest) => api.post<RoomDetail>('/rooms', body),
  participants: (roomId: string) => api.get<ParticipantGroup[]>(`/rooms/${roomId}/participants`),
  acceptNda: (roomId: string) =>
    api.post<RoomDetail>(`/rooms/${roomId}/accept-nda`, { ndaAccepted: true }),
};

// ── Invitations & company resolution ────────────────────────────────────────

export const invitationsApi = {
  list: (roomId: string) => api.get<InvitationDto[]>(`/rooms/${roomId}/invitations`),
  create: (roomId: string, body: CreateInvitationRequest) =>
    api.post<InvitationDto>(`/rooms/${roomId}/invitations`, body),
  preview: (token: string) => api.get<InvitationPreview>(`/invitations/${token}`),
  accept: (body: { token: string; name?: string; password?: string; ndaAccepted?: boolean }) =>
    api.post<{ user: SessionUser }>('/invitations/accept', body),
};

export const companiesApi = {
  resolve: (query: { email?: string; q?: string }) =>
    api.get<CompanySuggestion[]>('/companies/resolve', { query }),
};

// ── Data room ───────────────────────────────────────────────────────────────

export const treeApi = {
  get: (roomId: string, section: ModuleSection) =>
    api.get<ModuleTree[]>(`/rooms/${roomId}/tree`, { query: { section } }),
};

export const foldersApi = {
  // The API answers with the id only — the caller already knows the name.
  create: (roomId: string, body: { name: string; roomModuleId: string; parentFolderId?: string | null }) =>
    api.post<{ id: string }>(`/rooms/${roomId}/folders`, body),
  rename: (folderId: string, name: string) => api.patch<void>(`/folders/${folderId}`, { name }),
  move: (folderId: string, parentFolderId: string | null) =>
    api.patch<void>(`/folders/${folderId}/move`, { parentFolderId }),
  remove: (folderId: string) => api.delete<void>(`/folders/${folderId}`),
};

export const documentsApi = {
  get: (documentId: string) => api.get<DocumentDetail>(`/documents/${documentId}`),
  rename: (documentId: string, name: string) => api.patch<void>(`/documents/${documentId}`, { name }),
  move: (documentId: string, body: { folderId: string | null; roomModuleId?: string }) =>
    api.patch<void>(`/documents/${documentId}/move`, body),
  remove: (documentId: string) => api.delete<void>(`/documents/${documentId}`),
  /**
   * Reports how long a document was open, on the way out.
   *
   * `sendBeacon` rather than fetch: this fires as the tab is closing, and a
   * normal request at that moment is cancelled by the browser more often than
   * it lands. A beacon is queued by the browser and survives the page.
   */
  recordView: (versionId: string, seconds: number, pagesRead?: number) => {
    const body = JSON.stringify({ seconds, ...(pagesRead ? { pagesRead } : {}) });
    const url = `/api/document-versions/${versionId}/read`;
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
    // Older browsers, and the case where the beacon queue is full.
    void fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
    }).catch(() => undefined);
  },
  contentUrl: (versionId: string) =>
    api.get<{ url: string; expiresInSeconds: number; watermark: string | null }>(
      `/document-versions/${versionId}/content`,
    ),
  downloadUrl: (versionId: string) =>
    api.get<{ url: string; expiresInSeconds: number }>(`/document-versions/${versionId}/download`),
};

export const uploadApi = {
  /** Single-file upload — the "add files here" path on a tree node. */
  document: (roomId: string, file: File, fields: { roomModuleId: string; folderId?: string }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('roomModuleId', fields.roomModuleId);
    if (fields.folderId) form.append('folderId', fields.folderId);
    return api.upload<DocumentDetail>(`/rooms/${roomId}/documents`, form);
  },
  /** Replace — produces v2 of an existing document (D4). */
  version: (documentId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<DocumentDetail>(`/documents/${documentId}/versions`, form);
  },
  createBatch: (roomId: string, body: { roomModuleId: string; folderId?: string | null; paths: string[] }) =>
    api.post<UploadBatchDto>(`/rooms/${roomId}/upload-batches`, body),
  getBatch: (batchId: string) => api.get<UploadBatchDto>(`/upload-batches/${batchId}`),
  batchFile: (batchId: string, file: File, relativePath: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('relativePath', relativePath);
    return api.upload<UploadBatchDto>(`/upload-batches/${batchId}/files`, form);
  },
  completeBatch: (batchId: string) => api.post<UploadBatchDto>(`/upload-batches/${batchId}/complete`),
};

// ── Review ──────────────────────────────────────────────────────────────────

export const reviewApi = {
  listAnnotations: (versionId: string) =>
    api.get<AnnotationDto[]>(`/document-versions/${versionId}/annotations`),
  createAnnotation: (versionId: string, body: CreateAnnotationRequest) =>
    api.post<AnnotationDto>(`/document-versions/${versionId}/annotations`, body),
  deleteAnnotation: (annotationId: string) => api.delete<void>(`/annotations/${annotationId}`),

  listThreads: (versionId: string, query: ThreadListQuery = {}) =>
    api.get<ThreadDto[]>(`/document-versions/${versionId}/threads`, {
      query: query as Record<string, string | boolean | undefined>,
    }),
  createThread: (versionId: string, body: CreateThreadRequest) =>
    api.post<ThreadDto>(`/document-versions/${versionId}/threads`, body),
  getThread: (threadId: string) => api.get<ThreadDto>(`/threads/${threadId}`),
  updateThread: (threadId: string, body: UpdateThreadRequest) =>
    api.patch<ThreadDto>(`/threads/${threadId}`, body),
  addComment: (threadId: string, body: AddCommentRequest) =>
    api.post<ThreadDto>(`/threads/${threadId}/comments`, body),
  editComment: (commentId: string, body: { body: Record<string, unknown> }) =>
    api.patch<void>(`/comments/${commentId}`, body),
  deleteComment: (commentId: string) => api.delete<void>(`/comments/${commentId}`),
};

// ── Overview & activity ─────────────────────────────────────────────────────

export const overviewApi = {
  get: (roomId: string) => api.get<Overview>(`/rooms/${roomId}/overview`),
  activity: (roomId: string, query: ActivityQuery) =>
    api.get<ActivityPage>(`/rooms/${roomId}/activity`, {
      query: query as Record<string, string | number | undefined>,
    }),
  activitySummary: (roomId: string, days: ActivityWindow) =>
    api.get<ActivitySummary>(`/rooms/${roomId}/activity/summary`, { query: { days } }),
  activityCsvUrl: (roomId: string) => `/api/rooms/${roomId}/activity.csv`,
};
