import type { EmailTemplate } from './email.service';

export interface RenderedEmail {
  subject: string;
  text: string;
}

type Payload = Record<string, unknown>;
const s = (p: Payload, k: string, fallback = ''): string =>
  typeof p[k] === 'string' && p[k] ? (p[k] as string) : fallback;
const n = (p: Payload, k: string): number => (typeof p[k] === 'number' ? (p[k] as number) : 0);

/**
 * Plain-text renderers. React Email templates (mvp-plan §3) replace these when
 * the design work lands; the payload shapes are what the callers already pass.
 */
export const TEMPLATES: Record<EmailTemplate, (p: Payload) => RenderedEmail> = {
  account_activation: (p) => ({
    subject: 'Activate your Veyra account',
    text: `Set your password to get started: ${s(p, 'link', '<link>')}`,
  }),
  room_welcome: (p) => ({
    subject: `Your data room "${s(p, 'roomName', 'room')}" is ready`,
    text: 'Your first room is set up. Invite your counterparty when you are ready.',
  }),
  room_invite: (p) => ({
    subject: `You've been invited to review "${s(p, 'roomName', 'a data room')}"`,
    text: `${s(p, 'inviterName', 'A Veyra user')} invited you as ${s(p, 'role', 'reviewer')}.\nSet a password to accept: ${s(p, 'link', `/invite/${s(p, 'token')}`)}`,
  }),
  room_added: (p) => ({
    subject: `You've been added to "${s(p, 'roomName', 'a data room')}"`,
    text: `${s(p, 'inviterName', 'A Veyra user')} added you as ${s(p, 'role', 'reviewer')}. Open the room to continue: ${s(p, 'link', `/invite/${s(p, 'token')}`)}`,
  }),
  invite_reminder: (p) => ({
    subject: `Reminder: your invitation to "${s(p, 'roomName', 'a data room')}"`,
    text: `You still have a pending invitation. It expires ${s(p, 'expiresAt', 'soon')}.`,
  }),
  password_reset: (p) => ({
    subject: 'Reset your Veyra password',
    text: `Use this link within ${n(p, 'expiresInMinutes') || 15} minutes: ${s(p, 'link', `/reset?token=${s(p, 'token')}`)}`,
  }),
  password_changed: () => ({
    subject: 'Your Veyra password was changed',
    text: 'If this was not you, contact your Veyra administrator immediately.',
  }),
  comment_digest: (p) => ({
    subject: 'New activity on a thread you follow',
    text: `There is new activity in room ${s(p, 'roomId', '')} (${s(p, 'reason', 'update')}).`,
  }),
  document_digest: (p) => ({
    subject: `${n(p, 'documentCount')} new document(s) in "${s(p, 'roomName', 'your data room')}"`,
    text: `${n(p, 'documentCount')} new document(s) were added across ${n(p, 'moduleCount')} module(s) in the last day.`,
  }),
};

export function render(template: string, payload: Payload): RenderedEmail {
  const fn = TEMPLATES[template as EmailTemplate];
  return fn ? fn(payload) : { subject: `Veyra: ${template}`, text: JSON.stringify(payload) };
}
