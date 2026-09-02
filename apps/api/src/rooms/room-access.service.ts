import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { RoomParticipant } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ROLE_RANK = { reviewer: 0, contributor: 1, admin: 2 } as const;
type Role = keyof typeof ROLE_RANK;

/** Room-scoped access checks shared by every room sub-resource controller. */
@Injectable()
export class RoomAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** The caller's active participant row, or 404 (don't leak room existence). */
  async requireParticipant(userId: string, roomId: string): Promise<RoomParticipant> {
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
}
