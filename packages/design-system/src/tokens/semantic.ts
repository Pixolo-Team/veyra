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
  /**
   * The logo mark's ground. Identical in both modes on purpose: a logo is an
   * identity, not a themed surface, and the mark's white strokes need a dark
   * enough field to read — which the dark-mode `brand` (a lighter step, chosen
   * to be legible *as text* on near-black) cannot give them.
   */
  brandMark: string;

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
  /**
   * The faintest grouping fill: "these rows belong together", inside a panel
   * that is already a surface.
   *
   * Tinted toward the brand rather than down the neutral ramp, and that is the
   * whole point of the role. A neutral wash on a white panel is the same colour
   * as the canvas around it, so it doesn't read as a group — it reads as the
   * page showing through a hole in the panel. It is also deliberately weaker
   * than `brandSubtle`, which marks the *selected* row and has to stay the one
   * thing colour picks out.
   */
  bgWash: string;
  /*
   * Sidebar. The rail is told apart from the page by its *ground*, not by a
   * rule down its edge — so it needs a tint that reads as a distinct surface
   * next to both the canvas and the white cards floating on it, plus its own
   * hover and selected states that stay visible on that tint (`bgHover` is
   * tuned for the canvas and vanishes here).
   *
   * There is deliberately no sidebar border role. Adding one is how the rule
   * comes back.
   */
  sidebarBg: string;
  sidebarText: string;
  sidebarTextActive: string;
  sidebarActiveBg: string;
  sidebarHoverBg: string;

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
  brandMark: veyra[5],

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
  /*
   * The canvas is a step of real grey, not near-white, and that is
   * load-bearing: the chrome separates regions by ground instead of by rules,
   * which only works if a white surface visibly lifts off the page behind it.
   * At neutral[1] the step was too small to see and every panel needed a
   * border to exist.
   */
  bgCanvas: neutral[2],
  bgSurface: neutral[0],
  bgSurfaceRaised: neutral[0],
  bgHover: neutral[1],
  bgActive: neutral[2],
  bgWash: '#f8faff', // white → veyra[0], just under halfway
  // The rail is a surface floating on the canvas, like every other panel — so
  // it takes the same white, and the grey around it draws its edge.
  sidebarBg: neutral[0],
  sidebarText: neutral[7],
  sidebarTextActive: veyra[5],
  sidebarActiveBg: veyra[0],
  sidebarHoverBg: neutral[1],

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
  brandSubtle: '#1b2750',
  brandBorder: veyra[7],
  brandMark: veyra[5], // deliberately not veyra[3] — see the role's note

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
  bgWash: '#191f30', // bgSurface → brandSubtle, a quarter of the way
  sidebarBg: '#181c25', // the surface white's counterpart
  sidebarText: '#a8b0c0',
  sidebarTextActive: '#8eb0fb',
  sidebarActiveBg: '#1b2750',
  sidebarHoverBg: '#232936',

  border: '#2b3140',
  borderStrong: '#5f6980',
  divider: '#232936',
};

export type ThemeMode = 'light' | 'dark';

export const colorsByMode: Record<ThemeMode, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};
