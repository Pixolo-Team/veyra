import type { Meta, StoryObj } from '@storybook/react-vite';

import { Stack } from './Stack';
import { Button } from './Button';
import { fontSize, space, type SpaceToken } from '../tokens';
import { useVeyraTokens } from '../theme';

const meta = {
  title: 'Components/Stack',
  component: Stack,
  parameters: {
    docs: {
      description: {
        component:
          'A thin wrapper over antd’s `Flex` that accepts only spacing-token names for `gap`. ' +
          'Arbitrary pixel gaps are the usual way a 4px grid erodes, so they are not accepted.',
      },
    },
  },
  args: { direction: 'vertical', gap: 'md' },
  argTypes: {
    direction: { control: 'radio', options: ['vertical', 'horizontal'] },
    gap: { control: 'select', options: Object.keys(space) as SpaceToken[] },
  },
} satisfies Meta<typeof Stack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <Stack {...args}>
      <Button intent="primary">First</Button>
      <Button>Second</Button>
      <Button intent="ghost">Third</Button>
    </Stack>
  ),
};

export const GapScale: Story = {
  render: function GapScaleStory() {
    const { colors } = useVeyraTokens();
    return (
      <Stack gap="xl">
        {(['xs', 'sm', 'md', 'lg', 'xl', '2xl'] as SpaceToken[]).map((gap) => (
          <Stack key={gap} direction="horizontal" gap={gap} align="center">
            {/* A token colour rather than `opacity`, which would dim the label below AA. */}
            <code style={{ width: 72, fontSize: fontSize.xs, color: colors.textTertiary }}>
              {gap}
            </code>
            <Button intent="tertiary">A</Button>
            <Button intent="tertiary">B</Button>
            <Button intent="tertiary">C</Button>
          </Stack>
        ))}
      </Stack>
    );
  },
};
