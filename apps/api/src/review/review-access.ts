import { Injectable, NotFoundException } from '@nestjs/common';
import type { RoomParticipant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';

export interface VersionContext {
  documentVersionId: string;
  roomId: string;
  participant: RoomParticipant;
}

/** Resolves a document version to its room and checks the caller participates. */
@Injectable()
export class ReviewAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rooms: RoomAccessService,
  ) {}

  /** Read path: participation is enough. */
  async forVersion(userId: string, documentVersionId: string): Promise<VersionContext> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
      include: { document: true },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('Document version not found');
    const participant = await this.rooms.requireParticipant(userId, version.document.roomId);
    return { documentVersionId, roomId: version.document.roomId, participant };
  }

  /** Write path: same, plus the room has to still accept changes (not archived). */
  async forVersionWrite(userId: string, documentVersionId: string): Promise<VersionContext> {
    const ctx = await this.forVersion(userId, documentVersionId);
    await this.rooms.requireWritableRoom(ctx.roomId);
    return ctx;
  }

  /** D5: a `side` thread is visible only to the creator's own side; `room` to all. */
  static threadVisibleTo(
    viewer: Pick<RoomParticipant, 'side'>,
    thread: { visibility: string; authorSide: string },
  ): boolean {
    return thread.visibility === 'room' || thread.authorSide === viewer.side;
  }
}
