import { useState } from 'react';
import { Descriptions, Form, Input, Result, Skeleton, Typography } from 'antd';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Stack } from '@veyra/design-system';
import { AuthLayout } from '../components/AuthLayout';
import { ErrorAlert } from '../components/ErrorAlert';
import { NdaPanel } from '../components/NdaPanel';
import { PasswordFields } from '../components/PasswordFields';
import { invitationsApi } from '../lib/api/endpoints';
import { invitationPreviewQuery, qk } from '../lib/queries';
import { acceptInviteRoute } from '../app/router';
import { ROLE_LABELS } from '../lib/labels';

type Values = { name?: string; newPassword?: string; confirmPassword?: string };

/**
 * Invite acceptance: preview → (set a password, if the account is new) → NDA
 * click-through → signed in and in the room. One screen, because splitting it
 * is three loads to accomplish one decision.
 */
export function AcceptInvite() {
  const { token } = useParams({ from: acceptInviteRoute.id });
  const [form] = Form.useForm<Values>();
  const watch = Form.useWatch<Values>([], form) ?? ({} as Values);
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const preview = useQuery(invitationPreviewQuery(token));

  const accept = useMutation({
    mutationFn: (values: Values) =>
      invitationsApi.accept({
        token,
        name: values.name?.trim() || undefined,
        password: preview.data?.isNewUser ? values.newPassword : undefined,
        ndaAccepted: preview.data?.ndaRequired ? ndaAccepted : undefined,
      }),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(qk.session, user);
      await queryClient.invalidateQueries({ queryKey: qk.rooms });
      await navigate({ to: '/', replace: true });
    },
  });

  if (preview.isPending) {
    return (
      <AuthLayout title="Opening your invitation" width={540}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </AuthLayout>
    );
  }

  if (preview.isError) {
    return (
      <AuthLayout title="This invitation isn’t valid" width={540}>
        <Result
          status="warning"
          style={{ padding: 0 }}
          subTitle="It may have expired, been revoked, or already been used. Ask whoever invited you to send another."
          extra={
            <Link to="/login">
              <Button intent="secondary">Go to log in</Button>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  const invite = preview.data;

  if (invite.status !== 'pending') {
    const copy =
      invite.status === 'accepted'
        ? 'This invitation has already been accepted. Log in to open the room.'
        : invite.status === 'expired'
          ? 'This invitation expired. Ask whoever invited you to send another.'
          : 'This invitation was revoked.';
    return (
      <AuthLayout title="Nothing to accept here" width={540}>
        <Result
          status="info"
          style={{ padding: 0 }}
          subTitle={copy}
          extra={
            <Link to="/login">
              <Button intent="primary">Go to log in</Button>
            </Link>
          }
        />
      </AuthLayout>
    );
  }

  const canSubmit = !invite.ndaRequired || ndaAccepted;

  return (
    <AuthLayout
      title={`You've been invited to ${invite.roomName}`}
      subtitle={
        invite.inviterName
          ? `${invite.inviterName}${invite.discloserCompanyName ? ` at ${invite.discloserCompanyName}` : ''} invited you to review this dossier.`
          : 'You have been invited to review this dossier.'
      }
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={accept.mutate} disabled={accept.isPending}>
        <Stack gap="xl">
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              { key: 'email', label: 'Your email', children: invite.email },
              { key: 'role', label: 'Access level', children: ROLE_LABELS[invite.role] },
              {
                key: 'side',
                label: 'Acting as',
                children: invite.side === 'discloser' ? 'Disclosing party' : 'Receiving party',
              },
            ]}
          />

          <ErrorAlert error={accept.error} />

          {invite.isNewUser ? (
            <Stack gap="lg">
              <Form.Item
                name="name"
                label="Your name"
                extra="Shown beside your comments and in the room's activity log."
                rules={[{ required: true, message: 'Tell the other side who you are.' }]}
                style={{ marginBottom: 0 }}
              >
                <Input size="large" autoComplete="name" autoFocus placeholder="Priya Raman" />
              </Form.Item>
              <PasswordFields
                label="Choose a password"
                value={watch.newPassword ?? ''}
                confirmValue={watch.confirmPassword ?? ''}
              />
            </Stack>
          ) : (
            <Typography.Text type="secondary">
              You already have a Veyra account on this address — accepting adds this room to it.
            </Typography.Text>
          )}

          {invite.ndaRequired ? (
            <NdaPanel
              version={invite.ndaVersion}
              accepted={ndaAccepted}
              onChange={setNdaAccepted}
              disabled={accept.isPending}
            />
          ) : null}

          <Button
            intent="primary"
            size="large"
            htmlType="submit"
            block
            disabled={!canSubmit}
            loading={accept.isPending}
          >
            {invite.ndaRequired ? 'Accept and open the room' : 'Open the room'}
          </Button>
        </Stack>
      </Form>
    </AuthLayout>
  );
}
