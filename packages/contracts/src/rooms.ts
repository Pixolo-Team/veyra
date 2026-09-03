import { z } from 'zod';
import { emailSchema, idSchema } from './common';
import {
  activeSideSchema,
  moduleSectionSchema,
  participantRoleSchema,
  participantStatusSchema,
  roomStatusSchema,
} from './enums';

/** Step 1 of room creation — the room exists after this (invite step is skippable). */
export const createRoomRequestSchema = z.object({
  name: z.string().min(2).max(120),
  recipientCompanyId: idSchema.optional(),
  recipientCompanyName: z.string().min(2).max(160).optional(),
  ndaRequired: z.boolean().default(true),
  allowDownload: z.boolean().default(false),
  watermarkEnabled: z.boolean().default(true),
});
export type CreateRoomRequest = z.infer<typeof createRoomRequestSchema>;

/** Step 2 — the inviter only picks the level; side follows from the company (FR-INV-01). */
export const inviteParticipantRequestSchema = z.object({
  email: emailSchema,
  role: participantRoleSchema,
  side: activeSideSchema,
  companyId: idSchema.optional(),
  companyName: z.string().min(2).max(160).optional(),
});
export type InviteParticipantRequest = z.infer<typeof inviteParticipantRequestSchema>;

/**
 * A room moves through draft → active → closed, and can be archived from any
 * of them. `archived` is a filing state, not a deletion: the room stays
 * readable and can be restored to `closed`.
 */
export const ROOM_STATUS_TRANSITIONS: Record<
  z.infer<typeof roomStatusSchema>,
  readonly z.infer<typeof roomStatusSchema>[]
> = {
  draft: ['active', 'archived'],
  active: ['closed', 'archived'],
  closed: ['active', 'archived'],
  archived: ['closed'],
};

export const updateRoomStatusRequestSchema = z.object({ status: roomStatusSchema });
export type UpdateRoomStatusRequest = z.infer<typeof updateRoomStatusRequestSchema>;

export const acceptNdaRequestSchema = z.object({ ndaAccepted: z.literal(true) });
export type AcceptNdaRequest = z.infer<typeof acceptNdaRequestSchema>;

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(200).optional(), // only for new users
  ndaAccepted: z.boolean().optional(),
});
export type AcceptInviteRequest = z.infer<typeof acceptInviteRequestSchema>;

// ── Responses ───────────────────────────────────────────────────────────────

export const roomModuleSchema = z.object({
  id: idSchema,
  code: z.string(),
  title: z.string(),
  section: moduleSectionSchema,
  sortOrder: z.number().int(),
});
export type RoomModuleDto = z.infer<typeof roomModuleSchema>;

/** One entry in the multi-room switcher (mvp-plan D12). */
export const roomListItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  status: roomStatusSchema,
  side: activeSideSchema,
  role: participantRoleSchema,
  participantStatus: participantStatusSchema,
  lastActivityAt: z.string().nullable(),
});
export type RoomListItem = z.infer<typeof roomListItemSchema>;

export const roomDetailSchema = roomListItemSchema.extend({
  ndaRequired: z.boolean(),
  /** True when the caller still owes an NDA click-through before entering. */
  ndaPending: z.boolean(),
  allowDownload: z.boolean(),
  watermarkEnabled: z.boolean(),
  discloserCompany: z.object({ id: idSchema, name: z.string() }).nullable(),
  recipientCompany: z.object({ id: idSchema, name: z.string() }).nullable(),
  modules: z.array(roomModuleSchema),
});
export type RoomDetail = z.infer<typeof roomDetailSchema>;
