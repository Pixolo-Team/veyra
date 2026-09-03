/**
 * Whether the room rail shows labels or icons alone.
 *
 * Persisted because it's a working preference, not a per-page state: someone
 * who collapses the rail to get screen back for a wide dossier means it for
 * the session after this one too.
 */

import { useCallback, useEffect, useState } from 'react';

export type SidebarMode = 'full' | 'compact';

const KEY = 'veyra.sidebar';

function read(): SidebarMode {
  try {
    return window.localStorage.getItem(KEY) === 'compact' ? 'compact' : 'full';
  } catch {
    return 'full'; // private mode — labels are the safer default
  }
}

export function useSidebarMode(): { mode: SidebarMode; toggle: () => void } {
  const [mode, setMode] = useState<SidebarMode>(read);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      // Nothing to do; the rail just opens expanded next time.
    }
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((current) => (current === 'full' ? 'compact' : 'full'));
  }, []);

  return { mode, toggle };
}
