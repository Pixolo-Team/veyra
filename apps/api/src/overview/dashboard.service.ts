import { Injectable } from '@nestjs/common';
import type {
  Dashboard,
  DashboardAttentionItem,
  DashboardLeaderboardEntry,
  InvitationDto,
  ParticipantGroup,
} from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';

const DAY_MS = 86_400_000;

function pct(viewed: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((viewed / total) * 100);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function secondsOf(metadata: unknown): number {
  const value = (metadata as { seconds?: unknown } | null)?.seconds;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * The per-dataroom dashboard backing the Overview page.
 *
 * One endpoint answers every role (D1/R1/D2/R2); the blocks a role must not
 * see — invitations, participants, downloads, medians, recipient pulse — come
 * back null so the client only does layout, never access control.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
  ) {}

  async get(userId: string, roomId: string): Promise<Dashboard> {
    const me = await this.access.requireParticipant(userId, roomId);
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    const isDiscloserAdmin = me.side === 'discloser' && me.role === 'admin';
    const isRecipientAdmin = me.side === 'recipient' && me.role === 'admin';

    const [
      modules,
      documents,
      versionCounts,
      threads,
      invitations,
      participants,
      viewedEvents,
      readEvents,
      downloadCount,
      recipientEvents,
      myMentions,
    ] = await Promise.all([
      this.prisma.roomModule.findMany({
        where: { roomId },
        orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.document.findMany({
        where: { roomId, deletedAt: null },
        select: { id: true, name: true, roomModuleId: true, createdAt: true },
      }),
      this.prisma.documentVersion.groupBy({
        by: ['documentId'],
        where: { document: { roomId, deletedAt: null } },
        _count: true,
      }),
      this.prisma.commentThread.findMany({
        where: { roomId },
        include: {
          createdByParticipant: { select: { id: true, side: true } },
          comments: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            select: { id: true, authorParticipantId: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invitation.findMany({
        where: { roomId, status: 'pending' },
        include: { company: true, invitedByUser: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.roomParticipant.findMany({
        where: { roomId, status: { not: 'revoked' } },
        include: { user: true, company: true },
        orderBy: [{ side: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.auditEvent.findMany({
        where: { roomId, action: 'document.viewed', targetType: 'document' },
        select: { targetId: true, actorParticipantId: true, actorParticipant: { select: { side: true } } },
      }),
      this.prisma.auditEvent.findMany({
        where: { roomId, action: 'document.read' },
        include: {
          actorUser: true,
          actorParticipant: { include: { company: true } },
        },
      }),
      this.prisma.auditEvent.count({ where: { roomId, action: 'document.downloaded' } }),
      this.prisma.auditEvent.findFirst({
        where: { roomId, actorParticipant: { side: 'recipient' } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      // Open threads where someone tagged the viewer.
      this.prisma.commentMention.findMany({
        where: {
          participantId: me.id,
          comment: { deletedAt: null, thread: { roomId, status: 'open' } },
        },
        include: {
          comment: {
            select: {
              thread: {
                select: {
                  id: true,
                  createdAt: true,
                  documentVersion: {
                    select: { document: { select: { id: true, name: true } } },
                  },
                },
              },
            },
          },
        },
        take: 10,
      }),
    ]);

    // ── Checklist: a module is complete once it holds a document ─────────────
    const docsByModule = new Map<string, number>();
    for (const d of documents) docsByModule.set(d.roomModuleId, (docsByModule.get(d.roomModuleId) ?? 0) + 1);
    const checklistModules = modules.map((m) => ({
      id: m.id,
      code: m.code,
      title: m.title,
      section: m.section,
      documentCount: docsByModule.get(m.id) ?? 0,
      completed: (docsByModule.get(m.id) ?? 0) > 0,
    }));
    const completedCount = checklistModules.filter((m) => m.completed).length;

    // ── Threads: side-private threads stay with their side ───────────────────
    const visible = threads.filter(
      (t) => t.visibility === 'room' || t.createdByParticipant.side === me.side,
    );
    const open = visible.filter((t) => t.status === 'open');
    const resolved = visible.filter((t) => t.status === 'resolved');
    const myOpen = open.filter((t) => t.createdByParticipant.id === me.id).length;
    const myTotal = visible.filter((t) => t.createdByParticipant.id === me.id).length;

    // Distinct documents carrying threads — resolved via the thread's version.
    const threadDocIds = await this.threadDocumentIds(
      roomId,
      visible.map((t) => t.id),
    );
    const openDocIds = await this.threadDocumentIds(
      roomId,
      open.map((t) => t.id),
    );

    // ── Documents ────────────────────────────────────────────────────────────
    const docIds = new Set(documents.map((d) => d.id));
    const viewedByAnyone = new Set(
      viewedEvents.filter((e) => e.targetId && docIds.has(e.targetId)).map((e) => e.targetId as string),
    );
    const viewedByRecipient = new Set(
      viewedEvents
        .filter((e) => e.targetId && docIds.has(e.targetId) && e.actorParticipant?.side === 'recipient')
        .map((e) => e.targetId as string),
    );
    const viewedByMe = new Set(
      viewedEvents
        .filter((e) => e.targetId && docIds.has(e.targetId) && e.actorParticipantId === me.id)
        .map((e) => e.targetId as string),
    );
    const revised = versionCounts.filter((v) => v._count > 1).length;

    // ── Reading time ─────────────────────────────────────────────────────────
    const byActor = new Map<string, DashboardLeaderboardEntry & { seconds: number }>();
    let totalSeconds = 0;
    let mySeconds = 0;
    for (const row of readEvents) {
      const seconds = secondsOf(row.metadata);
      if (!seconds) continue;
      totalSeconds += seconds;
      const key = row.actorParticipantId ?? row.actorUserId ?? row.id;
      const current = byActor.get(key);
      if (current) {
        current.seconds += seconds;
      } else {
        byActor.set(key, {
          name: row.actorUser?.name ?? row.actorUser?.email ?? 'Someone',
          company: row.actorParticipant?.company?.name ?? null,
          side: (row.actorParticipant?.side as DashboardLeaderboardEntry['side']) ?? null,
          seconds,
        });
      }
      if (row.actorParticipantId === me.id) mySeconds += seconds;
    }
    const leaderboard = [...byActor.values()]
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 5);

    // ── Medians (D1): reply = creator → first other voice; resolve = lifetime ─
    let medians: Dashboard['medians'] = null;
    if (isDiscloserAdmin) {
      const replyGaps: number[] = [];
      const resolveGaps: number[] = [];
      for (const t of visible) {
        const firstReply = t.comments.find((c) => c.authorParticipantId !== t.createdByParticipant.id);
        if (firstReply) replyGaps.push((firstReply.createdAt.getTime() - t.createdAt.getTime()) / 1000);
        if (t.status === 'resolved' && t.resolvedAt) {
          resolveGaps.push((t.resolvedAt.getTime() - t.createdAt.getTime()) / 1000);
        }
      }
      medians = { replySeconds: median(replyGaps), resolveSeconds: median(resolveGaps) };
    }

    // ── Needs your attention ─────────────────────────────────────────────────
    const attention: DashboardAttentionItem[] = [];
    const seenThreads = new Set<string>();
    for (const m of myMentions) {
      const thread = m.comment.thread;
      if (seenThreads.has(thread.id)) continue;
      seenThreads.add(thread.id);
      attention.push({
        threadId: thread.id,
        documentId: thread.documentVersion.document.id,
        documentName: thread.documentVersion.document.name,
        reason: 'mention',
        createdAt: thread.createdAt.toISOString(),
      });
    }
    // Unanswered room threads from the other side: last voice isn't mine.
    const docNameByThread = await this.threadDocumentNames(
      roomId,
      open.filter((t) => t.visibility === 'room' && t.createdByParticipant.side !== me.side).map((t) => t.id),
    );
    for (const t of open) {
      if (attention.length >= 10 || seenThreads.has(t.id)) continue;
      if (t.visibility !== 'room' || t.createdByParticipant.side === me.side) continue;
      const last = t.comments[t.comments.length - 1];
      if (last && last.authorParticipantId === me.id) continue;
      seenThreads.add(t.id);
      attention.push({
        threadId: t.id,
        documentId: docNameByThread.get(t.id)?.id ?? null,
        documentName: docNameByThread.get(t.id)?.name ?? null,
        reason: 'unanswered',
        createdAt: t.createdAt.toISOString(),
      });
    }

    // ── Gated blocks ─────────────────────────────────────────────────────────
    const invitationDtos: InvitationDto[] = invitations.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      side: r.side as InvitationDto['side'],
      status: r.status,
      companyName: r.company?.name ?? null,
      invitedByName: r.invitedByUser?.name ?? null,
      expiresAt: r.expiresAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }));
    const invitationsBlock: Dashboard['invitations'] = isDiscloserAdmin
      ? { pendingCount: invitationDtos.length, items: invitationDtos }
      : isRecipientAdmin
        ? {
            pendingCount: invitationDtos.filter((i) => i.side === 'recipient').length,
            items: invitationDtos.filter((i) => i.side === 'recipient'),
          }
        : null;

    let participantsBlock: ParticipantGroup[] | null = null;
    if (isDiscloserAdmin || isRecipientAdmin) {
      const groups = new Map<string, ParticipantGroup>();
      for (const p of participants) {
        if (isRecipientAdmin && p.side !== 'recipient') continue;
        let group = groups.get(p.companyId);
        if (!group) {
          group = {
            companyId: p.companyId,
            companyName: p.company.name,
            side: p.side as ParticipantGroup['side'],
            participants: [],
          };
          groups.set(p.companyId, group);
        }
        group.participants.push({
          id: p.id,
          userId: p.userId,
          name: p.user.name,
          email: p.user.email,
          side: p.side as ParticipantGroup['side'],
          role: p.role,
          status: p.status,
          ndaAcceptedAt: p.ndaAcceptedAt?.toISOString() ?? null,
          acceptedAt: p.acceptedAt?.toISOString() ?? null,
        });
      }
      participantsBlock = [...groups.values()];
    }

    const recipientLast = recipientEvents?.createdAt ?? null;

    return {
      roomId: room.id,
      roomName: room.name,
      status: room.status as Dashboard['status'],
      viewer: { side: me.side as Dashboard['viewer']['side'], role: me.role, participantId: me.id },
      checklist: {
        modules: checklistModules,
        completedCount,
        totalCount: checklistModules.length,
      },
      invitations: invitationsBlock,
      threads: { open: open.length, resolved: resolved.length, myOpen, myTotal },
      documents: {
        total: documents.length,
        unopened: documents.filter((d) => !viewedByAnyone.has(d.id)).length,
        unread: documents.filter((d) => !viewedByRecipient.has(d.id)).length,
        revised,
        unresolved: openDocIds.size,
        withFeedback: threadDocIds.size,
      },
      coverage: {
        viewed: viewedByRecipient.size,
        total: documents.length,
        pct: pct(viewedByRecipient.size, documents.length),
      },
      dossierOpened: {
        viewed: viewedByMe.size,
        total: documents.length,
        pct: pct(viewedByMe.size, documents.length),
      },
      recipient: isDiscloserAdmin
        ? {
            lastActiveAt: recipientLast?.toISOString() ?? null,
            daysSinceActive: recipientLast
              ? Math.floor((Date.now() - recipientLast.getTime()) / DAY_MS)
              : null,
          }
        : null,
      downloads: isDiscloserAdmin ? { count: downloadCount } : null,
      reading: { mySeconds, totalSeconds, leaderboard },
      medians,
      participants: participantsBlock,
      attention,
    };
  }

  /** Distinct document ids touched by the given threads in this room. */
  private async threadDocumentIds(roomId: string, threadIds: string[]): Promise<Set<string>> {
    if (threadIds.length === 0) return new Set();
    const rows = await this.prisma.commentThread.findMany({
      where: { roomId, id: { in: threadIds } },
      select: { id: true, documentVersion: { select: { documentId: true } } },
    });
    return new Set(rows.map((r) => r.documentVersion.documentId));
  }

  /** Document id + name per thread, for the attention list. */
  private async threadDocumentNames(
    roomId: string,
    threadIds: string[],
  ): Promise<Map<string, { id: string; name: string }>> {
    const out = new Map<string, { id: string; name: string }>();
    if (threadIds.length === 0) return out;
    const rows = await this.prisma.commentThread.findMany({
      where: { roomId, id: { in: threadIds } },
      select: {
        id: true,
        documentVersion: { select: { document: { select: { id: true, name: true } } } },
      },
    });
    for (const r of rows) out.set(r.id, r.documentVersion.document);
    return out;
  }
}
