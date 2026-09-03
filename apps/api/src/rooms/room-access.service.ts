import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoomParticipant } from '@prisma/client';
import { RequestContextService } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK = { reviewer: 0, contributor: 1, admin: 2 } as const;
type Role = keyof typeof ROLE_RANK;

/** Room-scoped access checks shared by every room sub-resource controller. */
@Injectable()
export class RoomAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestCtx: RequestContextService,
  ) {}

  /** The caller's active participant row, or 404 (don't leak room existence). */
  async requireParticipant(userId: string, roomId: string): Promise<RoomParticipant> {
    // Noted before the check, so a refusal is still attributed to the room it
    // was reaching into — see `RequestContext.roomId`.
    this.requestCtx.set({ roomId });
    const participant = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!participant || participant.status === 'revoked') {
      throw new NotFoundException('Room not found');
    }
    return participant;
  }

  async requireRole(userId: string, roomId: string, min: Role): Promise<RoomParticipant> {
    const participant = await this.requireParticipant(userId, roomId);
    if (ROLE_RANK[participant.role] < ROLE_RANK[min]) {
      throw new ForbiddenException(`Requires ${min} on this room`);
    }
    return participant;
  }

  /**
   * `archived` is a filing state, not a deletion (ROOM_STATUS_TRANSITIONS in
   * @veyra/contracts): the room stays fully readable, but nothing new lands in
   * it until an admin restores it. Room *lifecycle* writes deliberately skip
   * this check — gate them and an archived room could never be restored.
   */
  async requireWritableRoom(roomId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { status: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === 'archived') {
      throw new ForbiddenException('This room is archived and read-only — restore it to make changes');
    }
  }

  /** requireRole + requireWritableRoom, for the mutating paths. */
  async requireWriteRole(userId: string, roomId: string, min: Role): Promise<RoomParticipant> {
    const participant = await this.requireRole(userId, roomId, min);
    await this.requireWritableRoom(roomId);
    return participant;
  }
}
