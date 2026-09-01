import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from 'antd';

import { ramps, type RampName } from '../tokens/palette';
import { useVeyraTokens } from '../theme';
import { space } from '../tokens';
import { Grid, Section, Swatch } from './Swatch';

const meta: Meta = {
  title: 'Foundations/Colors',
  parameters: {
    docs: {
      description: {
        component:
          'Raw ramps live in `tokens/palette.ts`; roles live in `tokens/semantic.ts`. ' +
          'Application code reads roles — never ramps — so a rebrand is a one-file change.',
      },
    },
  },
};
export default meta;

function Ramp({ name }: { name: RampName }) {
  return (
    <div style={{ marginBottom: space.xl }}>
      <Typography.Text strong style={{ display: 'block', marginBottom: space.sm }}>
        {name}
      </Typography.Text>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm }}>
        {ramps[name].map((value, index) => (
          <Swatch
            key={value}
            name={`${name}[${index}]`}
            value={value}
            note={index === 5 ? 'base' : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Every ramp, all ten steps. Index 5 is the base fed to antd as a seed token. */
export const Palette: StoryObj = {
  render: () => (
    <Section title="Palette ramps" description="Index 5 is the base of each ramp.">
      {(Object.keys(ramps) as RampName[]).map((name) => (
        <Ramp key={name} name={name} />
      ))}
    </Section>
  ),
};

/** The roles components actually consume. Switch the toolbar theme to compare modes. */
export const SemanticRoles: StoryObj = {
  render: function SemanticRolesStory() {
    const { colors } = useVeyraTokens();
    const groups: Record<string, string[]> = {
      Brand: ['brand', 'brandHover', 'brandActive', 'brandSubtle', 'brandBorder'],
      Status: [
        'success', 'successSubtle',
        'warning', 'warningSubtle',
        'danger', 'dangerSubtle',
        'info', 'infoSubtle',
      ],
      Text: [
        'textPrimary', 'textSecondary', 'textTertiary',
        'textDisabled', 'textInverse', 'link',
      ],
      Surface: ['bgCanvas', 'bgSurface', 'bgSurfaceRaised', 'bgHover', 'bgActive'],
      Line: ['border', 'borderStrong', 'divider'],
    };

    return (
      <>
        {Object.entries(groups).map(([group, keys]) => (
          <Section key={group} title={group}>
            <Grid>
              {keys.map((key) => (
                <Swatch key={key} name={key} value={colors[key as keyof typeof colors]} />
              ))}
            </Grid>
          </Section>
        ))}
      </>
    );
  },
};
