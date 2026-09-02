import { z } from 'zod';
import { anchorPayloadSchema, idSchema } from './common';
import {
  activeSideSchema,
  annotationColorSchema,
  anchorTypeSchema,
  threadStatusSchema,
  threadVisibilitySchema,
} from './enums';

// ── Annotations (3-colour highlights) ──────────────────────────────────────

export const createAnnotationRequestSchema = z
  .object({
    color: annotationColorSchema,
    anchorType: anchorTypeSchema,
    anchor: anchorPayloadSchema,
  })
  .refine((v) => v.anchorType === 'region' || v.anchor.quote, {
    message: 'a text_quote anchor needs a quote',
    path: ['anchor', 'quote'],
  });
export type CreateAnnotationRequest = z.infer<typeof createAnnotationRequestSchema>;

export const annotationSchema = z.object({
  id: idSchema,
  documentVersionId: idSchema,
  color: annotationColorSchema,
  anchorType: anchorTypeSchema,
  anchor: anchorPayloadSchema,
  authorParticipantId: idSchema,
  authorName: z.string().nullable(),
  hasThread: z.boolean(),
  createdAt: z.string(),
});
export type AnnotationDto = z.infer<typeof annotationSchema>;

// ── Comment threads & comments ─────────────────────────────────────────────

/** Rich-text body as a document node (tiptap/prosemirror-style JSON). */
export const commentBodySchema = z.object({}).passthrough();

export const createThreadRequestSchema = z.object({
  annotationId: idSchema.nullable().optional(),
  visibility: threadVisibilitySchema.default('side'),
  body: commentBodySchema,
  mentions: z.array(idSchema).max(50).optional(),
});
export type CreateThreadRequest = z.infer<typeof createThreadRequestSchema>;

export const updateThreadRequestSchema = z
  .object({
    status: threadStatusSchema.optional(),
    visibility: threadVisibilitySchema.optional(),
  })
  .refine((v) => v.status ?? v.visibility, { message: 'nothing to update' });
export type UpdateThreadRequest = z.infer<typeof updateThreadRequestSchema>;

export const addCommentRequestSchema = z.object({
  body: commentBodySchema,
  mentions: z.array(idSchema).max(50).optional(),
});
export type AddCommentRequest = z.infer<typeof addCommentRequestSchema>;

export const editCommentRequestSchema = z.object({ body: commentBodySchema });
export type EditCommentRequest = z.infer<typeof editCommentRequestSchema>;

export const commentSchema = z.object({
  id: idSchema,
  threadId: idSchema,
  authorParticipantId: idSchema,
  authorName: z.string().nullable(),
  body: commentBodySchema,
  mentions: z.array(idSchema),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
});
export type CommentDto = z.infer<typeof commentSchema>;

export const threadSchema = z.object({
  id: idSchema,
  documentVersionId: idSchema,
  annotationId: idSchema.nullable(),
  annotation: annotationSchema.nullable(),
  status: threadStatusSchema,
  visibility: threadVisibilitySchema,
  authorSide: activeSideSchema,
  createdByParticipantId: idSchema,
  createdByName: z.string().nullable(),
  resolvedByName: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  carriedFromVersionId: idSchema.nullable(),
  createdAt: z.string(),
  comments: z.array(commentSchema),
});
export type ThreadDto = z.infer<typeof threadSchema>;

/** Sidebar filters (mvp-plan §5.4). */
export const threadListQuerySchema = z.object({
  color: annotationColorSchema.optional(),
  status: threadStatusSchema.optional(),
  authorParticipantId: idSchema.optional(),
  sharedWithMe: z.coerce.boolean().optional(),
});
export type ThreadListQuery = z.infer<typeof threadListQuerySchema>;
