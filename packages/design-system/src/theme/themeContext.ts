/**
 * Theme context and its hook, kept separate from `ThemeProvider.tsx`.
 *
 * A file that exports both a component and non-component values opts out of
 * React Fast Refresh, so the provider stays alone in its module.
 */

import { createContext, useContext } from 'react';

import type { ThemeMode } from '../tokens';

/** `system` follows the OS; `light`/`dark` pin the choice. */
export type ThemePreference = ThemeMode | 'system';

export interface ThemeContextValue {
  /** The mode actually rendering right now — never `system`. */
  mode: ThemeMode;
  /** What the user chose, which may be `system`. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Flips between light and dark, resolving `system` to its opposite first. */
  toggleMode: () => void;
  compact: boolean;
  setCompact: (compact: boolean) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads the theme context. Throws outside a `ThemeProvider` rather than guessing. */
export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a <ThemeProvider>.');
  }
  return context;
}
