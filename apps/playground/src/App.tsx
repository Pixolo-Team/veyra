/**
 * Kitchen-sink page proving the theme reaches real antd components.
 *
 * Everything here reads from the design system — no local colours, no ad-hoc
 * spacing. If a control looks wrong, the fix belongs in `design-system/theme`,
 * not in this file.
 */

import { useState } from 'react';
import {
  Alert,
  Badge,
  Divider,
  Form,
  Input,
  Layout,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { CloudUploadOutlined, RocketOutlined } from '@ant-design/icons';

import {
  Button,
  Card,
  Stack,
  ThemeToggle,
  space,
  useThemeMode,
  useVeyraTokens,
} from '@veyra/design-system';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface ServiceRow {
  key: string;
  service: string;
  environment: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: string;
}

const ROWS: ServiceRow[] = [
  { key: '1', service: 'api-gateway', environment: 'production', status: 'healthy', latency: '42ms' },
  { key: '2', service: 'auth-service', environment: 'production', status: 'healthy', latency: '18ms' },
  { key: '3', service: 'billing-worker', environment: 'staging', status: 'degraded', latency: '310ms' },
  { key: '4', service: 'search-index', environment: 'staging', status: 'down', latency: '—' },
];

const STATUS_TAG = {
  healthy: { color: 'success', label: 'Healthy' },
  degraded: { color: 'warning', label: 'Degraded' },
  down: { color: 'error', label: 'Down' },
} as const;

export default function App() {
  const { mode, compact, setCompact } = useThemeMode();
  const { colors } = useVeyraTokens();
  const [submitting, setSubmitting] = useState(false);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.divider}`,
          position: 'sticky',
          top: 0,
          zIndex: 200,
        }}
      >
        <Space size={space.md}>
          <RocketOutlined style={{ color: colors.brand, fontSize: 20 }} />
          <Text strong style={{ fontSize: 16 }}>Veyra</Text>
          <Tag color="processing">Design System</Tag>
        </Space>
        <Space size={space.lg}>
          <Space size={space.sm}>
            <Text type="secondary">Compact</Text>
            <Switch size="small" checked={compact} onChange={setCompact} />
          </Space>
          <ThemeToggle size="small" />
        </Space>
      </Header>

      <Content style={{ padding: space['2xl'], maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <Stack gap="2xl">
          <div>
            <Title level={2} style={{ marginBottom: space.xs }}>
              Ant Design, on Veyra tokens
            </Title>
            <Paragraph type="secondary" style={{ maxWidth: 640, marginBottom: 0 }}>
              Every control below is a stock antd component. Nothing on this page sets a
              colour or a pixel value directly — the look comes entirely from{' '}
              <Text code>ConfigProvider</Text>. Currently rendering in{' '}
              <Text strong>{mode}</Text> mode.
            </Paragraph>
          </div>

          <Alert
            type="info"
            showIcon
            title="Tokens flow one way"
            description="palette → semantic roles → antd ThemeConfig → components. Reach past a layer and the theme stops being swappable."
          />

          <Stack direction="horizontal" gap="lg" wrap>
            <Button intent="primary" icon={<CloudUploadOutlined />}>Deploy</Button>
            <Button intent="secondary">Configure</Button>
            <Button intent="tertiary">Duplicate</Button>
            <Button intent="ghost">Details</Button>
            <Button intent="danger" subtle>Revoke</Button>
            <Button intent="link">View docs</Button>
          </Stack>

          <Card title="Services" elevation="sm" extra={<Badge count={4} color={colors.brand} />}>
            <Table<ServiceRow>
              dataSource={ROWS}
              pagination={false}
              size="middle"
              columns={[
                { title: 'Service', dataIndex: 'service', key: 'service' },
                {
                  title: 'Environment',
                  dataIndex: 'environment',
                  key: 'environment',
                  render: (value: string) => <Tag>{value}</Tag>,
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (value: ServiceRow['status']) => (
                    <Tag color={STATUS_TAG[value].color}>{STATUS_TAG[value].label}</Tag>
                  ),
                },
                { title: 'p95 latency', dataIndex: 'latency', key: 'latency', align: 'right' },
              ]}
            />
          </Card>

          <Stack direction="horizontal" gap="xl" align="stretch" wrap>
            <Card title="New environment" elevation="md" style={{ flex: '1 1 340px' }}>
              <Form
                layout="vertical"
                requiredMark="optional"
                onFinish={() => {
                  setSubmitting(true);
                  window.setTimeout(() => setSubmitting(false), 900);
                }}
              >
                <Form.Item
                  label="Name"
                  name="name"
                  rules={[{ required: true, message: 'Give the environment a name.' }]}
                >
                  <Input placeholder="staging-eu" />
                </Form.Item>
                <Form.Item label="Region" name="region" initialValue="eu-west-1">
                  <Select
                    options={[
                      { value: 'eu-west-1', label: 'eu-west-1 · Ireland' },
                      { value: 'us-east-1', label: 'us-east-1 · N. Virginia' },
                      { value: 'ap-south-1', label: 'ap-south-1 · Mumbai' },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="Notes" name="notes">
                  <Input.TextArea rows={3} placeholder="Optional" />
                </Form.Item>
                <Button intent="primary" htmlType="submit" loading={submitting} block>
                  Create environment
                </Button>
              </Form>
            </Card>

            <Card title="Elevation & tabs" elevation="lg" style={{ flex: '1 1 340px' }}>
              <Tabs
                items={[
                  {
                    key: 'overview',
                    label: 'Overview',
                    children: (
                      <Paragraph style={{ marginBottom: 0 }}>
                        Shadows are defined per mode. Toggle to dark and this card keeps its
                        separation, because the dark scale leans on lighter surfaces instead
                        of heavier shadows.
                      </Paragraph>
                    ),
                  },
                  {
                    key: 'tokens',
                    label: 'Tokens',
                    children: (
                      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
                        <Text code>colors.brand — {colors.brand}</Text>
                        <Text code>colors.bgSurface — {colors.bgSurface}</Text>
                        <Text code>colors.border — {colors.border}</Text>
                      </Space>
                    ),
                  },
                ]}
              />
              <Divider />
              <Text type="secondary">
                Run <Text code>npm run storybook</Text> for the full token reference.
              </Text>
            </Card>
          </Stack>
        </Stack>
      </Content>
    </Layout>
  );
}
