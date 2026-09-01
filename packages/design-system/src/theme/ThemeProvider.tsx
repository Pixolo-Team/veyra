/**
 * The single provider an app mounts. Owns theme mode, exposes it via context,
 * and wires antd's `ConfigProvider` plus the message/notification/modal
 * static-call bridge so those follow the theme too.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { App as AntApp, ConfigProvider } from 'antd';
import type { ThemeConfig } from 'antd';

import type { ThemeMode } from '../tokens';
import { createTheme } from './createTheme';
import { ThemeContext, type ThemeContextValue, type ThemePreference } from './themeContext';

const STORAGE_KEY = 'veyra.theme-mode';

export interface ThemeProviderProps {
  children: ReactNode;
  /** Initial preference. Ignored when a persisted value exists. */
  defaultPreference?: ThemePreference;
  compact?: boolean;
  /** Merged over the generated theme — for per-app or per-story tweaks. */
  themeOverrides?: ThemeConfig;
  /** Persist the choice to `localStorage`. @default true */
  persist?: boolean;
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveMode(preference: ThemePreference, systemIsDark: boolean): ThemeMode {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}

function readStoredPreference(fallback: ThemePreference): ThemePreference {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // Private mode or blocked storage — fall through to the default.
  }
  return fallback;
}

export function ThemeProvider({
  children,
  defaultPreference = 'system',
  compact: compactProp = false,
  themeOverrides,
  persist = true,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    persist ? readStoredPreference(defaultPreference) : defaultPreference,
  );
  const [systemIsDark, setSystemIsDark] = useState(prefersDark);

  /*
   * `compact` is settable from context *and* from the prop. Syncing the prop in
   * an effect would render once with the stale value first, so the correction
   * happens during render instead — React's documented pattern for state
   * derived from props.
   */
  const [compact, setCompact] = useState(compactProp);
  const [lastCompactProp, setLastCompactProp] = useState(compactProp);
  if (compactProp !== lastCompactProp) {
    setLastCompactProp(compactProp);
    setCompact(compactProp);
  }

  // Track the OS preference so `system` stays live rather than read-once.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      if (!persist || typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
    },
    [persist],
  );

  const mode = resolveMode(preference, systemIsDark);

  const toggleMode = useCallback(
    () => setPreference(mode === 'dark' ? 'light' : 'dark'),
    [mode, setPreference],
  );

  const theme = useMemo(
    () => createTheme({ mode, compact, overrides: themeOverrides }),
    [mode, compact, themeOverrides],
  );

  // Expose the mode to plain CSS and to the browser's own form controls
  // and scrollbars, which read `color-scheme` rather than our tokens.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
  }, [mode]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({ mode, preference, setPreference, toggleMode, compact, setCompact }),
    [mode, preference, setPreference, toggleMode, compact],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider theme={theme}>
        {/* Gives `App.useApp()` a themed context for message/notification/modal. */}
        <AntApp>{children}</AntApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
