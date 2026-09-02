import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Transactional email is written to the `email_messages` outbox, never sent
 * inline — a provider outage can't lose an invite (mvp-plan §3). A worker that
 * drains the outbox to Resend/SES is not built yet; for now rows just sit
 * `queued` and are visible in the table.
 */
export type EmailTemplate =
  | 'account_activation'
  | 'room_welcome'
  | 'room_invite' // new user — set-password link
  | 'room_added' // existing user — open room
  | 'invite_reminder'
  | 'password_reset'
  | 'password_changed'
  | 'comment_digest'
  | 'document_digest';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(
    toEmail: string,
    template: EmailTemplate,
    payload: Prisma.JsonObject = {},
    opts: { scheduledFor?: Date; client?: Prisma.TransactionClient } = {},
  ): Promise<void> {
    const db = opts.client ?? this.prisma;
    await db.emailMessage.create({
      data: { toEmail, template, payload, scheduledFor: opts.scheduledFor },
    });
    this.logger.log(`Queued "${template}" → ${toEmail}`);
  }
}
