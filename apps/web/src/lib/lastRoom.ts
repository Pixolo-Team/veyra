/**
 * Which room to open on `/`. Multi-room is the default (D12), so landing on a
 * list every time would be a click tax on the common single-deal case.
 */
const KEY = 'veyra.last-room';

export function lastRoomId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null; // private mode — fall back to the first room
  }
}

export function rememberRoom(roomId: string): void {
  try {
    window.localStorage.setItem(KEY, roomId);
  } catch {
    // Nothing to do; the app just opens on the first room next time.
  }
}
