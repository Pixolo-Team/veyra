/**
 * Translates Veyra tokens into an antd `ThemeConfig`.
 *
 * This is the single bridge between the two vocabularies. antd derives a large
 * alias-token set from a handful of seed tokens, so the job here is to feed it
 * good seeds and then correct only the aliases where our intent differs from
 * its derivation — not to restate every token by hand.
 */

import { theme as antdTheme, type ThemeConfig } from 'antd';

import {
  borderWidth,
  colorsByMode,
  controlHeight,
  duration,
  elevation,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  radius,
  space,
  zIndex,
  type ElevationScale,
  type SemanticColors,
  type ThemeMode,
} from '../tokens';

export interface CreateThemeOptions {
  mode?: ThemeMode;
  /** Adds antd's compact algorithm — tighter control heights and paddings. */
  compact?: boolean;
  /**
   * Emit CSS variables instead of hashed static styles. Makes theme switching
   * cheap at runtime and lets plain CSS read `--ant-*` values.
   *
   * Pass an object to change the variable prefix (antd v6 dropped the boolean
   * form of `ThemeConfig['cssVar']`, so `true` maps to the default prefix).
   * @default true
   */
  cssVar?: boolean | { prefix?: string; key?: string };
  /** Escape hatch: merged over the generated config, last write wins. */
  overrides?: ThemeConfig;
}

/** Seed + alias tokens shared by both modes. */
function baseTokens(colors: SemanticColors, shadows: ElevationScale) {
  return {
    /* --- Seeds: antd derives ~90 alias tokens from these --- */
    colorPrimary: colors.brand,
    colorSuccess: colors.success,
    colorWarning: colors.warning,
    colorError: colors.danger,
    colorInfo: colors.info,
    colorLink: colors.link,
    colorTextBase: colors.textBase,
    colorBgBase: colors.bgBase,

    fontFamily: fontFamily.sans,
    fontFamilyCode: fontFamily.mono,
    fontSize: fontSize.md,

    borderRadius: radius.md,
    lineWidth: borderWidth.thin,
    controlHeight: controlHeight.md,

    sizeUnit: 4,
    sizeStep: 4,

    motionUnit: 0.1,
    motionBase: 0,

    zIndexBase: zIndex.base,
    zIndexPopupBase: zIndex.popupBase,
    wireframe: false,

    /* --- Aliases where our intent differs from antd's derivation --- */
    colorText: colors.textPrimary,
    colorTextSecondary: colors.textSecondary,
    colorTextTertiary: colors.textTertiary,
    colorTextDisabled: colors.textDisabled,

    colorPrimaryHover: colors.brandHover,
    colorPrimaryActive: colors.brandActive,
    colorPrimaryBg: colors.brandSubtle,
    colorPrimaryBorder: colors.brandBorder,

    colorSuccessBg: colors.successSubtle,
    colorWarningBg: colors.warningSubtle,
    colorErrorBg: colors.dangerSubtle,
    colorInfoBg: colors.infoSubtle,


    colorBgLayout: colors.bgCanvas,
    colorBgContainer: colors.bgSurface,
    colorBgElevated: colors.bgSurfaceRaised,
    colorBgTextHover: colors.bgHover,
    colorBgTextActive: colors.bgActive,
    controlItemBgHover: colors.bgHover,
    controlItemBgActive: colors.brandSubtle,

    colorBorder: colors.borderStrong,
    colorBorderSecondary: colors.border,
    colorSplit: colors.divider,

    /* Type scale */
    fontSizeSM: fontSize.sm,
    fontSizeLG: fontSize.lg,
    fontSizeXL: fontSize.xl,
    fontSizeHeading1: fontSize['4xl'],
    fontSizeHeading2: fontSize['3xl'],
    fontSizeHeading3: fontSize['2xl'],
    fontSizeHeading4: fontSize.xl,
    fontSizeHeading5: fontSize.lg,
    fontWeightStrong: fontWeight.semibold,
    lineHeight: lineHeight.normal,
    lineHeightHeading1: lineHeight.tight,
    lineHeightHeading2: lineHeight.tight,
    lineHeightHeading3: lineHeight.snug,

    /* Radii */
    borderRadiusSM: radius.sm,
    borderRadiusLG: radius.lg,
    borderRadiusXS: radius.sm,

    /* Controls */
    controlHeightSM: controlHeight.sm,
    controlHeightLG: controlHeight.lg,

    /* Elevation */
    boxShadow: shadows.md,
    boxShadowSecondary: shadows.lg,
    boxShadowTertiary: shadows.sm,

    /*
     * antd dims a loading control to 65%, which drops its label under AA — and
     * a loading Button is not marked `aria-disabled`, so it doesn't qualify for
     * the WCAG exemption that covers genuinely inactive components. The spinner
     * already signals the state, and does it without relying on colour, so the
     * label keeps its full contrast instead.
     */
    opacityLoading: 1,

    /* Motion — expressed in seconds, as antd expects */
    motionDurationFast: `${duration.fast / 1000}s`,
    motionDurationMid: `${duration.base / 1000}s`,
    motionDurationSlow: `${duration.slow / 1000}s`,

    /* Layout padding, aligned to our 4px grid */
    padding: space.lg,
    paddingSM: space.md,
    paddingXS: space.sm,
    paddingXXS: space.xs,
    paddingLG: space.xl,
    margin: space.lg,
    marginSM: space.md,
    marginXS: space.sm,
    marginXXS: space.xs,
    marginLG: space.xl,
    marginXL: space['2xl'],
  };
}

