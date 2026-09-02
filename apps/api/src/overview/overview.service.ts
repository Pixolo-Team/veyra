import { Injectable } from '@nestjs/common';
import type { Overview } from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { toActivityEvent } from './activity.mapper';

const DAY = 86_400_000;

/** The room dashboard (mvp-plan §6): what needs someone, without them clicking. */
@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
  ) {}

  async get(userId: string, roomId: string): Promise<Overview> {
    const me = await this.access.requireParticipant(userId, roomId);
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const otherSide = me.side === 'discloser' ? 'recipient' : 'discloser';
    const now = Date.now();

    const [
      modules,
      folderCounts,
      docCounts,
      totalDocs,
      recipientInvites,
      recipientActive,
      openThreads,
      counterpartyViews,
      recent,
    ] = await Promise.all([
      this.prisma.roomModule.findMany({ where: { roomId }, orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.folder.groupBy({ by: ['roomModuleId'], where: { roomId, deletedAt: null }, _count: true }),
      this.prisma.document.groupBy({ by: ['roomModuleId'], where: { roomId, deletedAt: null }, _count: true }),
      this.prisma.document.count({ where: { roomId, deletedAt: null } }),
      this.prisma.invitation.count({ where: { roomId, side: 'recipient' } }),
      this.prisma.roomParticipant.count({ where: { roomId, side: 'recipient', status: 'active' } }),
      this.prisma.commentThread.findMany({
        where: { roomId, status: 'open' },
        select: {
          visibility: true,
          createdAt: true,
          createdByParticipant: { select: { side: true } },
        },
      }),
      this.prisma.auditEvent.findMany({
        where: {
          roomId,
          action: 'document.viewed',
          createdAt: { gte: new Date(now - 7 * DAY) },
          actorParticipant: { side: otherSide },
        },
        select: { targetId: true, createdAt: true },
      }),
      this.prisma.auditEvent.findMany({
        where: { roomId },
        include: { actorUser: true, actorParticipant: true },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
    ]);

    const folderByModule = new Map(folderCounts.map((f) => [f.roomModuleId, f._count]));
    const docByModule = new Map(docCounts.map((d) => [d.roomModuleId, d._count]));

    const visibleOpen = openThreads.filter(
      (t) => t.visibility === 'room' || t.createdByParticipant.side === me.side,
    );
    const countOlder = (ms: number) =>
      visibleOpen.filter((t) => now - t.createdAt.getTime() > ms).length;

    const viewedDocs = new Set(counterpartyViews.map((v) => v.targetId));
    const lastView = counterpartyViews.reduce<Date | null>(
      (acc, v) => (!acc || v.createdAt > acc ? v.createdAt : acc),
      null,
    );

    return {
      roomId: room.id,
      name: room.name,
      status: room.status as Overview['status'],
      checklist: {
        recipientCompanySet: room.recipientCompanyId !== null,
        recipientInvited: recipientInvites > 0,
        recipientAccepted: recipientActive > 0,
        documentsUploaded: totalDocs > 0,
        ndaConfigured: !room.ndaRequired || room.ndaVersion !== null,
      },
      dossier: modules.map((m) => ({
        id: m.id,
        code: m.code,
        title: m.title,
        section: m.section,
        folderCount: folderByModule.get(m.id) ?? 0,
        documentCount: docByModule.get(m.id) ?? 0,
      })),
      openThreads: {
        total: visibleOpen.length,
        olderThan7d: countOlder(7 * DAY),
        olderThan14d: countOlder(14 * DAY),
      },
      counterpartyReading: {
        side: recipientActive > 0 || me.side === 'recipient' ? otherSide : null,
        documentsViewedLast7d: viewedDocs.size,
        lastViewedAt: lastView?.toISOString() ?? null,
      },
      recentActivity: recent.map(toActivityEvent),
    };
  }
}
