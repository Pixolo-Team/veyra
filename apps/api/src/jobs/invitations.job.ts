import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const REMIND_AFTER_MS = 72 * 3600_000;

/** Invite reminders at 72h and expiry at 14 days (mvp-plan §5.2). */
@Injectable()
export class InvitationsJob {
  private readonly logger = new Logger(InvitationsJob.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('WORKERS_ENABLED', { infer: true });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    if (!this.enabled) return;
    const now = new Date();

    const expired = await this.prisma.invitation.updateMany({
      where: { status: 'pending', expiresAt: { lt: now } },
      data: { status: 'expired' },
    });
    if (expired.count) this.logger.log(`Expired ${expired.count} invitation(s)`);

    const toRemind = await this.prisma.invitation.findMany({
      where: {
        status: 'pending',
        remindedAt: null,
        createdAt: { lt: new Date(now.getTime() - REMIND_AFTER_MS) },
      },
      include: { room: { select: { name: true } } },
      take: 100,
    });
    for (const inv of toRemind) {
      await this.email.enqueue(inv.email, 'invite_reminder', {
        roomName: inv.room.name,
        expiresAt: inv.expiresAt.toISOString(),
      });
      await this.prisma.invitation.update({ where: { id: inv.id }, data: { remindedAt: now } });
    }
    if (toRemind.length) this.logger.log(`Sent ${toRemind.length} invite reminder(s)`);
  }
}
