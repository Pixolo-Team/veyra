import { z } from 'zod';
import { emailSchema, idSchema } from './common';
import { activeSideSchema, invitationStatusSchema, participantRoleSchema } from './enums';

// ── Company resolution (mvp-plan §5.2) ──────────────────────────────────────
// Fuzzy match on company name + verified domains, with the invitee's email
// domain pre-suggesting one. Suggestions only — free-text creation is an
// explicit choice on the client.

export const companyResolveQuerySchema = z.object({
  email: emailSchema.optional(),
  q: z.string().min(1).max(160).optional(),
});
export type CompanyResolveQuery = z.infer<typeof companyResolveQuerySchema>;

export const companySuggestionSchema = z.object({
  id: idSchema,
  name: z.string(),
  primaryDomain: z.string().nullable(),
  matchedOn: z.enum(['domain', 'name']),
});
export type CompanySuggestion = z.infer<typeof companySuggestionSchema>;

// ── Invitations ────────────────────────────────────────────────────────────

/** The inviter answers role + company; `side` is derived from the company
 *  against the room (FR-INV-01) but may be sent as a hint. */
export const createInvitationRequestSchema = z
  .object({
    email: emailSchema,
    role: participantRoleSchema,
    side: activeSideSchema.optional(),
    companyId: idSchema.optional(),
    companyName: z.string().min(2).max(160).optional(),
  })
  .refine((v) => v.companyId ?? v.companyName, {
    message: 'companyId or companyName is required',
    path: ['companyId'],
  });
export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const invitationSchema = z.object({
  id: idSchema,
  email: z.string(),
  role: participantRoleSchema,
  side: activeSideSchema,
  status: invitationStatusSchema,
  companyName: z.string().nullable(),
  invitedByName: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type InvitationDto = z.infer<typeof invitationSchema>;

/** Public preview shown on the accept screen before the user commits. */
export const invitationPreviewSchema = z.object({
  roomName: z.string(),
  inviterName: z.string().nullable(),
  discloserCompanyName: z.string().nullable(),
  role: participantRoleSchema,
  side: activeSideSchema,
  email: z.string(),
  isNewUser: z.boolean(),
  ndaRequired: z.boolean(),
  ndaVersion: z.string().nullable(),
  status: invitationStatusSchema,
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const acceptInvitationRequestSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  password: z.string().min(12).max(200).optional(), // new users only
  ndaAccepted: z.boolean().optional(),
});
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
