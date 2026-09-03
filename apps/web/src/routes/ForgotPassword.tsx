import { Form, Input, Result, Typography } from 'antd';
import { Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Button, Stack } from '@veyra/design-system';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { authApi } from '../lib/api/endpoints';

export function ForgotPassword() {
  const request = useMutation({
    mutationFn: (values: { email: string }) => authApi.requestPasswordReset(values.email),
  });

  if (request.isSuccess) {
    return (
      <AuthLayout title="Check your email">
        <Result
          status="success"
          style={{ padding: 0 }}
          subTitle="If that address has a Veyra account, a reset link is on its way. The link is good for 15 minutes."
          extra={
            <Link to="/login">
              <Button intent="secondary">Back to log in</Button>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link. It expires in 15 minutes."
      footer={
        <Typography.Text type="secondary">
          Remembered it? <Link to="/login">Log in</Link>
        </Typography.Text>
      }
    >
      <Form layout="vertical" requiredMark={false} onFinish={request.mutate} disabled={request.isPending}>
        <Stack gap="lg">
          <ErrorAlert error={request.error} />
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Enter your email address.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="large" autoComplete="username" autoFocus placeholder="you@company.com" />
          </Form.Item>
          <Button intent="primary" size="large" htmlType="submit" block loading={request.isPending}>
            Send reset link
          </Button>
        </Stack>
      </Form>
    </AuthLayout>
  );
}
