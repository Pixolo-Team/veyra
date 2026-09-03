import { z } from 'zod';
import { idSchema } from './common';
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
  /** The company the actor was acting for, which is what a log is read by. */
  actorCompany: z.string().nullable(),
  actorSide: activeSideSchema.nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  /**
   * What the target is called, resolved at read time.
   *
   * Not stored on the event: a log that froze the name would keep saying
   * "Draft 2" long after the file was renamed, and an auditor reading it a
   * year later needs the row to point at something they can still find.
   */
  targetName: z.string().nullable(),
  metadata: z.record(z.unknown()),
  /** Where it came from. Null for events recorded outside a request. */
  ip: z.string().nullable(),
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

/** How far back the log and its totals look. */
export const activityWindowSchema = z.enum(['1', '7', '30', 'all']);
export type ActivityWindow = z.infer<typeof activityWindowSchema>;

/**
 * Pages, not a cursor.
 *
 * An audit log is the one list people are asked to cite: "the third page of
 * the July export" has to mean something, and a cursor cannot be quoted, kept
 * in a URL, or gone back to. Offset paging also yields a total, which is the
 * number the header is really being asked for.
 */
export const activityQuerySchema = z.object({
  /** 1-based, so it matches the number printed on the pager. */
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  /** Narrows to one family of events — `document` matches `document.*`. */
  group: z.string().optional(),
  days: activityWindowSchema.optional(),
});
export type ActivityQuery = z.infer<typeof activityQuerySchema>;

/**
 * The totals above the log.
 *
 * Counted over the same window as the rows beneath them, because a headline
 * that quietly measures a different period than the table under it is worse
 * than no headline.
 */
export const activitySummarySchema = z.object({
  days: activityWindowSchema,
  events: z.number().int(),
  actors: z.number().int(),
  downloads: z.number().int(),
  denied: z.number().int(),
  /** Total time with a document open, across everyone, in seconds. */
  readingSeconds: z.number().int(),
  /** Whoever spent the most of that time, and how much of it was theirs. */
  mostActive: z
    .object({
      name: z.string(),
      company: z.string().nullable(),
      shareOfReading: z.number(),
    })
    .nullable(),
});
export type ActivitySummary = z.infer<typeof activitySummarySchema>;

export const activityPageSchema = z.object({
  items: z.array(activityEventSchema),
  /** Matching rows in the whole window, not just this page. */
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type ActivityPage = z.infer<typeof activityPageSchema>;
