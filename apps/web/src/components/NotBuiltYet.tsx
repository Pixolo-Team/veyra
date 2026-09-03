import { Empty, Typography } from 'antd';
import { PageBody, PageHeader } from './Page';

/**
 * Placeholder for a screen the scaffold has routed but we haven't built yet.
 * Deliberately blunt — an empty page that looks finished is worse than one that
 * says what it is.
 */
export function NotBuiltYet({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="Not built yet" />
      <PageBody>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary">
              {note ?? `${title} is routed and scaffolded — the screen itself is next.`}
            </Typography.Text>
          }
          style={{ padding: 64 }}
        />
      </PageBody>
    </>
  );
}
