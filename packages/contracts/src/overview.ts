import { z } from 'zod';
import { idSchema, paginationQuerySchema } from './common';
import { activeSideSchema, roomStatusSchema } from './enums';

export const setupChecklistSchema = z.object({
  recipientCompanySet: z.boolean(),
  recipientInvited: z.boolean(),
  recipientAccepted: z.boolean(),
  documentsUploaded: z.boolean(),
  ndaConfigured: z.boolean(),
});

export const dossierModuleFillSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  section: z.enum(['dossier', 'documents']),
  folderCount: z.number().int(),
  documentCount: z.number().int(),
});

export const activityEventSchema = z.object({
  id: idSchema,
  action: z.string(),
  actorName: z.string().nullable(),
  actorSide: activeSideSchema.nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const overviewSchema = z.object({
  roomId: idSchema,
  name: z.string(),
  status: roomStatusSchema,
  checklist: setupChecklistSchema,
  dossier: z.array(dossierModuleFillSchema),
  openThreads: z.object({
    total: z.number().int(),
    olderThan7d: z.number().int(),
    olderThan14d: z.number().int(),
  }),
  counterpartyReading: z.object({
    side: activeSideSchema.nullable(),
    documentsViewedLast7d: z.number().int(),
    lastViewedAt: z.string().nullable(),
  }),
  recentActivity: z.array(activityEventSchema),
});
export type Overview = z.infer<typeof overviewSchema>;

export const activityQuerySchema = paginationQuerySchema.extend({
  action: z.string().optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

export const activityPageSchema = z.object({
  items: z.array(activityEventSchema),
  nextCursor: z.string().nullable(),
});
export type ActivityPage = z.infer<typeof activityPageSchema>;
