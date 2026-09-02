import type { Prisma } from '@prisma/client';
import type { ActivityEvent } from '@veyra/contracts';

export type AuditRow = Prisma.AuditEventGetPayload<{
  include: {
    actorUser: true;
    actorParticipant: true;
  };
}>;

export function toActivityEvent(e: AuditRow): ActivityEvent {
  return {
    id: e.id,
    action: e.action,
    actorName: e.actorUser?.name ?? null,
    actorSide: (e.actorParticipant?.side as ActivityEvent['actorSide']) ?? null,
    targetType: e.targetType,
    targetId: e.targetId,
    metadata: (e.metadata as Record<string, unknown>) ?? {},
    createdAt: e.createdAt.toISOString(),
  };
}
