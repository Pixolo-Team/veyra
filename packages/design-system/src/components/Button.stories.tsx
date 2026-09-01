import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeleteOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';

import { Button, type ButtonIntent } from './Button';
import { Stack } from './Stack';

const INTENTS: ButtonIntent[] = ['primary', 'secondary', 'tertiary', 'ghost', 'danger', 'link'];

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component:
          'Wraps antd’s Button behind a semantic `intent` prop. antd v6 can spell the same ' +
          'look several ways via `type`/`color`/`variant`/`danger`; `intent` names the job ' +
          'instead, so one intent always resolves to one appearance.',
      },
    },
  },
  args: { children: 'Button', intent: 'secondary' },
  argTypes: {
    intent: { control: 'select', options: INTENTS },
    size: { control: 'radio', options: ['small', 'middle', 'large'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** All six intents side by side. */
export const Intents: Story = {
  render: (args) => (
    <Stack direction="horizontal" gap="md" wrap>
      {INTENTS.map((intent) => (
        <Button key={intent} {...args} intent={intent}>
          {intent}
        </Button>
      ))}
    </Stack>
  ),
};

/** `subtle` swaps the solid fill for an outline on the two coloured intents. */
export const Subtle: Story = {
  render: (args) => (
    <Stack direction="horizontal" gap="md">
      <Button {...args} intent="primary">Primary</Button>
      <Button {...args} intent="primary" subtle>Primary subtle</Button>
      <Button {...args} intent="danger">Danger</Button>
      <Button {...args} intent="danger" subtle>Danger subtle</Button>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <Stack direction="horizontal" gap="md" align="center">
      <Button {...args} intent="primary" size="small">Small</Button>
      <Button {...args} intent="primary" size="middle">Middle</Button>
      <Button {...args} intent="primary" size="large">Large</Button>
    </Stack>
  ),
};

export const WithIcons: Story = {
  render: ({ children: _children, ...args }) => (
    <Stack direction="horizontal" gap="md" wrap>
      <Button {...args} intent="primary" icon={<PlusOutlined />}>New project</Button>
      <Button {...args} intent="secondary" icon={<DownloadOutlined />}>Export</Button>
      <Button {...args} intent="danger" icon={<DeleteOutlined />}>Delete</Button>
      <Button {...args} intent="ghost" icon={<PlusOutlined />} aria-label="Add" />
    </Stack>
  ),
};

export const States: Story = {
  render: (args) => (
    <Stack gap="md">
      <Stack direction="horizontal" gap="md">
        {INTENTS.map((intent) => (
          <Button key={intent} {...args} intent={intent} disabled>{intent}</Button>
        ))}
      </Stack>
      <Stack direction="horizontal" gap="md">
        {INTENTS.map((intent) => (
          <Button key={intent} {...args} intent={intent} loading>{intent}</Button>
        ))}
      </Stack>
    </Stack>
  ),
};
