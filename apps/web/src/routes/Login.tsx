import { Checkbox, Form, Input } from 'antd';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { authApi } from '../lib/api/endpoints';
import { qk } from '../lib/queries';
import { loginRoute } from '../app/router';

type Values = { email: string; password: string; rememberMe: boolean };

export function Login() {
  const { space } = useVeyraTokens();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ from: loginRoute.id });

  const login = useMutation({
    mutationFn: (values: Values) =>
      authApi.login({ email: values.email, password: values.password }),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(qk.session, user);
      // A one-time password is not a password (D11) — finish the reset first.
      if (user.mustResetPassword) {
        await navigate({ to: '/set-password', replace: true });
        return;
      }
      await navigate({ to: search.redirect ?? '/', replace: true });
    },
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Enter your email and password to access your account."
    >
      <Form<Values>
        layout="vertical"
        onFinish={login.mutate}
        requiredMark={false}
        disabled={login.isPending}
        initialValues={{ rememberMe: false }}
      >
        <Stack gap="lg">
          <ErrorAlert error={login.error} fallback="That email and password don’t match." />

          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, type: 'email', message: 'Enter the email you were invited on.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input size="large" autoComplete="username" autoFocus placeholder="you@company.com" />
          </Form.Item>

          <div>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Enter your password.' }]}
              style={{ marginBottom: 0 }}
            >
              <Input.Password size="large" autoComplete="current-password" />
            </Form.Item>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: space.md,
                marginTop: space.md,
              }}
            >
              {/* TODO(api): `POST /auth/login` takes only email + password, and
                  the session TTL is a server constant — so this doesn't extend
                  anything yet. Needs `rememberMe` on loginRequestSchema and a
                  longer TTL branch in AuthService. */}
              <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                <Checkbox>Remember me</Checkbox>
              </Form.Item>
              <Link to="/forgot-password" style={{ fontSize: 14, fontWeight: 500 }}>
                Forgot your password?
              </Link>
            </div>
          </div>

          <Button intent="primary" size="large" htmlType="submit" block loading={login.isPending}>
            Log in
          </Button>
        </Stack>
      </Form>
    </AuthLayout>
  );
}
