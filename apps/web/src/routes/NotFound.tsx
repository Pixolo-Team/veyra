import { Link } from '@tanstack/react-router';
import { Empty, Typography } from 'antd';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';

/**
 * The screen behind every URL the router doesn't recognise.
 *
 * Without one, TanStack Router falls back to a bare `<p>Not Found</p>` — two
 * words on white, which reads as a broken app rather than a wrong address. A
 * data-room link is often pasted out of an email months after it was sent, so
 * landing on one that no longer resolves is a normal event, and the screen for
 * it should say what happened and offer the way back.
 */
export function NotFound() {
  const { colors, space } = useVeyraTokens();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space.xl,
        background: colors.bgWash,
      }}
    >
      <Stack gap="md" style={{ alignItems: 'center', textAlign: 'center' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Stack gap="xs">
              <Typography.Title level={4} style={{ margin: 0 }}>
                This page doesn't exist
              </Typography.Title>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                The link may be out of date, or the room may no longer be shared with you.
              </Typography.Text>
            </Stack>
          }
        />
        <Link to="/">
          <Button intent="primary">Go to your rooms</Button>
        </Link>
      </Stack>
    </div>
  );
}
