/**
 * Typed access to the tokens from inside a component.
 *
 * `useAntdToken` returns antd's fully-resolved token set (every alias, already
 * run through the active algorithm) — reach for it when styling around an antd
 * component. `useVeyraTokens` returns our own semantic layer, for cases where
 * the role name matters more than antd's derivation.
 */

import { theme as antdTheme } from 'antd';
import type { GlobalToken } from 'antd';

import {
  colorsByMode,
  elevation,
  radius,
  space,
  type ElevationScale,
  type SemanticColors,
} from '../tokens';
import { useThemeMode } from './themeContext';

/** antd's resolved global token set for the active theme. */
export function useAntdToken(): GlobalToken {
  return antdTheme.useToken().token;
}

export interface VeyraTokens {
  colors: SemanticColors;
  shadows: ElevationScale;
  space: typeof space;
  radius: typeof radius;
}

/** Veyra's semantic tokens, resolved for the active mode. */
export function useVeyraTokens(): VeyraTokens {
  const { mode } = useThemeMode();
  return {
    colors: colorsByMode[mode],
    shadows: elevation[mode],
    space,
    radius,
  };
}
