import { Injectable } from '@nestjs/common';
import type { ActivityPage, ActivityQuery } from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { toActivityEvent } from './activity.mapper';

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
  ) {}

  async list(userId: string, roomId: string, query: ActivityQuery): Promise<ActivityPage> {
    await this.access.requireParticipant(userId, roomId);
    const rows = await this.prisma.auditEvent.findMany({
      where: {
        roomId,
        ...(query.action ? { action: query.action } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      include: { actorUser: true, actorParticipant: true },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toActivityEvent),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  /** CSV export for the Activity log (mvp-plan §6). Admin only. */
  async csv(userId: string, roomId: string): Promise<string> {
    await this.access.requireRole(userId, roomId, 'admin');
    const rows = await this.prisma.auditEvent.findMany({
      where: { roomId },
      include: { actorUser: true, actorParticipant: true },
      orderBy: { createdAt: 'desc' },
    });

    const header = ['timestamp', 'action', 'actor', 'side', 'target_type', 'target_id', 'ip', 'metadata'];
    const lines = rows.map((e) =>
      [
        e.createdAt.toISOString(),
        e.action,
        e.actorUser?.name ?? e.actorUser?.email ?? '',
        e.actorParticipant?.side ?? '',
        e.targetType ?? '',
        e.targetId ?? '',
        e.ip ?? '',
        JSON.stringify(e.metadata ?? {}),
      ]
        .map(csvCell)
        .join(','),
    );
    return [header.join(','), ...lines].join('\r\n');
  }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
