import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const KEEP_MS = 30 * 24 * 3600_000;

/** Housekeeping: drop sessions long past expiry or revocation. */
@Injectable()
export class SessionsJob {
  private readonly logger = new Logger(SessionsJob.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('WORKERS_ENABLED', { infer: true });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    if (!this.enabled) return;
    const cutoff = new Date(Date.now() - KEEP_MS);
    const { count } = await this.prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
      },
    });
    if (count) this.logger.log(`Swept ${count} stale session(s)`);
  }
}
