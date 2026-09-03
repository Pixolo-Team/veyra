import type {
  ParticipantRole,
  ParticipantStatus,
  RoomStatus,
  Side,
} from '@veyra/contracts';

export type { RoomStatus };

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
};

export const ROOM_STATUS_COLORS: Record<RoomStatus, string> = {
  draft: 'default',
  active: 'green',
  closed: 'red',
  archived: 'default',
};

export const ROLE_LABELS: Record<ParticipantRole, string> = {
  admin: 'Admin — invites people and changes room settings',
  contributor: 'Contributor — uploads and organises documents',
  reviewer: 'Reviewer — reads, highlights and comments',
};

export const ROLE_SHORT: Record<ParticipantRole, string> = {
  admin: 'Admin',
  contributor: 'Contributor',
  reviewer: 'Reviewer',
};

export const SIDE_LABELS: Record<Side, string> = {
  discloser: 'Disclosing party',
  recipient: 'Receiving party',
  facilitator: 'Facilitator',
};

export const STATUS_LABELS: Record<ParticipantStatus, string> = {
  invited: 'Invited',
  active: 'Active',
  revoked: 'Revoked',
};
