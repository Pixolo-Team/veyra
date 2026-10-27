import { z } from 'zod';
import { idSchema } from './common';
import { activeSideSchema, participantRoleSchema, roomStatusSchema } from './enums';
import { activityEventSchema } from './overview';

/**
 * Per-company dashboard (Image 1): the rollup across every data room the
 * viewer belongs to for this company.
 *
 * One endpoint (`GET /companies/:companyId/dashboard`) answers every role. The
 * server only ever returns rooms the caller is an active participant in, so
 * there is nothing to gate on the client — the list is the access control.
 */

export const companyDashboardViewerSchema = z.object({
  side: activeSideSchema,
  role: participantRoleSchema,
});
export type CompanyDashboardViewer = z.infer<typeof companyDashboardViewerSchema>;

/** One data room, as a row in the company's dossier list. */
export const companyDashboardRoomSchema = z.object({
  roomId: idSchema,
  roomName: z.string(),
  status: roomStatusSchema,
  documentCount: z.number().int(),
  /** % of docs opened by the recipient side, 0–100; null when there are none. */
  coveragePct: z.number().nullable(),
  openThreads: z.number().int(),
  lastActivityAt: z.string().nullable(),
});
export type CompanyDashboardRoom = z.infer<typeof companyDashboardRoomSchema>;

export const companyDashboardSchema = z.object({
  companyId: idSchema,
  companyName: z.string(),
  /** How the viewer relates to this company's rooms (strongest role wins). */
  viewer: companyDashboardViewerSchema,

  summary: z.object({
    totalRooms: z.number().int(),
    totalDocuments: z.number().int(),
    openQuestions: z.number().int(),
    /** Mean coverage across rooms that have documents; null when none do. */
    avgCoveragePct: z.number().nullable(),
  }),

  /** The viewer's rooms for this company, most recently active first. */
  rooms: z.array(companyDashboardRoomSchema),

  /** Latest events across those rooms, newest first. */
  recentActivity: z.array(activityEventSchema),
});
export type CompanyDashboard = z.infer<typeof companyDashboardSchema>;

/** One entry in the "which company dashboard can I open" list. */
export const myCompanySchema = z.object({
  companyId: idSchema,
  companyName: z.string(),
  side: activeSideSchema,
  role: participantRoleSchema,
});
export type MyCompany = z.infer<typeof myCompanySchema>;
