import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationDto,
  InvitationPreview,
  SessionUser,
} from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { hashPassword, newToken, sha256Hex } from '../auth/crypto';
import { type SessionContext, SessionService } from '../auth/session.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';

const INVITE_TTL_MS = 14 * 24 * 3600_000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roomAccess: RoomAccessService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly sessions: SessionService,
  ) {}

  async list(userId: string, roomId: string): Promise<InvitationDto[]> {
    await this.roomAccess.requireRole(userId, roomId, 'admin');
    const rows = await this.prisma.invitation.findMany({
      where: { roomId },
      include: { company: true, invitedByUser: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
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
  }

  async create(
    inviter: User,
    roomId: string,
    input: CreateInvitationRequest,
  ): Promise<InvitationDto> {
    const caller = await this.roomAccess.requireWriteRole(inviter.id, roomId, 'admin');
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });

    const token = newToken();
    const dtoId = await this.prisma.$transaction(async (tx) => {
      let companyId = await this.resolveCompany(tx, input);
      const side: 'discloser' | 'recipient' =
        companyId === room.discloserCompanyId ? 'discloser' : 'recipient';

      // The room fixes one company per side. If the recipient company is already
      // set, everyone recipient-side joins under it — the input only chooses who,
      // not which org (mvp-plan: one discloser ⇄ one recipient).
      if (side === 'recipient') {
        if (room.recipientCompanyId) {
          companyId = room.recipientCompanyId;
        } else {
          await tx.room.update({ where: { id: roomId }, data: { recipientCompanyId: companyId } });
        }
      }

      // A recipient admin may only invite within their own side (mvp-plan §9.3).
      if (caller.side === 'recipient' && side !== 'recipient') {
        throw new ForbiddenException('A recipient admin can only invite recipient-side people');
      }

      const existing = await tx.user.findUnique({ where: { email: input.email } });
      if (existing) {
        const dupe = await tx.roomParticipant.findUnique({
          where: { roomId_userId: { roomId, userId: existing.id } },
        });
        if (dupe && dupe.status !== 'revoked') {
          throw new ConflictException('That person is already in this room');
        }
      }

      const user =
        existing ??
        (await tx.user.create({ data: { email: input.email, status: 'invited' } }));

      const invitation = await tx.invitation.create({
        data: {
          roomId,
          email: input.email,
          companyId,
          side,
          role: input.role,
          tokenHash: sha256Hex(token),
          invitedBy: inviter.id,
          status: 'pending',
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          sentAt: new Date(),
        },
      });

      await tx.roomParticipant.upsert({
        where: { roomId_userId: { roomId, userId: user.id } },
        update: { status: 'invited', side, role: input.role, companyId, invitedBy: inviter.id },
        create: {
          roomId,
          userId: user.id,
          companyId,
          side,
          role: input.role,
          status: 'invited',
          invitedBy: inviter.id,
        },
      });

      await this.email.enqueue(
        input.email,
        existing ? 'room_added' : 'room_invite',
        {
          token,
          roomName: room.name,
          inviterName: inviter.name ?? '',
          role: input.role,
        },
        { client: tx },
      );

      return invitation.id;
    });

    await this.audit.record({
      action: 'invitation.created',
      roomId,
      targetType: 'invitation',
      targetId: dtoId,
      metadata: { email: input.email, role: input.role },
    });

    return (await this.list(inviter.id, roomId)).find((i) => i.id === dtoId)!;
  }

  /** Public — shown on the accept screen before the user commits. */
  async preview(token: string): Promise<InvitationPreview> {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256Hex(token) },
      include: {
        room: { include: { discloserCompany: true } },
        invitedByUser: true,
      },
    });
    if (!inv) throw new NotFoundException('Invitation not found');
    const user = await this.prisma.user.findUnique({ where: { email: inv.email } });
    return {
      roomName: inv.room.name,
      inviterName: inv.invitedByUser?.name ?? null,
      discloserCompanyName: inv.room.discloserCompany?.name ?? null,
      role: inv.role,
      side: inv.side as InvitationPreview['side'],
      email: inv.email,
      isNewUser: !user?.passwordHash,
      ndaRequired: inv.room.ndaRequired,
      ndaVersion: inv.room.ndaVersion,
      status: inv.status,
    };
  }

  /** Public — new user path: set password, accept NDA, activate, sign in. */
  async accept(
    input: AcceptInvitationRequest,
    ctx: SessionContext,
  ): Promise<{ user: SessionUser; token: string; expiresAt: Date }> {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256Hex(input.token) },
      include: { room: true },
    });
    if (!inv || inv.status !== 'pending') {
      throw new BadRequestException('This invitation is no longer valid');
    }
    if (inv.expiresAt < new Date()) {
      await this.prisma.invitation.update({ where: { id: inv.id }, data: { status: 'expired' } });
      throw new BadRequestException('This invitation has expired');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { email: inv.email } });
    const isNew = !user.passwordHash;
    if (isNew && !input.password) {
      throw new BadRequestException('Choose a password to finish setting up your account');
    }
    if (inv.room.ndaRequired && !input.ndaAccepted) {
      throw new BadRequestException('You must accept the NDA to enter this room');
    }

    const now = new Date();
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          status: 'active',
          name: input.name ?? user.name,
          ...(isNew ? { passwordHash: await hashPassword(input.password!) } : {}),
        },
      });
      await tx.roomParticipant.update({
        where: { roomId_userId: { roomId: inv.roomId, userId: user.id } },
        data: {
          status: 'active',
          acceptedAt: now,
          ndaAcceptedAt: inv.room.ndaRequired ? now : null,
        },
      });
      await tx.invitation.update({
        where: { id: inv.id },
        data: { status: 'accepted', acceptedUserId: user.id },
      });
      return u;
    });

    await this.audit.record({
      action: 'invitation.accepted',
      roomId: inv.roomId,
      actorUserId: user.id,
      targetType: 'invitation',
      targetId: inv.id,
    });
    if (inv.room.ndaRequired) {
      await this.audit.record({
        action: 'nda.accepted',
        roomId: inv.roomId,
        actorUserId: user.id,
        metadata: { version: inv.room.ndaVersion },
      });
    }

    const session = await this.sessions.create(user.id, ctx);
    return { user: AuthService.toSessionUser(updatedUser), ...session };
  }

  private async resolveCompany(
    tx: Prisma.TransactionClient,
    input: CreateInvitationRequest,
  ): Promise<string> {
    if (input.companyId) {
      const found = await tx.company.findUnique({ where: { id: input.companyId } });
      if (!found) throw new NotFoundException('Company not found');
      return found.id;
    }
    const existing = await tx.company.findFirst({
      where: { name: { equals: input.companyName!, mode: 'insensitive' } },
    });
    if (existing) return existing.id;
    const created = await tx.company.create({ data: { name: input.companyName! } });
    return created.id;
  }
}
