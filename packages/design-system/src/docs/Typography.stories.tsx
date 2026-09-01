import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from 'antd';

import { fontFamily, fontSize, fontWeight, lineHeight, space } from '../tokens';
import { useVeyraTokens } from '../theme';
import { Section } from './Swatch';

const meta: Meta = {
  title: 'Foundations/Typography',
  parameters: {
    docs: {
      description: {
        component:
          'A ~1.2-ratio scale anchored at `md` (14px, antd’s base). Sizes are named by ' +
          'role rather than by number so a rescale never renames a usage site.',
      },
    },
  },
};
export default meta;

export const Scale: StoryObj = {
  render: function ScaleStory() {
    const { colors } = useVeyraTokens();
    return (
      <>
        <Section title="Type scale">
          {Object.entries(fontSize).map(([name, size]) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: space.xl,
                paddingBlock: space.sm,
                borderBottom: `1px solid ${colors.divider}`,
              }}
            >
              <code
                style={{
                  fontFamily: fontFamily.mono,
                  fontSize: fontSize.xs,
                  color: colors.textTertiary,
                  width: 80,
                  flexShrink: 0,
                }}
              >
                {name} / {size}px
              </code>
              <span style={{ fontSize: size, lineHeight: lineHeight.snug }}>
                The quick brown fox
              </span>
            </div>
          ))}
        </Section>

        <Section title="Weights">
          {Object.entries(fontWeight).map(([name, weight]) => (
            <div key={name} style={{ fontSize: fontSize.lg, fontWeight: weight, paddingBlock: space.xs }}>
              {name} — {weight}
            </div>
          ))}
        </Section>

        <Section title="antd headings" description="Driven by the same tokens via ConfigProvider.">
          {([1, 2, 3, 4, 5] as const).map((level) => (
            <Typography.Title key={level} level={level}>
              Heading level {level}
            </Typography.Title>
          ))}
          <Typography.Paragraph>
            Body copy at {fontSize.md}px with a {lineHeight.normal} line height.
          </Typography.Paragraph>
          <Typography.Text code>const mono = &apos;JetBrains Mono&apos;;</Typography.Text>
        </Section>
      </>
    );
  },
};
