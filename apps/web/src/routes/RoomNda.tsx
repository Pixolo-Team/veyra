import { useState } from 'react';
import { Skeleton, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Button, Card, Stack, useVeyraTokens } from '@veyra/design-system';
import { ErrorAlert } from '../components/ErrorAlert';
import { NdaPanel } from '../components/NdaPanel';
import { PageBody, PageHeader } from '../components/Page';
import { PlainLayout } from '../components/PlainLayout';
import { roomsApi } from '../lib/api/endpoints';
import { qk, roomQuery } from '../lib/queries';

/*
 * `RoomDetail` carries `ndaRequired` but not `ndaVersion`, so both the tag and
 * the text fall back to v1 — the only version the server writes today. Add the
 * field to the contract before a v2 exists, or someone accepts text they
 * weren't shown.
 */
const NDA_VERSION = 'v1';

/**
 * The NDA gate. Every in-room route redirects here while `ndaPending` is true,
 * and it applies to the disclosing side as well — mvp-plan §9.4 settled that no
 * role is exempt, including the person who created the room.
 */
export function RoomNda() {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId/nda' });
  const { space } = useVeyraTokens();
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const room = useQuery(roomQuery(roomId));

  const accept = useMutation({
    mutationFn: () => roomsApi.acceptNda(roomId),
    onSuccess: async (updated) => {
      queryClient.setQueryData(qk.room(roomId), updated);
      await queryClient.invalidateQueries({ queryKey: qk.rooms });
      await navigate({ to: '/rooms/$roomId/overview', params: { roomId }, replace: true });
    },
  });

  if (room.isPending) {
    return (
      <PlainLayout>
        <PageBody maxWidth={640}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </PageBody>
      </PlainLayout>
    );
  }

  if (room.isError) {
    return (
      <PlainLayout>
        <PageBody maxWidth={640}>
          <ErrorAlert error={room.error} fallback="Could not open this room." />
        </PageBody>
      </PlainLayout>
    );
  }

  return (
    <PlainLayout>
      <PageHeader title="Non-disclosure agreement" tag={<Tag>{NDA_VERSION}</Tag>} />
      <PageBody maxWidth={640}>
        <Stack gap="lg">
          <ErrorAlert error={accept.error} fallback="Could not record your acceptance." />

          <Card bordered={false} elevation="sm">
            <NdaPanel
              showTitle={false}
              version={NDA_VERSION}
              accepted={accepted}
              onChange={setAccepted}
              disabled={accept.isPending}
            />
          </Card>

          <div style={{ display: 'flex', gap: space.sm }}>
            <Button
              intent="primary"
              size="large"
              disabled={!accepted}
              loading={accept.isPending}
              onClick={() => accept.mutate()}
            >
              Accept
            </Button>
            <Button
              intent="tertiary"
              size="large"
              disabled={accept.isPending}
              onClick={() => void navigate({ to: '/rooms' })}
            >
              Decline
            </Button>
          </div>
        </Stack>
      </PageBody>
    </PlainLayout>
  );
}
