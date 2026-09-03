import { Form, Input } from 'antd';
import { App } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Stack } from '@veyra/design-system';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { PasswordFields } from '../components/PasswordFields';
import { authApi } from '../lib/api/endpoints';
import { qk } from '../lib/queries';
import { useRequiredSession } from '../app/session';

type Values = { currentPassword: string; newPassword: string; confirmPassword: string };

/**
 * The forced first-login reset (D11). Reached only with a session, and the
 * router keeps sending the user back here until `mustResetPassword` clears.
 */
export function SetPassword() {
  const user = useRequiredSession();
  const [form] = Form.useForm<Values>();
  const watch = Form.useWatch<Values>([], form) ?? ({} as Values);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const save = useMutation({
    mutationFn: (values: Values) =>
      authApi.setPassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: async () => {
      // The server keeps this session and ends the others; refresh the flag.
      await queryClient.invalidateQueries({ queryKey: qk.session });
      message.success('Password set.');
      await navigate({ to: '/', replace: true });
    },
  });

  return (
    <AuthLayout
      title="Choose your password"
      subtitle={`You're signed in as ${user.email}. The password Veyra sent you is temporary — replace it before you go any further.`}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={save.mutate} disabled={save.isPending}>
        <Stack gap="lg">
          <ErrorAlert error={save.error} />
          <Form.Item
            name="currentPassword"
            label="Temporary password"
            rules={[{ required: true, message: 'Enter the password you signed in with.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.Password size="large" autoComplete="current-password" autoFocus />
          </Form.Item>
          <PasswordFields value={watch.newPassword ?? ''} confirmValue={watch.confirmPassword ?? ''} />
          <Button intent="primary" size="large" htmlType="submit" block loading={save.isPending}>
            Save and continue
          </Button>
        </Stack>
      </Form>
    </AuthLayout>
  );
}