/** Per-component tokens for cases a global token can't express. */
function componentTokens(colors: SemanticColors, shadows: ElevationScale, mode: ThemeMode) {
  return {
    Button: {
      /*
       * The label colour on solid coloured buttons. antd routes these through
       * `primaryColor`/`dangerColor` — `solidTextColor` only covers
       * `color="default"` (see `button/style/variant.js`).
       *
       * Dark mode puts two requirements in direct opposition: the fill has to
       * be light enough to read as text on a near-black canvas, and dark
       * enough for a white label to clear AA on top of it. No single value
       * does both. Dark ink on the solid variants resolves it — the fill stays
       * light and the label takes its contrast from below instead.
       */
      primaryColor: mode === 'dark' ? colors.textInverse : '#ffffff',
      dangerColor: mode === 'dark' ? colors.textInverse : '#ffffff',
      fontWeight: fontWeight.medium,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      paddingInline: space.lg,
      paddingInlineLG: space.xl,
      paddingInlineSM: space.md,
    },
    Card: {
      headerFontSize: fontSize.lg,
      headerHeight: 52,
      paddingLG: space.xl,
      boxShadowTertiary: shadows.sm,
      colorBorderSecondary: colors.border,
    },
    /*
     * antd sizes a vertical form label to the *control* height — 40px at
     * size="large" — around a 22px line, which leaves ~18px of dead air under
     * every label. Pin the label box to its own line height so the gap between
     * a label and its field is the 8px the spacing scale asks for, not 26px.
     */
    Form: {
      labelHeight: Math.round(fontSize.md * lineHeight.normal),
      verticalLabelPadding: `0 0 ${space.sm}px`,
      itemMarginBottom: space.lg,
    },
    Input: {
      paddingInline: space.md,
      activeShadow: `0 0 0 3px ${colors.brandSubtle}`,
      errorActiveShadow: `0 0 0 3px ${colors.dangerSubtle}`,
      warningActiveShadow: `0 0 0 3px ${colors.warningSubtle}`,
    },
    Select: { optionSelectedBg: colors.brandSubtle },
    Table: {
      headerBg: colors.bgCanvas,
      headerColor: colors.textSecondary,
      headerSplitColor: 'transparent',
      rowHoverBg: colors.bgHover,
      borderColor: colors.divider,
      cellPaddingBlock: space.md,
    },
    Modal: {
      titleFontSize: fontSize.xl,
      headerBg: colors.bgSurfaceRaised,
      contentBg: colors.bgSurfaceRaised,
      boxShadow: shadows.xl,
    },
    Menu: {
      itemBorderRadius: radius.md,
      itemSelectedBg: colors.brandSubtle,
      itemSelectedColor: colors.brand,
      itemHeight: 36,
    },
    Tooltip: { colorBgSpotlight: colors.textPrimary, colorTextLightSolid: colors.textInverse },
    Tag: { defaultBg: colors.bgCanvas, defaultColor: colors.textSecondary, borderRadiusSM: radius.sm },
    Layout: {
      headerBg: colors.bgSurface,
      headerHeight: 56,
      headerPadding: `0 ${space.xl}px`,
      bodyBg: colors.bgCanvas,
      siderBg: colors.bgSurface,
    },
    Tabs: { horizontalItemPadding: `${space.md}px 0`, titleFontSize: fontSize.md },
    Alert: { withDescriptionPadding: `${space.lg}px ${space.lg}px` },
  };
}

/** Shallow-merges `overrides` over the generated config, one level into each key. */
function mergeConfig(base: ThemeConfig, overrides?: ThemeConfig): ThemeConfig {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    token: { ...base.token, ...overrides.token },
    components: { ...base.components, ...overrides.components },
  };
}

/**
 * Builds the antd `ThemeConfig` for a mode.
 *
 * @example
 * const dark = createTheme({ mode: 'dark', compact: true });
 * <ConfigProvider theme={dark}>{children}</ConfigProvider>
 */
export function createTheme(options: CreateThemeOptions = {}): ThemeConfig {
  const { mode = 'light', compact = false, cssVar = true, overrides } = options;

  const colors = colorsByMode[mode];
  const shadows = elevation[mode];

  // antd v6 takes only the object form; `true` means "on, default prefix".
  const cssVarConfig = cssVar === true ? {} : cssVar === false ? undefined : cssVar;

  const algorithm = [
    mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    ...(compact ? [antdTheme.compactAlgorithm] : []),
  ];

  return mergeConfig(
    {
      algorithm,
      cssVar: cssVarConfig,
      // Static styles are redundant once CSS variables carry the theme.
      hashed: !cssVarConfig,
      token: baseTokens(colors, shadows),
      components: componentTokens(colors, shadows, mode),
    },
    overrides,
  );
}

export const lightTheme = createTheme({ mode: 'light' });
export const darkTheme = createTheme({ mode: 'dark' });
