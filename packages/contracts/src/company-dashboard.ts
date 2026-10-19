import { z } from 'zod';
import { idSchema } from './common';
import { activeSideSchema, participantRoleSchema } from './enums';

/**
 * Per-company dashboard contract.
 *
 * One endpoint (`GET /companies/:companyId/dashboard`) answers every role.
 * The server computes everything and nulls the blocks a role must not see —
 * so the client only decides *layout*, never *access*.
 *
 * Role map used by the UI:
 *   D1 = discloser + admin        R1 = recipient + admin
 *   D2 = discloser + contributor  R2 = recipient + contributor
 * (`reviewer` renders as its side's contributor.)
 */

export const companyDashboardViewerSchema = z.object({
  side: activeSideSchema,
  role: participantRoleSchema,
  participantId: idSchema,
});
export type CompanyDashboardViewer = z.infer<typeof companyDashboardViewerSchema>;

export const companyDashboardModuleSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  section: z.enum(['dossier', 'documents']),
  documentCount: z.number().int(),
  completed: z.boolean(),
});
export type CompanyDashboardModule = z.infer<typeof companyDashboardModuleSchema>;

export const companyDashboardLeaderboardEntrySchema = z.object({
  name: z.string(),
  company: z.string().nullable(),
  side: activeSideSchema.nullable(),
  seconds: z.number().int(),
});
export type CompanyDashboardLeaderboardEntry = z.infer<typeof companyDashboardLeaderboardEntrySchema>;

export const companyDashboardAttentionReasonSchema = z.enum(['mention', 'unanswered', 'open-thread']);
export type CompanyDashboardAttentionReason = z.infer<typeof companyDashboardAttentionReasonSchema>;

export const companyDashboardAttentionItemSchema = z.object({
  threadId: idSchema,
  documentId: idSchema.nullable(),
  documentName: z.string().nullable(),
  reason: companyDashboardAttentionReasonSchema,
  createdAt: z.string(),
});
export type CompanyDashboardAttentionItem = z.infer<typeof companyDashboardAttentionItemSchema>;

export const companyDashboardSchema = z.object({
  companyId: idSchema,
  companyName: z.string(),
  viewer: companyDashboardViewerSchema,

  /** Setup checklist — how many modules hold documents yet. Shown to all. */
  checklist: z.object({
    modules: z.array(companyDashboardModuleSchema),
    completedCount: z.number().int(),
    totalCount: z.number().int(),
  }),

  threads: z.object({
    open: z.number().int(),
    resolved: z.number().int(),
    myOpen: z.number().int(),
    myTotal: z.number().int(),
  }),

  documents: z.object({
    total: z.number().int(),
    unopened: z.number().int(),
    unread: z.number().int(),
    revised: z.number().int(),
    unresolved: z.number().int(),
    withFeedback: z.number().int(),
  }),

  coverage: z.object({
    viewed: z.number().int(),
    total: z.number().int(),
    pct: z.number().nullable(),
  }),

  dossierOpened: z.object({
    viewed: z.number().int(),
    total: z.number().int(),
    pct: z.number().nullable(),
  }),

  recipient: z
    .object({
      lastActiveAt: z.string().nullable(),
      daysSinceActive: z.number().int().nullable(),
    })
    .nullable(),

  downloads: z.object({ count: z.number().int() }).nullable(),

  reading: z.object({
    mySeconds: z.number().int(),
    totalSeconds: z.number().int(),
    leaderboard: z.array(companyDashboardLeaderboardEntrySchema),
  }),

  medians: z.object({
    replySeconds: z.number().int().nullable(),
    resolveSeconds: z.number().int().nullable(),
  }),

  participants: z.any().nullable(),

  attention: z.array(companyDashboardAttentionItemSchema),
});
export type CompanyDashboard = z.infer<typeof companyDashboardSchema>;

/** Company list item for the dashboard header. */
export const companyDashboardSummarySchema = z.object({
  companyId: idSchema,
  totalRooms: z.number().int(),
  totalDocuments: z.number().int(),
  avgCoverage: z.number().nullable(),
});
export type CompanyDashboardSummary = z.infer<typeof companyDashboardSummarySchema>;