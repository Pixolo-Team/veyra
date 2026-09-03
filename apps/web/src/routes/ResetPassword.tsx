import { Form, Result, Typography } from 'antd';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Button, Stack } from '@veyra/design-system';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { PasswordFields } from '../components/PasswordFields';
import { authApi } from '../lib/api/endpoints';
import { resetPasswordRoute } from '../app/router';

type Values = { newPassword: string; confirmPassword: string };

export function ResetPassword() {
  const { token } = useSearch({ from: resetPasswordRoute.id });
  const [form] = Form.useForm<Values>();
  const watch = Form.useWatch<Values>([], form) ?? ({} as Values);
  const navigate = useNavigate();

  const confirm = useMutation({
    mutationFn: (values: Values) =>
      authApi.confirmPasswordReset({ token: token ?? '', newPassword: values.newPassword }),
  });

  if (!token) {
    return (
      <AuthLayout title="This link is incomplete">
        <Result
          status="warning"
          style={{ padding: 0 }}
          subTitle="Open the reset link straight from the email — the token in the address is what proves it's you."
          extra={
            <Link to="/forgot-password">
              <Button intent="primary">Request a new link</Button>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  if (confirm.isSuccess) {
    return (
      <AuthLayout title="Password changed">
        <Result
          status="success"
          style={{ padding: 0 }}
          subTitle="Every other session on your account has been signed out."
          extra={
            <Button intent="primary" onClick={() => void navigate({ to: '/login', replace: true })}>
              Log in
            </Button>
          }
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      footer={
        <Typography.Text type="secondary">
          Link expired? <Link to="/forgot-password">Request another</Link>
        </Typography.Text>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={confirm.mutate} disabled={confirm.isPending}>
        <Stack gap="lg">
          <ErrorAlert error={confirm.error} fallback="That reset link has expired or has already been used." />
          <PasswordFields value={watch.newPassword ?? ''} confirmValue={watch.confirmPassword ?? ''} autoFocus />
          <Button intent="primary" size="large" htmlType="submit" block loading={confirm.isPending}>
            Save password
          </Button>
        </Stack>
      </Form>
    </AuthLayout>
  );
}
