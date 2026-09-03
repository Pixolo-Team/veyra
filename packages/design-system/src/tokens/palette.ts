/**
 * Raw colour ramps — the only place literal hex values are allowed.
 *
 * Nothing in the app should import from this file directly. Ramps are
 * referenced by `semantic.ts`, which gives each shade a job. Swapping a brand
 * colour means editing one ramp here, not hunting through components.
 *
 * Each ramp follows Ant Design's 10-step convention: index 0 is the lightest
 * tint, index 5 is the base (the shade fed to antd as a seed token), and
 * index 9 is the deepest shade.
 */

export type ColorRamp = readonly [
  string, string, string, string, string,
  string, string, string, string, string,
];

/**
 * Veyra brand blue. Base = `veyra[5]` = the colour of the wave in the logo
 * mark, so the mark and the UI are one brand rather than two blues.
 *
 * Anchored at #1a56db (hsl 221 79% 48%) and stepped through lightness at a
 * near-constant hue. Every text pairing the system relies on clears WCAG AA
 * with room to spare — see Foundations → Contrast, which measures the resolved
 * antd tokens rather than these seeds.
 */
export const veyra: ColorRamp = [
  '#f0f4ff',
  '#dce7fe',
  '#bacffd',
  '#8eb0fb',
  '#4c81f6',
  '#1a56db', // base — the logo mark
  '#1546b2',
  '#123a91',
  '#0f2e70',
  '#0b1f4c',
] as const;

/** Neutral greys. Text, borders, surfaces and dividers all derive from here. */
export const neutral: ColorRamp = [
  '#ffffff',
  '#f7f8fa',
  '#eef0f4',
  '#dfe3ea',
  '#b9c0cd',
  '#878fa1', // base — clears 3:1 on white, so control outlines are visible
  '#68707f',
  '#4e5666',
  '#2f3542',
  '#171b24',
] as const;

/** Positive / confirmation states. */
export const success: ColorRamp = [
  '#eafaf1',
  '#c9f2dc',
  '#9ae7c1',
  '#66d9a3',
  '#3ac886',
  '#17b26a', // base
  '#0f9256',
  '#0a7343',
  '#065533',
  '#043823',
] as const;

/** Caution states — pending, degraded, needs attention. */
export const warning: ColorRamp = [
  '#fff8e8',
  '#ffedc4',
  '#ffdd94',
  '#ffc95c',
  '#fdb52e',
  '#f59e0b', // base
  '#cc7f05',
  '#a26305',
  '#7a4a06',
  '#523104',
] as const;

/** Destructive / failure states. */
export const danger: ColorRamp = [
  '#fef1f1',
  '#fcdcdc',
  '#f9baba',
  '#f58f8f',
  '#ef6464',
  '#d13333', // base
  '#bd2c2c',
  '#971f1f',
  '#711717',
  '#4b0f0f',
] as const;

/** Informational / neutral emphasis states. */
export const info: ColorRamp = [
  '#eef6ff',
  '#d3e7ff',
  '#a9d0ff',
  '#75b2ff',
  '#4592fb',
  '#2176ee', // base
  '#155cc4',
  '#0e469b',
  '#0a3373',
  '#06214d',
] as const;

export const ramps = { veyra, neutral, success, warning, danger, info } as const;

export type RampName = keyof typeof ramps;
