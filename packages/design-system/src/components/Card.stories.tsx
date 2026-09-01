import type { Meta, StoryObj } from '@storybook/react-vite';
import { Typography } from 'antd';

import { Button } from './Button';
import { Card } from './Card';
import { Stack } from './Stack';
import type { ElevationToken } from '../tokens';

const LEVELS: ElevationToken[] = ['none', 'sm', 'md', 'lg', 'xl'];

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    docs: {
      description: {
        component:
          'Adds a token-backed `elevation` prop to antd’s Card. Shadows are resolved per ' +
          'theme, so a raised card still reads as raised in dark mode.',
      },
    },
  },
  args: { title: 'Card title', elevation: 'sm', bordered: true },
  argTypes: {
    elevation: { control: 'select', options: LEVELS },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  args: { children: 'Cards group related content and actions.', style: { maxWidth: 360 } },
};

/** Switch the toolbar to dark to see the shadows re-tuned. */
export const Elevations: Story = {
  render: (args) => (
    <Stack direction="horizontal" gap="xl" wrap>
      {LEVELS.map((level) => (
        <Card key={level} {...args} title={`elevation="${level}"`} style={{ width: 220 }}>
          <Typography.Text type="secondary">Surface at {level}.</Typography.Text>
        </Card>
      ))}
    </Stack>
  ),
};

export const WithActions: Story = {
  render: (args) => (
    <Card
      {...args}
      title="Deployment"
      elevation="md"
      style={{ maxWidth: 420 }}
      extra={<Button intent="link">Logs</Button>}
      actions={[
        <Button key="rollback" intent="ghost">Rollback</Button>,
        <Button key="promote" intent="primary">Promote</Button>,
      ]}
    >
      <Typography.Paragraph style={{ marginBottom: 0 }}>
        Build <Typography.Text code>a91f3c2</Typography.Text> finished 4 minutes ago.
      </Typography.Paragraph>
    </Card>
  ),
};

/** No outline — elevation alone separates the card from the canvas. */
export const Borderless: Story = {
  args: {
    bordered: false,
    elevation: 'lg',
    children: 'Separated by shadow rather than by a line.',
    style: { maxWidth: 360 },
  },
};
