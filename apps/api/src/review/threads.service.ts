import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AddCommentRequest,
  AnnotationDto,
  CommentDto,
  CreateThreadRequest,
  ThreadDto,
  ThreadListQuery,
  UpdateThreadRequest,
} from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewAccess } from './review-access';

const MENTION_BATCH_MS = 15 * 60_000;

const threadInclude = {
  createdByParticipant: { include: { user: true } },
  resolvedByParticipant: { include: { user: true } },
  annotation: { include: { authorParticipant: { include: { user: true } } } },
  comments: {
    include: { mentions: true, authorParticipant: { include: { user: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.CommentThreadInclude;

type ThreadRow = Prisma.CommentThreadGetPayload<{ include: typeof threadInclude }>;

@Injectable()
export class ThreadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ReviewAccess,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  async create(
    userId: string,
    documentVersionId: string,
    input: CreateThreadRequest,
  ): Promise<ThreadDto> {
    const ctx = await this.access.forVersion(userId, documentVersionId);

    if (input.annotationId) {
      const annotation = await this.prisma.annotation.findFirst({
        where: { id: input.annotationId, documentVersionId, deletedAt: null },
      });
      if (!annotation) throw new BadRequestException('Annotation not found on this version');
      const taken = await this.prisma.commentThread.findUnique({
        where: { annotationId: input.annotationId },
      });
      if (taken) throw new BadRequestException('That highlight already has a thread');
    }

    const mentions = await this.validateMentions(ctx.roomId, input.mentions);

    const thread = await this.prisma.$transaction(async (tx) => {
      const created = await tx.commentThread.create({
        data: {
          roomId: ctx.roomId,
          documentVersionId,
          annotationId: input.annotationId ?? null,
          visibility: input.visibility,
          createdBy: ctx.participant.id,
        },
      });
      await tx.comment.create({
        data: {
          threadId: created.id,
          authorParticipantId: ctx.participant.id,
          body: input.body as Prisma.InputJsonValue,
          mentions: { create: mentions.map((participantId) => ({ participantId })) },
        },
      });
      return created;
    });

    await this.audit.record({
      action: 'thread.created',
      roomId: ctx.roomId,
      actorParticipantId: ctx.participant.id,
      targetType: 'thread',
      targetId: thread.id,
      metadata: { visibility: input.visibility, anchored: Boolean(input.annotationId) },
    });
    await this.notifyMentions(mentions, ctx.roomId, thread.id);

    return this.getById(userId, thread.id);
  }

  async list(
    userId: string,
    documentVersionId: string,
    query: ThreadListQuery,
  ): Promise<ThreadDto[]> {
    const ctx = await this.access.forVersion(userId, documentVersionId);
    const rows = await this.prisma.commentThread.findMany({
      where: {
        documentVersionId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.color ? { annotation: { color: query.color } } : {}),
        ...(query.authorParticipantId ? { createdBy: query.authorParticipantId } : {}),
      },
      include: threadInclude,
      orderBy: { createdAt: 'asc' },
    });

    return rows
      .filter((t) =>
        ReviewAccess.threadVisibleTo(ctx.participant, {
          visibility: t.visibility,
          authorSide: t.createdByParticipant.side,
        }),
      )
      .filter((t) =>
        query.sharedWithMe
          ? t.visibility === 'room' && t.createdByParticipant.side !== ctx.participant.side
          : true,
      )
      .map((t) => toThreadDto(t));
  }

  async getById(userId: string, threadId: string): Promise<ThreadDto> {
    const thread = await this.loadVisible(userId, threadId);
    return toThreadDto(thread);
  }

  async update(
    userId: string,
    threadId: string,
    input: UpdateThreadRequest,
  ): Promise<ThreadDto> {
    const thread = await this.loadVisible(userId, threadId);
    const participant = await this.access
      .forVersion(userId, thread.documentVersionId)
      .then((c) => c.participant);

    const data: Prisma.CommentThreadUpdateInput = {};
    if (input.visibility && input.visibility !== thread.visibility) {
      // Only the creator's side may share their own notes outward (D5).
      if (thread.createdByParticipant.side !== participant.side) {
        throw new ForbiddenException('Only the authoring side can change visibility');
      }
      data.visibility = input.visibility;
    }
    if (input.status && input.status !== thread.status) {
      data.status = input.status;
      data.resolvedByParticipant =
        input.status === 'resolved' ? { connect: { id: participant.id } } : { disconnect: true };
      data.resolvedAt = input.status === 'resolved' ? new Date() : null;
    }

    if (Object.keys(data).length) {
      await this.prisma.commentThread.update({ where: { id: threadId }, data });
      await this.audit.record({
        action: input.status ? `thread.${input.status}` : 'thread.visibility_changed',
        roomId: thread.roomId,
        actorParticipantId: participant.id,
        targetType: 'thread',
        targetId: threadId,
        metadata: { ...(input.visibility ? { visibility: input.visibility } : {}) },
      });
    }
    return this.getById(userId, threadId);
  }

  async addComment(
    userId: string,
    threadId: string,
    input: AddCommentRequest,
  ): Promise<ThreadDto> {
    const thread = await this.loadVisible(userId, threadId);
    const participant = await this.access
      .forVersion(userId, thread.documentVersionId)
      .then((c) => c.participant);
    const mentions = await this.validateMentions(thread.roomId, input.mentions);

    await this.prisma.comment.create({
      data: {
        threadId,
        authorParticipantId: participant.id,
        body: input.body as Prisma.InputJsonValue,
        mentions: { create: mentions.map((participantId) => ({ participantId })) },
      },
    });
    await this.audit.record({
      action: 'comment.added',
      roomId: thread.roomId,
      actorParticipantId: participant.id,
      targetType: 'thread',
      targetId: threadId,
    });
    await this.notifyMentions(mentions, thread.roomId, threadId);
    return this.getById(userId, threadId);
  }

  async editComment(userId: string, commentId: string, body: unknown): Promise<CommentDto> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { thread: true },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    const participant = await this.access
      .forVersion(userId, comment.thread.documentVersionId)
      .then((c) => c.participant);
    if (comment.authorParticipantId !== participant.id) {
      throw new ForbiddenException('You can only edit your own comments');
    }
    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { body: body as Prisma.InputJsonValue, editedAt: new Date() },
      include: { mentions: true, authorParticipant: { include: { user: true } } },
    });
    return toCommentDto(updated);
  }

  async deleteComment(userId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { thread: true },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException('Comment not found');
    const participant = await this.access
      .forVersion(userId, comment.thread.documentVersionId)
      .then((c) => c.participant);
    if (comment.authorParticipantId !== participant.id && participant.role !== 'admin') {
      throw new ForbiddenException('Only the author or a room admin can delete this comment');
    }
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      action: 'comment.deleted',
      roomId: comment.thread.roomId,
      actorParticipantId: participant.id,
      targetType: 'comment',
      targetId: commentId,
    });
  }

  private async loadVisible(userId: string, threadId: string): Promise<ThreadRow> {
    const thread = await this.prisma.commentThread.findUnique({
      where: { id: threadId },
      include: threadInclude,
    });
    if (!thread) throw new NotFoundException('Thread not found');
    const { participant } = await this.access.forVersion(userId, thread.documentVersionId);
    if (
      !ReviewAccess.threadVisibleTo(participant, {
        visibility: thread.visibility,
        authorSide: thread.createdByParticipant.side,
      })
    ) {
      throw new NotFoundException('Thread not found');
    }
    return thread;
  }

  private async validateMentions(roomId: string, ids?: string[]): Promise<string[]> {
    if (!ids?.length) return [];
    const unique = [...new Set(ids)];
    const found = await this.prisma.roomParticipant.findMany({
      where: { id: { in: unique }, roomId, status: { not: 'revoked' } },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('A mentioned participant is not in this room');
    }
    return unique;
  }

  private async notifyMentions(participantIds: string[], roomId: string, threadId: string): Promise<void> {
    if (!participantIds.length) return;
    const people = await this.prisma.roomParticipant.findMany({
      where: { id: { in: participantIds } },
      include: { user: true },
    });
    const scheduledFor = new Date(Date.now() + MENTION_BATCH_MS);
    await Promise.all(
      people.map((p) =>
        this.email.enqueue(p.user.email, 'comment_digest', { roomId, threadId, reason: 'mention' }, { scheduledFor }),
      ),
    );
  }
}

