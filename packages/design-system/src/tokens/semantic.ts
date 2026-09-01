/**
 * Semantic colour roles — what a colour is *for*, not what it looks like.
 *
 * Every role is defined once per mode. Components and theme config read these
 * names; the moment a component reaches past this file into `palette.ts` it
 * has hardcoded a look and stopped being themeable.
 */

import { danger, info, neutral, success, veyra, warning } from './palette';

export interface SemanticColors {
  /* Brand */
  brand: string;
  brandHover: string;
  brandActive: string;
  brandSubtle: string;
  brandBorder: string;

  /*
   * Status. Each status is one colour plus its tint.
   *
   * antd spends a single status token on two jobs — Tag and Alert paint
   * `colorSuccess` as *text and icons* on top of `colorSuccessBg`, while Badge
   * and Progress use it as a *fill*. (`colorSuccessText` exists but Tag never
   * reads it; see `tag/style/statusCmp.js`.) One token, both jobs, so the token
   * has to clear WCAG AA against its own tint — which rules out the vivid mid
   * ramp steps. These roles therefore point at the darker steps: the ramps keep
   * the vivid shades for anything decorative that carries no text.
   */
  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerSubtle: string;
  info: string;
  infoSubtle: string;

  /* Text — `base` feeds antd's `colorTextBase`, which derives the rest */
  textBase: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  link: string;

  /* Surfaces — `bgBase` feeds antd's `colorBgBase` */
  bgBase: string;
  bgCanvas: string;
  bgSurface: string;
  bgSurfaceRaised: string;
  bgHover: string;
  bgActive: string;

  /* Lines */
  border: string;
  borderStrong: string;
  divider: string;
}

/**
 * Light mode. Text sits at neutral[8]/[9] rather than pure black so long-form
 * reading stays comfortable while clearing WCAG AA on the canvas.
 */
export const lightColors: SemanticColors = {
  brand: veyra[5],
  brandHover: veyra[4],
  brandActive: veyra[6],
  brandSubtle: veyra[0],
  brandBorder: veyra[2],

  success: success[7],
  successSubtle: success[0],
  warning: warning[7],
  warningSubtle: warning[0],
  danger: danger[6],
  dangerSubtle: danger[0],
  info: info[6],
  infoSubtle: info[0],

  textBase: neutral[9],
  textPrimary: neutral[9],
  textSecondary: neutral[7],
  textTertiary: neutral[6],
  textDisabled: neutral[4],
  textInverse: neutral[0],
  link: veyra[5],

  bgBase: neutral[0],
  bgCanvas: neutral[1],
  bgSurface: neutral[0],
  bgSurfaceRaised: neutral[0],
  bgHover: neutral[1],
  bgActive: neutral[2],

  border: neutral[3],
  borderStrong: neutral[5],
  divider: neutral[2],
};

/**
 * Dark mode. Not a mechanical inversion: brand and status colours shift a step
 * lighter so they stay legible against a dark canvas, and raised surfaces get
 * *lighter* rather than casting a stronger shadow.
 */
export const darkColors: SemanticColors = {
  brand: veyra[3],
  brandHover: veyra[2],
  brandActive: veyra[4],
  brandSubtle: '#1c2140',
  brandBorder: veyra[7],

  success: success[4],
  successSubtle: '#0a2a1c',
  warning: warning[4],
  warningSubtle: '#2e2109',
  danger: danger[3],
  dangerSubtle: '#2e1414',
  info: info[3],
  infoSubtle: '#0d1f38',

  textBase: '#e6e9f0',
  textPrimary: '#e6e9f0',
  textSecondary: '#a8b0c0',
  textTertiary: '#7c8497',
  textDisabled: '#535b6c',
  textInverse: neutral[9],
  link: veyra[2],

  bgBase: '#12151c',
  bgCanvas: '#0d1016',
  bgSurface: '#181c25',
  bgSurfaceRaised: '#1f242f',
  bgHover: '#232936',
  bgActive: '#2b3241',

  border: '#2b3140',
  borderStrong: '#5f6980',
  divider: '#232936',
};

export type ThemeMode = 'light' | 'dark';

export const colorsByMode: Record<ThemeMode, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};
