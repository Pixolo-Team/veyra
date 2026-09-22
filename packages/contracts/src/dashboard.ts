import { z } from 'zod';
import { idSchema } from './common';
import { activeSideSchema, participantRoleSchema, roomStatusSchema } from './enums';
import { invitationSchema } from './invitations';
import { participantGroupSchema } from './participants';

/**
 * Per-dataroom dashboard (Overview page) contract.
 *
 * One endpoint (`GET /rooms/:roomId/dashboard`) answers every role. The
 * server computes everything and nulls the blocks a role must not see —
 * invitations, participants, downloads, medians, recipient activity — so the
 * client only decides *layout*, never *access*.
 *
 * Role map used by the UI:
 *   D1 = discloser + admin        R1 = recipient + admin
 *   D2 = discloser + contributor  R2 = recipient + contributor
 * (`reviewer` renders as its side's contributor.)
 */

export const dashboardViewerSchema = z.object({
  side: activeSideSchema,
  role: participantRoleSchema,
  participantId: idSchema,
});
export type DashboardViewer = z.infer<typeof dashboardViewerSchema>;

export const dashboardModuleSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  section: z.enum(['dossier', 'documents']),
  documentCount: z.number().int(),
  /** A module counts as complete once it holds at least one document. */
  completed: z.boolean(),
});
export type DashboardModule = z.infer<typeof dashboardModuleSchema>;

export const dashboardLeaderboardEntrySchema = z.object({
  name: z.string(),
  company: z.string().nullable(),
  side: activeSideSchema.nullable(),
  seconds: z.number().int(),
});
export type DashboardLeaderboardEntry = z.infer<typeof dashboardLeaderboardEntrySchema>;

export const dashboardAttentionReasonSchema = z.enum(['mention', 'unanswered', 'open-thread']);
export type DashboardAttentionReason = z.infer<typeof dashboardAttentionReasonSchema>;

export const dashboardAttentionItemSchema = z.object({
  threadId: idSchema,
  documentId: idSchema.nullable(),
  documentName: z.string().nullable(),
  reason: dashboardAttentionReasonSchema,
  createdAt: z.string(),
});
export type DashboardAttentionItem = z.infer<typeof dashboardAttentionItemSchema>;

export const dashboardSchema = z.object({
  roomId: idSchema,
  roomName: z.string(),
  status: roomStatusSchema,
  viewer: dashboardViewerSchema,

  /** Setup checklist — how many modules hold documents yet. Shown to all. */
  checklist: z.object({
    modules: z.array(dashboardModuleSchema),
    completedCount: z.number().int(),
    totalCount: z.number().int(),
  }),

  /**
   * Invitations left to accept. D1 sees every pending invite, R1 the
   * recipient side's, everyone else gets null.
   */
  invitations: z
    .object({
      pendingCount: z.number().int(),
      items: z.array(invitationSchema),
    })
    .nullable(),

  /** Questions/comments. Counts respect thread visibility for the viewer. */
  threads: z.object({
    open: z.number().int(),
    resolved: z.number().int(),
    /** Open threads the viewer started or last touched. */
    myOpen: z.number().int(),
    myTotal: z.number().int(),
  }),

  documents: z.object({
    total: z.number().int(),
    /** Never opened by anyone. */
    unopened: z.number().int(),
    /** Never opened by the recipient side. */
    unread: z.number().int(),
    /** More than one version. */
    revised: z.number().int(),
    /** Distinct docs carrying at least one open thread. */
    unresolved: z.number().int(),
    /** Distinct docs carrying at least one thread, open or resolved. */
    withFeedback: z.number().int(),
  }),

  /** % of docs opened at least once by the recipient side. */
  coverage: z.object({
    viewed: z.number().int(),
    total: z.number().int(),
    /** 0–100, rounded. Null when there are no documents. */
    pct: z.number().nullable(),
  }),

  /** % of docs the viewer personally opened. */
  dossierOpened: z.object({
    viewed: z.number().int(),
    total: z.number().int(),
    pct: z.number().nullable(),
  }),

  /** Recipient pulse. D1 only, else null. */
  recipient: z
    .object({
      lastActiveAt: z.string().nullable(),
      daysSinceActive: z.number().int().nullable(),
    })
    .nullable(),

  /** Files that left the room. D1 only, else null. */
  downloads: z.object({ count: z.number().int() }).nullable(),

  reading: z.object({
    /** Seconds the viewer had documents open. */
    mySeconds: z.number().int(),
    totalSeconds: z.number().int(),
    /** Most reading time first, top 5. */
    leaderboard: z.array(dashboardLeaderboardEntrySchema),
  }),

  /** Reply/resolve medians over visible threads, in seconds. D1 only. */
  medians: z
    .object({
      replySeconds: z.number().int().nullable(),
      resolveSeconds: z.number().int().nullable(),
    })
    .nullable(),

  /**
   * People and their access. D1 sees every company group, R1 the recipient
   * groups, everyone else gets null.
   */
  participants: z.array(participantGroupSchema).nullable(),

  /** Open threads that need the viewer: mentions + unanswered room threads. */
  attention: z.array(dashboardAttentionItemSchema),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
