import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import type {
  CreateRoomRequest,
  ParticipantGroup,
  RoomDetail,
  RoomListItem,
} from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from './room-access.service';

/**
 * Rooms are always reached through the caller's `room_participants` rows, so the
 * multi-room switcher is a query, not a feature, and no method assumes one room
 * (mvp-plan D12). Tenancy is scoped explicitly in every `where` here; a
 * defence-in-depth RLS layer is a later addition (see README).
 */
@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: RoomAccessService,
  ) {}

  /** Rooms the user participates in — the switcher payload. */
  async listForUser(userId: string): Promise<RoomListItem[]> {
    const parts = await this.prisma.roomParticipant.findMany({
      where: { userId, side: { in: ['discloser', 'recipient'] } },
      include: { room: true },
      orderBy: { room: { createdAt: 'desc' } },
    });

    const lastEvents = await this.prisma.auditEvent.groupBy({
      by: ['roomId'],
      where: { roomId: { in: parts.map((p) => p.roomId) } },
      _max: { createdAt: true },
    });
    const lastByRoom = new Map(lastEvents.map((e) => [e.roomId, e._max.createdAt]));

    return parts.map((p) => ({
      id: p.room.id,
      name: p.room.name,
      status: p.room.status as RoomListItem['status'],
      side: p.side as RoomListItem['side'],
      role: p.role,
      participantStatus: p.status,
      lastActivityAt: lastByRoom.get(p.roomId)?.toISOString() ?? null,
    }));
  }

  async getForUser(userId: string, roomId: string): Promise<RoomDetail> {
    const participant = await this.prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: {
        room: { include: { discloserCompany: true, recipientCompany: true } },
      },
    });
    if (!participant) throw new NotFoundException('Room not found');

    const [modules, lastEvent] = await Promise.all([
      this.prisma.roomModule.findMany({
        where: { roomId },
        orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.auditEvent.findFirst({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const { room } = participant;
    return {
      id: room.id,
      name: room.name,
      status: room.status as RoomDetail['status'],
      side: participant.side as RoomDetail['side'],
      role: participant.role,
      participantStatus: participant.status,
      lastActivityAt: lastEvent?.createdAt.toISOString() ?? null,
      ndaRequired: room.ndaRequired,
      ndaPending: room.ndaRequired && !participant.ndaAcceptedAt,
      allowDownload: room.allowDownload,
      watermarkEnabled: room.watermarkEnabled,
      discloserCompany: room.discloserCompany
        ? { id: room.discloserCompany.id, name: room.discloserCompany.name }
        : null,
      recipientCompany: room.recipientCompany
        ? { id: room.recipientCompany.id, name: room.recipientCompany.name }
        : null,
      modules: modules.map((m) => ({
        id: m.id,
        code: m.code,
        title: m.title,
        section: m.section,
        sortOrder: m.sortOrder,
      })),
    };
  }

  /** Room-creation step 1 (mvp-plan §5.1). The creator becomes a discloser admin. */
  async create(user: User, input: CreateRoomRequest): Promise<RoomDetail> {
    const membership = await this.prisma.tenantMember.findFirst({
      where: { userId: user.id, role: { in: ['owner', 'admin'] } },
      include: { tenant: { include: { company: true } } },
    });
    if (!membership) {
      throw new ForbiddenException('Only a tenant owner or admin can create a room');
    }
    const tenant = membership.tenant;

    const template = await this.prisma.moduleTemplate.findUniqueOrThrow({
      where: { key: 'ctd' },
      include: { nodes: { orderBy: { sortOrder: 'asc' } } },
    });

    const roomId = await this.prisma.$transaction(async (tx) => {
      const recipientCompanyId = await this.resolveRecipientCompany(tx, input);

      const room = await tx.room.create({
        data: {
          tenantId: tenant.id,
          name: input.name,
          status: 'draft',
          creatorSide: 'discloser',
          discloserCompanyId: tenant.companyId,
          recipientCompanyId,
          ndaRequired: input.ndaRequired,
          ndaVersion: input.ndaRequired ? 'v1' : null,
          allowDownload: input.allowDownload,
          watermarkEnabled: input.watermarkEnabled,
          createdBy: user.id,
        },
      });

      await tx.roomModule.createMany({
        data: [
          ...template.nodes.map((n) => ({
            roomId: room.id,
            code: n.code,
            title: n.title,
            sortOrder: n.sortOrder,
            sourceTemplateNodeId: n.id,
            section: 'dossier' as const,
          })),
          // Documents section (D13) — one container so folders have a parent module.
          { roomId: room.id, code: 'documents', title: 'Documents', sortOrder: 0, section: 'documents' as const },
        ],
      });

      await tx.roomParticipant.create({
        data: {
          roomId: room.id,
          userId: user.id,
          companyId: tenant.companyId,
          side: 'discloser',
          role: 'admin',
          status: 'active',
          acceptedAt: new Date(),
        },
      });

      return room.id;
    });

    await this.audit.record({
      action: 'room.created',
      roomId,
      targetType: 'room',
      targetId: roomId,
      metadata: { name: input.name },
    });

    return this.getForUser(user.id, roomId);
  }

  /** Groups screen — people by company, each side together (mvp-plan §6). */
  async listParticipants(userId: string, roomId: string): Promise<ParticipantGroup[]> {
    await this.access.requireParticipant(userId, roomId);
    const rows = await this.prisma.roomParticipant.findMany({
      where: { roomId, status: { not: 'revoked' } },
      include: { user: true, company: true },
      orderBy: [{ side: 'asc' }, { role: 'desc' }, { createdAt: 'asc' }],
    });

    const groups = new Map<string, ParticipantGroup>();
    for (const p of rows) {
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
    return [...groups.values()];
  }

  /** Existing-user path into a room: NDA click-through, then activate (mvp-plan §5.2). */
  async acceptNda(userId: string, roomId: string, ndaAccepted: boolean): Promise<RoomDetail> {
    const participant = await this.access.requireParticipant(userId, roomId);
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    if (room.ndaRequired && !participant.ndaAcceptedAt) {
      if (!ndaAccepted) throw new BadRequestException('You must accept the NDA to enter this room');
      const now = new Date();
      await this.prisma.$transaction([
        this.prisma.roomParticipant.update({
          where: { id: participant.id },
          data: { status: 'active', acceptedAt: participant.acceptedAt ?? now, ndaAcceptedAt: now },
        }),
        this.prisma.invitation.updateMany({
          where: { roomId, email: (await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })).email, status: 'pending' },
          data: { status: 'accepted', acceptedUserId: userId },
        }),
      ]);
      await this.audit.record({ action: 'nda.accepted', roomId, actorUserId: userId, metadata: { version: room.ndaVersion } });
    } else if (participant.status === 'invited') {
      await this.prisma.roomParticipant.update({
        where: { id: participant.id },
        data: { status: 'active', acceptedAt: participant.acceptedAt ?? new Date() },
      });
    }
    return this.getForUser(userId, roomId);
  }

  private async resolveRecipientCompany(
    tx: Prisma.TransactionClient,
    input: CreateRoomRequest,
  ): Promise<string | null> {
    if (input.recipientCompanyId) {
      const existing = await tx.company.findUnique({ where: { id: input.recipientCompanyId } });
      if (!existing) throw new NotFoundException('Recipient company not found');
      return existing.id;
    }
    if (input.recipientCompanyName) {
      const created = await tx.company.create({ data: { name: input.recipientCompanyName } });
      return created.id;
    }
    return null;
  }
}