// ── mappers ────────────────────────────────────────────────────────────────

type CommentRow = Prisma.CommentGetPayload<{
  include: { mentions: true; authorParticipant: { include: { user: true } } };
}>;

function toCommentDto(c: CommentRow): CommentDto {
  return {
    id: c.id,
    threadId: c.threadId,
    authorParticipantId: c.authorParticipantId,
    authorName: c.authorParticipant.user.name,
    body: (c.deletedAt ? {} : c.body) as CommentDto['body'],
    mentions: c.mentions.map((m) => m.participantId),
    createdAt: c.createdAt.toISOString(),
    editedAt: c.editedAt?.toISOString() ?? null,
    deletedAt: c.deletedAt?.toISOString() ?? null,
  };
}

function toThreadDto(t: ThreadRow): ThreadDto {
  return {
    id: t.id,
    documentVersionId: t.documentVersionId,
    annotationId: t.annotationId,
    annotation: t.annotation
      ? ({
          id: t.annotation.id,
          documentVersionId: t.annotation.documentVersionId,
          color: t.annotation.color,
          anchorType: t.annotation.anchorType,
          anchor: t.annotation.anchor as AnnotationDto['anchor'],
          authorParticipantId: t.annotation.authorParticipantId,
          authorName: t.annotation.authorParticipant.user.name,
          hasThread: true,
          createdAt: t.annotation.createdAt.toISOString(),
        } satisfies AnnotationDto)
      : null,
    status: t.status,
    visibility: t.visibility,
    authorSide: t.createdByParticipant.side as ThreadDto['authorSide'],
    createdByParticipantId: t.createdBy,
    createdByName: t.createdByParticipant.user.name,
    resolvedByName: t.resolvedByParticipant?.user.name ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    carriedFromVersionId: t.carriedFromVersionId,
    createdAt: t.createdAt.toISOString(),
    comments: t.comments.map(toCommentDto),
  };
}
