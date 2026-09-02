import { z } from 'zod';

/**
 * Enum values mirror prisma/schema.prisma. `facilitator` and the per-document
 * capability scopes exist in the DB enum from day one but are rejected here —
 * turning the facilitator flow on later is deleting a guard, not a migration (D6).
 */

export const sideSchema = z.enum(['discloser', 'recipient', 'facilitator']);
export const activeSideSchema = z.enum(['discloser', 'recipient']); // MVP-usable subset
export type Side = z.infer<typeof sideSchema>;

export const participantRoleSchema = z.enum(['admin', 'contributor', 'reviewer']);
export type ParticipantRole = z.infer<typeof participantRoleSchema>;

export const participantStatusSchema = z.enum(['invited', 'active', 'revoked']);
export type ParticipantStatus = z.infer<typeof participantStatusSchema>;

export const roomStatusSchema = z.enum(['draft', 'active', 'closed']);

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const moduleSectionSchema = z.enum(['dossier', 'documents']);
export type ModuleSection = z.infer<typeof moduleSectionSchema>;

export const annotationColorSchema = z.enum(['amber', 'blue', 'rose']);
export type AnnotationColor = z.infer<typeof annotationColorSchema>;

export const anchorTypeSchema = z.enum(['text_quote', 'region']);
export const threadStatusSchema = z.enum(['open', 'resolved']);
export const threadVisibilitySchema = z.enum(['side', 'room']);

export const renderStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);
export const uploadBatchStatusSchema = z.enum([
  'pending',
  'uploading',
  'processing',
  'completed',
  'failed',
]);
