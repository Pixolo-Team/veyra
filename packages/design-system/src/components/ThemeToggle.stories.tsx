import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from 'antd';

import { ThemeToggle } from './ThemeToggle';
import { Card } from './Card';
import { Stack } from './Stack';
import { useThemeMode } from '../theme';

const meta = {
  title: 'Components/ThemeToggle',
  component: ThemeToggle,
  parameters: {
    docs: {
      description: {
        component:
          'Three-way switcher: light, dark, or follow the OS. A two-state toggle cannot ' +
          'express “follow the OS”, so picking either value would silently opt the user ' +
          'out of system sync permanently.\n\n' +
          'Inside Storybook the provider runs with `persist={false}` and the toolbar owns ' +
          'the mode, so this control demonstrates the API without driving the canvas.',
      },
    },
  },
  args: { iconOnly: false, size: 'middle' },
} satisfies Meta<typeof ThemeToggle>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const { mode, preference } = useThemeMode();
    return (
      <Stack gap="lg" align="flex-start">
        <ThemeToggle {...args} />
        <Card title="Resolved state" elevation="sm" style={{ minWidth: 280 }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            preference: <Typography.Text code>{preference}</Typography.Text>
            <br />
            rendering: <Typography.Text code>{mode}</Typography.Text>
          </Typography.Paragraph>
        </Card>
      </Stack>
    );
  },
};

export const IconOnly: Story = { args: { iconOnly: true } };

export const Sizes: Story = {
  render: (args) => (
    <Stack gap="md" align="flex-start">
      <ThemeToggle {...args} size="small" />
      <ThemeToggle {...args} size="middle" />
      <ThemeToggle {...args} size="large" />
    </Stack>
  ),
};
