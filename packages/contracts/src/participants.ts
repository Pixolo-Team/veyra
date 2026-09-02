import { z } from 'zod';
import { idSchema } from './common';
import {
  activeSideSchema,
  participantRoleSchema,
  participantStatusSchema,
} from './enums';

export const participantSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string().nullable(),
  email: z.string(),
  side: activeSideSchema,
  role: participantRoleSchema,
  status: participantStatusSchema,
  ndaAcceptedAt: z.string().nullable(),
  acceptedAt: z.string().nullable(),
});
export type ParticipantDto = z.infer<typeof participantSchema>;

/** Groups screen — people by company, with pending invites alongside. */
export const participantGroupSchema = z.object({
  companyId: idSchema,
  companyName: z.string(),
  side: activeSideSchema,
  participants: z.array(participantSchema),
});
export type ParticipantGroup = z.infer<typeof participantGroupSchema>;
