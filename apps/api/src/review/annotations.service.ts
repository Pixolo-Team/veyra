import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AnnotationDto, CreateAnnotationRequest } from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewAccess } from './review-access';

@Injectable()
export class AnnotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ReviewAccess,
    private readonly audit: AuditService,
  ) {}

  async create(
    userId: string,
    documentVersionId: string,
    input: CreateAnnotationRequest,
  ): Promise<AnnotationDto> {
    const ctx = await this.access.forVersionWrite(userId, documentVersionId);
    const annotation = await this.prisma.annotation.create({
      data: {
        roomId: ctx.roomId,
        documentVersionId,
        authorParticipantId: ctx.participant.id,
        color: input.color,
        anchorType: input.anchorType,
        anchor: input.anchor as unknown as Prisma.InputJsonValue,
      },
      include: { authorParticipant: { include: { user: true } } },
    });
    await this.audit.record({
      action: 'annotation.created',
      roomId: ctx.roomId,
      actorParticipantId: ctx.participant.id,
      targetType: 'annotation',
      targetId: annotation.id,
      metadata: { color: input.color },
    });
    return toAnnotationDto(annotation, false);
  }

  /** Own markers + annotations whose thread the caller can see (mvp-plan §5.4). */
  async listForVersion(userId: string, documentVersionId: string): Promise<AnnotationDto[]> {
    const ctx = await this.access.forVersion(userId, documentVersionId);
    const rows = await this.prisma.annotation.findMany({
      where: { documentVersionId, deletedAt: null },
      include: {
        authorParticipant: { include: { user: true } },
        thread: { include: { createdByParticipant: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows
      .filter((a) => {
        if (a.authorParticipantId === ctx.participant.id) return true;
        if (!a.thread) return false; // someone else's private marker
        return ReviewAccess.threadVisibleTo(ctx.participant, {
          visibility: a.thread.visibility,
          authorSide: a.thread.createdByParticipant.side,
        });
      })
      .map((a) => toAnnotationDto(a, a.thread !== null));
  }

  async remove(userId: string, annotationId: string): Promise<void> {
    const annotation = await this.prisma.annotation.findUnique({
      where: { id: annotationId },
      include: { thread: true },
    });
    if (!annotation || annotation.deletedAt) throw new NotFoundException('Annotation not found');
    const participant = await this.access
      .forVersionWrite(userId, annotation.documentVersionId)
      .then((c) => c.participant);
    if (annotation.authorParticipantId !== participant.id && participant.role !== 'admin') {
      throw new ForbiddenException('Only the author or a room admin can delete this highlight');
    }
    if (annotation.thread) {
      throw new ForbiddenException('Resolve or delete the comment thread first');
    }
    await this.prisma.annotation.update({
      where: { id: annotationId },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      action: 'annotation.deleted',
      roomId: annotation.roomId,
      actorParticipantId: participant.id,
      targetType: 'annotation',
      targetId: annotationId,
    });
  }
}

type AnnotationRow = Prisma.AnnotationGetPayload<{
  include: { authorParticipant: { include: { user: true } } };
}>;

export function toAnnotationDto(a: AnnotationRow, hasThread: boolean): AnnotationDto {
  return {
    id: a.id,
    documentVersionId: a.documentVersionId,
    color: a.color,
    anchorType: a.anchorType,
    anchor: a.anchor as AnnotationDto['anchor'],
    authorParticipantId: a.authorParticipantId,
    authorName: a.authorParticipant.user.name,
    hasThread,
    createdAt: a.createdAt.toISOString(),
  };
}
