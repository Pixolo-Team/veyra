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

export const roomStatusSchema = z.enum(['draft', 'active', 'closed', 'archived']);
export type RoomStatus = z.infer<typeof roomStatusSchema>;

export const invitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

export const moduleSectionSchema = z.enum(['dossier', 'documents']);
export type ModuleSection = z.infer<typeof moduleSectionSchema>;

export const annotationColorSchema = z.enum(['amber', 'blue', 'rose']);
export type AnnotationColor = z.infer<typeof annotationColorSchema>;

export const anchorTypeSchema = z.enum(['text_quote', 'region']);
export type AnchorType = z.infer<typeof anchorTypeSchema>;

export const threadStatusSchema = z.enum(['open', 'resolved']);
export type ThreadStatus = z.infer<typeof threadStatusSchema>;

export const threadVisibilitySchema = z.enum(['side', 'room']);
export type ThreadVisibility = z.infer<typeof threadVisibilitySchema>;

export const renderStatusSchema = z.enum(['pending', 'processing', 'ready', 'failed']);
export const uploadBatchStatusSchema = z.enum([
  'pending',
  'uploading',
  'processing',
  'completed',
  'failed',
]);
