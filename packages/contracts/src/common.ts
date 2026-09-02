import { z } from 'zod';

export const idSchema = z.string().min(1);
export const emailSchema = z.string().email().transform((s) => s.toLowerCase().trim());

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function pageSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** W3C-style annotation anchor payload (mvp-plan §4). rects are always present
 *  and page-relative fractions, so zoom and DPI never move a highlight. */
export const anchorPayloadSchema = z.object({
  page: z.number().int().positive(),
  quote: z
    .object({ exact: z.string(), prefix: z.string().optional(), suffix: z.string().optional() })
    .optional(),
  position: z.object({ start: z.number().int(), end: z.number().int() }).optional(),
  rects: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
      }),
    )
    .min(1),
});
export type AnchorPayload = z.infer<typeof anchorPayloadSchema>;
