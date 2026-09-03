import type { ActivityEvent } from '@veyra/contracts';

/**
 * How each audited action reads to a person.
 *
 * The log stores `document.downloaded`; an auditor reads "DOWNLOAD". Keeping
 * the translation here rather than in the screen means the wording of the log
 * is one list to review — which matters, because these labels are what an
 * auditor will quote back.
 *
 * `tone` groups events by what they mean rather than by severity: content
 * leaving the room, content changing, people changing, and refusals. A reader
 * scanning a thousand rows finds the download by its colour.
 */
export type EventTone = 'read' | 'egress' | 'write' | 'people' | 'denied';

/**
 * The glyph beside the label.
 *
 * A log is scanned before it is read: the eye down the left of the events
 * column is how "who looked at this" gets answered in a second, without
 * anyone parsing thirty rows of similar words.
 */
export type EventGlyph =
  | 'view'
  | 'download'
  | 'comment'
  | 'highlight'
  | 'resolve'
  | 'delete'
  | 'denied'
  | 'person'
  | 'edit';

interface EventLabel {
  label: string;
  tone: EventTone;
  glyph: EventGlyph;
}

const EVENTS: Record<string, EventLabel> = {
  'access.denied': { label: 'Denied', tone: 'denied', glyph: 'denied' },
  'annotation.created': { label: 'Highlight', tone: 'write', glyph: 'highlight' },
  'annotation.deleted': { label: 'Highlight removed', tone: 'write', glyph: 'delete' },
  'auth.login': { label: 'Sign in', tone: 'people', glyph: 'person' },
  'auth.login_failed': { label: 'Sign-in failed', tone: 'denied', glyph: 'denied' },
  'auth.logout': { label: 'Sign out', tone: 'people', glyph: 'person' },
  'auth.password_changed': { label: 'Password changed', tone: 'people', glyph: 'person' },
  'auth.password_reset_completed': { label: 'Password reset', tone: 'people', glyph: 'person' },
  'auth.password_reset_requested': { label: 'Reset requested', tone: 'people', glyph: 'person' },
  'comment.added': { label: 'Comment', tone: 'write', glyph: 'comment' },
  'comment.deleted': { label: 'Comment deleted', tone: 'write', glyph: 'delete' },
  'document.deleted': { label: 'Deleted', tone: 'write', glyph: 'delete' },
  'document.downloaded': { label: 'Download', tone: 'egress', glyph: 'download' },
  'document.moved': { label: 'Moved', tone: 'write', glyph: 'edit' },
  'document.read': { label: 'Read', tone: 'read', glyph: 'view' },
  'document.renamed': { label: 'Renamed', tone: 'write', glyph: 'edit' },
  'document.version_added': { label: 'New version', tone: 'write', glyph: 'edit' },
  'document.viewed': { label: 'View', tone: 'read', glyph: 'view' },
  'folder.created': { label: 'Folder added', tone: 'write', glyph: 'edit' },
  'folder.deleted': { label: 'Folder deleted', tone: 'write', glyph: 'delete' },
  'folder.moved': { label: 'Folder moved', tone: 'write', glyph: 'edit' },
  'folder.renamed': { label: 'Folder renamed', tone: 'write', glyph: 'edit' },
  'invitation.accepted': { label: 'Invite accepted', tone: 'people', glyph: 'person' },
  'invitation.created': { label: 'Invited', tone: 'people', glyph: 'person' },
  'nda.accepted': { label: 'NDA accepted', tone: 'people', glyph: 'person' },
  'room.created': { label: 'Room created', tone: 'people', glyph: 'person' },
  'room.status_changed': { label: 'Status changed', tone: 'people', glyph: 'person' },
  'thread.open': { label: 'Reopened', tone: 'write', glyph: 'comment' },
  'thread.resolved': { label: 'Resolved', tone: 'write', glyph: 'resolve' },
  'thread.created': { label: 'Thread', tone: 'write', glyph: 'comment' },
  'thread.visibility_changed': { label: 'Shared', tone: 'write', glyph: 'comment' },
  'upload_batch.completed': { label: 'Upload finished', tone: 'write', glyph: 'edit' },
  'upload_batch.created': { label: 'Upload started', tone: 'write', glyph: 'edit' },
};

/**
 * An unmapped action still has to read as something.
 *
 * A log that hides events it doesn't recognise is worse than one that prints
 * them raw: the row is the record, and a new action shipped by the API must
 * never go missing from the audit trail just because this table is behind.
 */
export function describeAction(action: string): EventLabel {
  const known = EVENTS[action];
  if (known) return known;
  const tail = action.split('.').at(-1) ?? action;
  return {
    label: tail.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
    tone: 'write',
    glyph: 'edit',
  };
}

/**
 * What the row says it happened to.
 *
 * Falls back through name, then a version note, then the bare id — an event
 * whose target has since been deleted still has to say what it pointed at.
 */
export function describeTarget(event: ActivityEvent): string {
  if (event.targetName) return event.targetName;
  if (event.targetType === 'request') {
    const path = event.metadata.path;
    return typeof path === 'string' ? path : 'A request outside the granted scope';
  }
  if (event.targetType && event.targetId) return `${event.targetType} ${event.targetId.slice(-6)}`;
  return '—';
}

/** "4m 20s" — durations in a log are read, not calculated. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${Math.round(seconds % 60)}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** The detail worth putting beside the object, when the event carries one. */
export function eventDetail(event: ActivityEvent): string | null {
  const seconds = event.metadata.seconds;
  if (typeof seconds === 'number') return formatDuration(seconds);
  const status = event.metadata.status;
  const method = event.metadata.method;
  if (typeof status === 'number' && typeof method === 'string') return `${method} · ${status}`;
  const version = event.metadata.versionNo;
  if (typeof version === 'number') return `v${version}`;
  return null;
}
