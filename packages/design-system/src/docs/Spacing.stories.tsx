import type { Meta, StoryObj } from '@storybook/react-vite';

import { elevation, fontFamily, fontSize, radius, space } from '../tokens';
import { useThemeMode, useVeyraTokens } from '../theme';
import { Grid, Section } from './Swatch';

const meta: Meta = {
  title: 'Foundations/Spacing & Elevation',
  parameters: {
    docs: {
      description: {
        component:
          'Spacing sits on a 4px grid. Elevation is defined per theme — a shadow tuned ' +
          'for white vanishes on near-black, so dark mode leans on lighter surfaces too.',
      },
    },
  },
};
export default meta;

export const Spacing: StoryObj = {
  render: function SpacingStory() {
    const { colors } = useVeyraTokens();
    return (
      <Section title="Spacing scale" description="4px base grid.">
        {Object.entries(space).map(([name, value]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: space.lg, paddingBlock: space.xs }}>
            <code style={{ fontFamily: fontFamily.mono, fontSize: fontSize.xs, color: colors.textTertiary, width: 96 }}>
              {name} / {value}px
            </code>
            <div style={{ height: 16, width: Math.max(value, 1), background: colors.brand, borderRadius: 2 }} />
          </div>
        ))}
      </Section>
    );
  },
};

export const Radius: StoryObj = {
  render: function RadiusStory() {
    const { colors } = useVeyraTokens();
    return (
      <Section title="Corner radius">
        <Grid min={140}>
          {Object.entries(radius).map(([name, value]) => (
            <div key={name}>
              <div
                style={{
                  height: 72,
                  borderRadius: value,
                  background: colors.brandSubtle,
                  border: `1px solid ${colors.brandBorder}`,
                  marginBottom: space.sm,
                }}
              />
              <code style={{ fontFamily: fontFamily.mono, fontSize: fontSize.xs, color: colors.textTertiary }}>
                {name} / {value}px
              </code>
            </div>
          ))}
        </Grid>
      </Section>
    );
  },
};

export const Elevation: StoryObj = {
  render: function ElevationStory() {
    const { mode } = useThemeMode();
    const { colors } = useVeyraTokens();
    return (
      <Section title="Elevation" description={`Shadows resolved for ${mode} mode.`}>
        <Grid min={180}>
          {Object.entries(elevation[mode]).map(([name, shadow]) => (
            <div key={name}>
              <div
                style={{
                  height: 96,
                  borderRadius: radius.lg,
                  background: colors.bgSurfaceRaised,
                  boxShadow: shadow,
                  marginBottom: space.md,
                }}
              />
              <code style={{ fontFamily: fontFamily.mono, fontSize: fontSize.xs, color: colors.textTertiary }}>
                elevation.{mode}.{name}
              </code>
            </div>
          ))}
        </Grid>
      </Section>
    );
  },
};
