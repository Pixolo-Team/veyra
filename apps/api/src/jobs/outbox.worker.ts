import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { MailerService } from '../email/mailer.service';
import { PrismaService } from '../prisma/prisma.service';

const BATCH = 25;
const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [0, 60_000, 300_000, 1_800_000, 3_600_000];

/**
 * Drains the `email_messages` outbox (mvp-plan §3). Runs every 20s; claims rows
 * with a conditional `queued → sending` update so a second instance can't
 * double-send. Retries with backoff, then parks at `failed`.
 */
@Injectable()
export class OutboxWorker {
  private readonly logger = new Logger(OutboxWorker.name);
  private readonly enabled: boolean;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('WORKERS_ENABLED', { infer: true });
  }

  @Interval('outbox', 20_000)
  async tick(): Promise<void> {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      await this.drain();
    } catch (err) {
      this.logger.error('Outbox drain failed', err as Error);
    } finally {
      this.running = false;
    }
  }

  private async drain(): Promise<void> {
    const due = await this.prisma.emailMessage.findMany({
      where: {
        status: 'queued',
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });

    for (const msg of due) {
      const claimed = await this.prisma.emailMessage.updateMany({
        where: { id: msg.id, status: 'queued' },
        data: { status: 'sending' },
      });
      if (claimed.count !== 1) continue;

      try {
        const { providerMessageId } = await this.mailer.send({
          to: msg.toEmail,
          template: msg.template,
          payload: (msg.payload as Record<string, unknown>) ?? {},
        });
        await this.prisma.emailMessage.update({
          where: { id: msg.id },
          data: {
            status: 'sent',
            providerMessageId,
            sentAt: new Date(),
            attempts: { increment: 1 },
          },
        });
      } catch (err) {
        const attempts = msg.attempts + 1;
        const dead = attempts >= MAX_ATTEMPTS;
        await this.prisma.emailMessage.update({
          where: { id: msg.id },
          data: {
            status: dead ? 'failed' : 'queued',
            attempts,
            lastError: (err as Error).message.slice(0, 500),
            scheduledFor: dead
              ? null
              : new Date(Date.now() + (BACKOFF_MS[attempts] ?? 3_600_000)),
          },
        });
        this.logger.warn(`Email ${msg.id} attempt ${attempts} failed: ${(err as Error).message}`);
      }
    }
  }
}
