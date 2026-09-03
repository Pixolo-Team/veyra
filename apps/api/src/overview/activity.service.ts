import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  ActivityPage,
  ActivityQuery,
  ActivitySummary,
  ActivityWindow,
} from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { type AuditRow, type TargetNames, targetKey, toActivityEvent } from './activity.mapper';

/** The joins every read of the log needs to name who did it. */
const ACTOR_INCLUDE = {
  actorUser: true,
  actorParticipant: { include: { company: true } },
} satisfies Prisma.AuditEventInclude;

/** Actions that mean a file left the room, for the totals. */
const DOWNLOAD_ACTIONS = ['document.downloaded'];

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
  ) {}

  async list(userId: string, roomId: string, query: ActivityQuery): Promise<ActivityPage> {
    await this.access.requireParticipant(userId, roomId);
    const where: Prisma.AuditEventWhereInput = { roomId, ...this.filters(query) };

    /*
     * Ordered by id, not createdAt. Both are monotonic here — the log is only
     * ever appended to — but two events written in the same millisecond have
     * no defined order under a timestamp, and an unstable sort under offset
     * paging drops rows between pages and repeats others.
     */
    const [total, rows] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        include: ACTOR_INCLUDE,
        orderBy: { id: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    const names = await this.resolveTargets(rows);
    return {
      items: rows.map((row) => toActivityEvent(row, names)),
      total,
      page: query.page,
      pageSize: query.limit,
    };
  }

  /**
   * The totals above the log, over the same window as the rows below them.
   *
   * Counted in the database rather than by paging the log into memory: a busy
   * room's month is tens of thousands of events, and a header that has to read
   * all of them to say "1,946" is a header that times out first.
   */
  async summary(userId: string, roomId: string, days: ActivityWindow): Promise<ActivitySummary> {
    await this.access.requireParticipant(userId, roomId);
    const where: Prisma.AuditEventWhereInput = { roomId, ...this.since(days) };

    const [events, actors, downloads, denied, reading] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent
        .findMany({ where, distinct: ['actorUserId'], select: { actorUserId: true } })
        .then((rows) => rows.filter((row) => row.actorUserId).length),
      this.prisma.auditEvent.count({ where: { ...where, action: { in: DOWNLOAD_ACTIONS } } }),
      this.prisma.auditEvent.count({ where: { ...where, action: 'access.denied' } }),
      this.prisma.auditEvent.findMany({
        where: { ...where, action: 'document.read' },
        include: ACTOR_INCLUDE,
      }),
    ]);

    /*
     * Reading time is summed from the metadata of `document.read` rather than
     * kept in a column of its own. It is a derived number that only the
     * activity screen asks for, and the event that carries it is already the
     * append-only record of the same fact — a second copy could disagree with
     * the log, and the log is the thing that has to be trusted.
     */
    const byActor = new Map<string, { name: string; company: string | null; seconds: number }>();
    let readingSeconds = 0;
    for (const row of reading as AuditRow[]) {
      const seconds = secondsOf(row.metadata);
      if (!seconds) continue;
      readingSeconds += seconds;
      const key = row.actorUserId ?? row.id;
      const current = byActor.get(key);
      if (current) {
        current.seconds += seconds;
        continue;
      }
      byActor.set(key, {
        name: row.actorUser?.name ?? row.actorUser?.email ?? 'Someone',
        company: row.actorParticipant?.company?.name ?? null,
        seconds,
      });
    }

    const top = [...byActor.values()].sort((a, b) => b.seconds - a.seconds)[0];
    return {
      days,
      events,
      actors,
      downloads,
      denied,
      readingSeconds,
      mostActive:
        top && readingSeconds > 0
          ? {
              name: top.name,
              company: top.company,
              shareOfReading: top.seconds / readingSeconds,
            }
          : null,
    };
  }

  /** CSV export for the Activity log (mvp-plan §6). Admin only. */
  async csv(userId: string, roomId: string): Promise<string> {
    await this.access.requireRole(userId, roomId, 'admin');
    const rows = await this.prisma.auditEvent.findMany({
      where: { roomId },
      include: ACTOR_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    const names = await this.resolveTargets(rows);

    const header = [
      'timestamp',
      'action',
      'actor',
      'company',
      'side',
      'target_type',
      'target_id',
      'target_name',
      'ip',
      'metadata',
    ];
    const lines = rows.map((e) =>
      [
        e.createdAt.toISOString(),
        e.action,
        e.actorUser?.name ?? e.actorUser?.email ?? '',
        e.actorParticipant?.company?.name ?? '',
        e.actorParticipant?.side ?? '',
        e.targetType ?? '',
        e.targetId ?? '',
        names.get(targetKey(e.targetType, e.targetId)) ?? '',
        e.ip ?? '',
        JSON.stringify(e.metadata ?? {}),
      ]
        .map(csvCell)
        .join(','),
    );
    return [header.join(','), ...lines].join('\r\n');
  }

  private filters(query: ActivityQuery): Prisma.AuditEventWhereInput {
    return {
      ...this.since(query.days),
      ...(query.action ? { action: query.action } : {}),
      // `document` matches `document.*`, so the chips can narrow to a family
      // without naming every action in it.
      ...(query.group ? { action: { startsWith: `${query.group}.` } } : {}),
    };
  }

  private since(days: ActivityWindow | undefined): Prisma.AuditEventWhereInput {
    if (!days || days === 'all') return {};
    const from = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    return { createdAt: { gte: from } };
  }

  /**
   * What each event pointed at, by name.
   *
   * Resolved per page in three queries rather than stored on the event: a name
   * frozen at write time keeps saying "Draft 2" long after the file was
   * renamed, and the auditor reading the row a year later needs it to point at
   * something they can still find. Deleted targets simply have no name, which
   * is honest — the row keeps its id.
   */
  private async resolveTargets(rows: AuditRow[]): Promise<TargetNames> {
    const ids = (type: string) =>
      [...new Set(rows.filter((r) => r.targetType === type && r.targetId).map((r) => r.targetId!))];

    const documentIds = ids('document');
    const folderIds = ids('folder');
    const threadIds = ids('thread');

    const [documents, folders, threads] = await Promise.all([
      documentIds.length
        ? this.prisma.document.findMany({
            where: { id: { in: documentIds } },
            select: { id: true, name: true },
          })
        : [],
      folderIds.length
        ? this.prisma.folder.findMany({
            where: { id: { in: folderIds } },
            select: { id: true, name: true },
          })
        : [],
      threadIds.length
        ? this.prisma.commentThread.findMany({
            where: { id: { in: threadIds } },
            select: { id: true, annotation: { select: { anchor: true } } },
          })
        : [],
    ]);

    const names: TargetNames = new Map();
    for (const row of documents) names.set(targetKey('document', row.id), row.name);
    for (const row of folders) names.set(targetKey('folder', row.id), row.name);
    for (const row of threads) {
      // A thread has no name, so it is called by what it is about.
      const quote = quoteOf(row.annotation?.anchor);
      names.set(targetKey('thread', row.id), quote ? `“${quote}”` : 'Comment thread');
    }
    return names;
  }
}

function secondsOf(metadata: unknown): number {
  const value = (metadata as { seconds?: unknown } | null)?.seconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** The highlighted passage a thread hangs on, trimmed to a label. */
function quoteOf(anchor: unknown): string | null {
  const exact = (anchor as { quote?: { exact?: unknown } } | null)?.quote?.exact;
  if (typeof exact !== 'string' || !exact.trim()) return null;
  const text = exact.trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
