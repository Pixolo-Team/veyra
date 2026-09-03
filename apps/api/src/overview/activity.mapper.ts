import type { Prisma } from '@prisma/client';
import type { ActivityEvent } from '@veyra/contracts';

export type AuditRow = Prisma.AuditEventGetPayload<{
  include: {
    actorUser: true;
    actorParticipant: { include: { company: true } };
  };
}>;

/** What the event pointed at, by target type and id. */
export type TargetNames = Map<string, string>;

export function targetKey(type: string | null, id: string | null): string {
  return `${type ?? ''}:${id ?? ''}`;
}

export function toActivityEvent(e: AuditRow, names?: TargetNames): ActivityEvent {
  return {
    id: e.id,
    action: e.action,
    actorName: e.actorUser?.name ?? e.actorUser?.email ?? null,
    actorCompany: e.actorParticipant?.company?.name ?? null,
    actorSide: (e.actorParticipant?.side as ActivityEvent['actorSide']) ?? null,
    targetType: e.targetType,
    targetId: e.targetId,
    targetName: names?.get(targetKey(e.targetType, e.targetId)) ?? null,
    metadata: (e.metadata as Record<string, unknown>) ?? {},
    ip: e.ip,
    createdAt: e.createdAt.toISOString(),
  };
}
