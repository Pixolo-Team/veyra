// @ts-nocheck
import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ActivityEvent,
  CompanyDashboard,
  CompanyDashboardRoom,
  MyCompany,
} from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { type AuditRow, toActivityEvent } from '../overview/activity.mapper';

function pct(viewed: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((viewed / total) * 100);
}

/** Strongest role wins when someone wears several hats across a company's rooms. */
const ROLE_RANK: Record<string, number> = { admin: 3, contributor: 2, reviewer: 1 };

/**
 * The per-company dashboard (Image 1): the rollup across every data room the
 * viewer belongs to for this company.
 *
 * Access is enforced by the query itself — only rooms the caller is an active
 * participant in are read — so there is nothing to gate on the client. A
 * company the caller has no rooms for answers 404 rather than an empty board,
 * because "you are not in this company" and "this company has nothing" are
 * different answers and only the first is true.
 */
@Injectable()
export class CompanyDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** The companies whose dashboards this person can open. */
  async listForUser(userId: string): Promise<MyCompany[]> {
    const participations = await this.prisma.roomParticipant.findMany({
      where: { userId, status: { not: 'revoked' } },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });

    const byCompany = new Map<string, MyCompany>();
    for (const p of participations) {
      const existing = byCompany.get(p.companyId);
      if (!existing) {
        byCompany.set(p.companyId, {
          companyId: p.companyId,
          companyName: p.company.name,
          side: p.side as MyCompany['side'],
          role: p.role as MyCompany['role'],
        });
        continue;
      }
      // Keep the strongest role so the header names the person's real standing.
      if ((ROLE_RANK[p.role] ?? 0) > (ROLE_RANK[existing.role] ?? 0)) {
        existing.role = p.role as MyCompany['role'];
      }
    }
    return [...byCompany.values()];
  }

  async getForUser(userId: string, companyId: string): Promise<CompanyDashboard> {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    // The rooms this person actually belongs to for this company. Reading only
    // these means the list *is* the access control — no client-side filtering.
    const participations = await this.prisma.roomParticipant.findMany({
      where: { userId, companyId, status: { not: 'revoked' } },
      include: { room: true },
      orderBy: { createdAt: 'asc' },
    });
    if (participations.length === 0) throw new NotFoundException('No access to this company');

    // Strongest role + one side for the header. A person is normally one side
    // per company; if they straddle both, the earliest participation decides.
    let role = participations[0].role as MyCompany['role'];
    const side = participations[0].side as MyCompany['side'];
    for (const p of participations) {
      if ((ROLE_RANK[p.role] ?? 0) > (ROLE_RANK[role] ?? 0)) {
        role = p.role as MyCompany['role'];
      }
    }

    const roomIds = participations.map((p) => p.room.id);
    const liveRoomIds = participations
      .filter((p) => (p.room.status as string) !== 'deleted')
      .map((p) => p.room.id);

    const [docCounts, openThreadCounts, viewedEvents, lastEvents, recent] = await Promise.all([
      this.prisma.document.groupBy({
        by: ['roomId'],
        where: { roomId: { in: liveRoomIds }, deletedAt: null },
        _count: true,
      }),
      this.prisma.commentThread.groupBy({
        by: ['roomId'],
        where: { roomId: { in: liveRoomIds }, status: 'open' },
        _count: true,
      }),
      this.prisma.auditEvent.findMany({
        where: {
          roomId: { in: liveRoomIds },
          action: 'document.viewed',
          targetType: 'document',
          actorParticipant: { side: 'recipient' },
        },
        select: { roomId: true, targetId: true },
      }),
      this.prisma.auditEvent.groupBy({
        by: ['roomId'],
        where: { roomId: { in: liveRoomIds } },
        _max: { createdAt: true },
      }),
      this.prisma.auditEvent.findMany({
        where: { roomId: { in: roomIds } },
        include: { actorUser: true, actorParticipant: { include: { company: true } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const docsByRoom = new Map(docCounts.map((d) => [d.roomId, d._count]));
    const openByRoom = new Map(openThreadCounts.map((t) => [t.roomId, t._count]));
    const lastByRoom = new Map(lastEvents.map((e) => [e.roomId, e._max.createdAt]));

    // Distinct docs the recipient opened, per room — for coverage.
    const viewedByRoom = new Map<string, string[]>();
for (const e of viewedEvents) {
      const targetId = e.targetId;
      if (!targetId) continue;
      const arr = viewedByRoom.get(e.roomId) ?? [];
      viewedByRoom.set(e.roomId, arr.concat(targetId!.toString()));
    }
    // Deduplicate per room.
    for (const [roomId, arr] of viewedByRoom) {
      viewedByRoom.set(roomId, [...new Set(arr)]);
    }

    const rooms: CompanyDashboardRoom[] = participations
      .filter((p) => (p.room.status as string) !== 'deleted')
      .map((p) => {
        const total = docsByRoom.get(p.room.id) ?? 0;
        return {
          roomId: p.room.id,
          roomName: p.room.name,
          status: p.room.status as CompanyDashboardRoom['status'],
          documentCount: total,
          coveragePct: pct(viewedByRoom.get(p.room.id)?.length ?? 0, total),
          openThreads: openByRoom.get(p.room.id) ?? 0,
          lastActivityAt: lastByRoom.get(p.room.id)?.toISOString() ?? null,
        };
      })
      .sort((a, b) => {
        // Rooms with recent activity first; never-active rooms sink to the bottom.
        const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0;
        const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0;
        return bt - at;
      });

    const totalDocuments = rooms.reduce((n, r) => n + r.documentCount, 0);
    const openQuestions = rooms.reduce((n, r) => n + r.openThreads, 0);
    const coverages = rooms
      .map((r) => r.coveragePct)
      .filter((v): v is number => v !== null);
    const avgCoveragePct =
      coverages.length > 0
        ? Math.round(coverages.reduce((n, v) => n + v, 0) / coverages.length)
        : null;

    const recentActivity: ActivityEvent[] = recent.map((row) =>
      toActivityEvent(row as AuditRow),
    );

    return {
      companyId: company.id,
      companyName: company.name,
      viewer: { side, role },
      summary: {
        totalRooms: rooms.length,
        totalDocuments,
        openQuestions,
        avgCoveragePct,
      },
      rooms,
      recentActivity,
    };
  }
}
