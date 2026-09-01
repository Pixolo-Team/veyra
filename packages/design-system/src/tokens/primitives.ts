/**
 * Non-colour primitives: type, space, radius, elevation, motion, z-index.
 *
 * These are plain values with no knowledge of antd. `theme/` maps them onto
 * antd's token names; `semantic.ts` handles the colour half of the same job.
 */

/* ------------------------------------------------------------------ *
 * Typography
 * ------------------------------------------------------------------ */

export const fontFamily = {
  sans: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`,
} as const;

/**
 * Type scale in px, on a ~1.2 ratio anchored at `md` (14px — antd's base).
 * Named by role rather than by number so a rescale doesn't rename every usage.
 */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14, // body / antd base
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Unitless line heights, paired with the size of the same name. */
export const lineHeight = {
  tight: 1.25,
  snug: 1.4,
  normal: 1.5715, // antd's default body line height
  relaxed: 1.7,
} as const;

/* ------------------------------------------------------------------ *
 * Spacing
 * ------------------------------------------------------------------ */

/**
 * 4px base grid. antd derives its own paddings from `sizeUnit`/`sizeStep`,
 * so these are for layout code — page gutters, stacks, grids — rather than
 * for overriding component internals.
 */
export const space = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
} as const;

/* ------------------------------------------------------------------ *
 * Radius & borders
 * ------------------------------------------------------------------ */

export const radius = {
  none: 0,
  sm: 4,
  md: 6, // default control radius
  lg: 10,
  xl: 16,
  pill: 999,
} as const;

export const borderWidth = {
  none: 0,
  thin: 1,
  thick: 2,
} as const;

/* ------------------------------------------------------------------ *
 * Elevation
 * ------------------------------------------------------------------ */

/**
 * Shadows are defined per theme because a shadow that reads as "lifted" on
 * white reads as invisible on near-black. Light uses soft dark shadows; dark
 * leans on stronger, tighter ones plus surface lightening.
 */
export interface ElevationScale {
  none: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
}

export const elevation: Record<'light' | 'dark', ElevationScale> = {
  light: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(23, 27, 36, 0.06), 0 1px 3px 0 rgba(23, 27, 36, 0.08)',
    md: '0 2px 4px -1px rgba(23, 27, 36, 0.06), 0 4px 12px -2px rgba(23, 27, 36, 0.10)',
    lg: '0 8px 16px -4px rgba(23, 27, 36, 0.10), 0 16px 32px -8px rgba(23, 27, 36, 0.12)',
    xl: '0 16px 32px -8px rgba(23, 27, 36, 0.14), 0 32px 64px -16px rgba(23, 27, 36, 0.18)',
  },
  dark: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.40), 0 1px 3px 0 rgba(0, 0, 0, 0.50)',
    md: '0 2px 4px -1px rgba(0, 0, 0, 0.45), 0 4px 12px -2px rgba(0, 0, 0, 0.55)',
    lg: '0 8px 16px -4px rgba(0, 0, 0, 0.50), 0 16px 32px -8px rgba(0, 0, 0, 0.60)',
    xl: '0 16px 32px -8px rgba(0, 0, 0, 0.55), 0 32px 64px -16px rgba(0, 0, 0, 0.65)',
  },
} as const;

/* ------------------------------------------------------------------ *
 * Motion
 * ------------------------------------------------------------------ */

export const duration = {
  instant: 0,
  fast: 100,
  base: 200,
  slow: 300,
  slower: 500,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  emphasized: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

/* ------------------------------------------------------------------ *
 * Layering
 * ------------------------------------------------------------------ */

/**
 * antd stacks its own popups from `zIndexPopupBase` (1000) upward, so app
 * chrome stays below that line and anything that must clear every popup
 * sits well above it.
 */
export const zIndex = {
  base: 0,
  raised: 10,
  sticky: 100,
  header: 200,
  drawer: 900,
  popupBase: 1000, // antd popups own 1000–1999
  toast: 2000,
} as const;

/* ------------------------------------------------------------------ *
 * Control sizing
 * ------------------------------------------------------------------ */

export const controlHeight = {
  sm: 24,
  md: 32, // antd default
  lg: 40,
} as const;

/** Breakpoints in px, matching antd's Grid so custom media queries stay aligned. */
export const breakpoint = {
  xs: 480,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1600,
} as const;

export type FontSizeToken = keyof typeof fontSize;
export type SpaceToken = keyof typeof space;
export type RadiusToken = keyof typeof radius;
export type ElevationToken = keyof ElevationScale;
export type DurationToken = keyof typeof duration;
