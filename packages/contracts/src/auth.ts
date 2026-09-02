import { z } from 'zod';
import { emailSchema } from './common';

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Forced first-login reset off a one-time password (D11). Ends other sessions. */
export const setPasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(200),
});
export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>;

export const passwordResetRequestSchema = z.object({ email: emailSchema });
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(12).max(200),
});
export type PasswordResetConfirm = z.infer<typeof passwordResetConfirmSchema>;

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  mustResetPassword: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;
