import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContextService } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  action: string;
  actorUserId?: string | null;
  actorParticipantId?: string | null;
  roomId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.JsonObject;
  ip?: string;
  userAgent?: string;
}

/**
 * Append-only activity log (mvp-plan §4). Auth/platform events leave `roomId`
 * null; room content events set it. A failed write must never break the action
 * it records, so this swallows errors after logging them.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestCtx: RequestContextService,
  ) {}

  async record(input: AuditInput): Promise<void> {
    const ctx = this.requestCtx.get();
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: input.action,
          actorUserId: input.actorUserId ?? ctx.userId ?? null,
          actorParticipantId: input.actorParticipantId ?? null,
          roomId: input.roomId ?? null,
          targetType: input.targetType,
          targetId: input.targetId,
          metadata: input.metadata ?? {},
          ip: input.ip ?? ctx.ip,
          userAgent: input.userAgent ?? ctx.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit event "${input.action}"`, err as Error);
    }
  }
}
