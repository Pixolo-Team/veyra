import type { ReactNode } from 'react';
import { Form, Input, Typography } from 'antd';
import { CheckCircleIcon } from './icons';
import { Stack, useVeyraTokens } from '@veyra/design-system';

export const MIN_PASSWORD_LENGTH = 12;

function Rule({ met, children }: { met: boolean; children: ReactNode }) {
  const { colors } = useVeyraTokens();
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
      <CheckCircleIcon style={{ color: met ? colors.success : colors.textDisabled }} />
      <span style={{ color: met ? colors.textSecondary : colors.textTertiary }}>{children}</span>
    </span>
  );
}

/**
 * New password + confirmation, with the rules shown as they're met rather than
 * as an error after submitting. The 12-character floor mirrors the server's
 * schema — the client just says so earlier.
 */
export function PasswordFields({
  name = 'newPassword',
  confirmName = 'confirmPassword',
  label = 'New password',
  value,
  confirmValue,
  autoFocus,
}: {
  name?: string;
  confirmName?: string;
  label?: string;
  value: string;
  confirmValue: string;
  autoFocus?: boolean;
}) {
  const longEnough = value.length >= MIN_PASSWORD_LENGTH;
  const matches = value.length > 0 && value === confirmValue;

  return (
    <Stack gap="lg">
      <Form.Item
        name={name}
        label={label}
        rules={[
          { required: true, message: 'Choose a password.' },
          { min: MIN_PASSWORD_LENGTH, message: `At least ${MIN_PASSWORD_LENGTH} characters.` },
        ]}
        style={{ marginBottom: 0 }}
      >
        <Input.Password size="large" autoComplete="new-password" autoFocus={autoFocus} />
      </Form.Item>
      <Form.Item
        name={confirmName}
        label="Confirm"
        dependencies={[name]}
        rules={[
          { required: true, message: 'Type it once more.' },
          ({ getFieldValue }) => ({
            validator: (_, v) =>
              !v || getFieldValue(name) === v
                ? Promise.resolve()
                : Promise.reject(new Error('The two passwords don’t match.')),
          }),
        ]}
        style={{ marginBottom: 0 }}
      >
        <Input.Password size="large" autoComplete="new-password" />
      </Form.Item>
      <Stack gap="xs">
        <Rule met={longEnough}>At least {MIN_PASSWORD_LENGTH} characters</Rule>
        <Rule met={matches}>Both entries match</Rule>
      </Stack>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        Signing in elsewhere? Setting this password ends every other session on your account.
      </Typography.Text>
    </Stack>
  );
}
