import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../config/env';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

/** Daily "new documents in your room" digest — mvp-plan email #9. */
@Injectable()
export class DigestJob {
  private readonly logger = new Logger(DigestJob.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('WORKERS_ENABLED', { infer: true });
  }

  @Cron('0 7 * * *')
  async run(): Promise<void> {
    if (!this.enabled) return;
    const since = new Date(Date.now() - 24 * 3600_000);

    const rooms = await this.prisma.room.findMany({
      where: { status: { not: 'closed' }, documents: { some: { createdAt: { gte: since }, deletedAt: null } } },
      select: { id: true, name: true },
    });

    for (const room of rooms) {
      const newDocs = await this.prisma.document.findMany({
        where: { roomId: room.id, createdAt: { gte: since }, deletedAt: null },
        select: { roomModuleId: true, createdBy: true },
      });
      const moduleCount = new Set(newDocs.map((d) => d.roomModuleId)).size;

      const recipients = await this.prisma.roomParticipant.findMany({
        where: {
          roomId: room.id,
          status: 'active',
          user: { notificationPrefs: { none: { roomId: room.id, frequency: 'off' } } },
        },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const p of recipients) {
        // Don't digest someone their own uploads.
        if (newDocs.every((d) => d.createdBy === p.userId)) continue;
        await this.email.enqueue(p.user.email, 'document_digest', {
          roomName: room.name,
          documentCount: newDocs.length,
          moduleCount,
        });
      }
    }
    if (rooms.length) this.logger.log(`Queued document digests for ${rooms.length} room(s)`);
  }
}
