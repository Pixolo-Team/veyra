import type { ReactNode } from 'react';
import { Tag, Typography } from 'antd';
import { useVeyraTokens } from '@veyra/design-system';
import { ROOM_STATUS_COLORS, ROOM_STATUS_LABELS, type RoomStatus } from '../lib/labels';

/** Page header shared by every in-room page: title, subtitle, page actions. */
export function PageHeader({
  title,
  subtitle,
  actions,
  tag,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tag?: ReactNode;
}) {
  const { colors, space } = useVeyraTokens();
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: space.lg,
        // Tighter than the body's own inset: this band is two lines of type
        // over a rule, and at 24px it took as much height as the first rows
        // of the thing it names.
        padding: `${space.md}px ${space['2xl']}px`,
        // Inside the page panel the title and the content share one white, so
        // the separation has to be drawn — there is no second ground to use.
        borderBottom: `1px solid ${colors.divider}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
          <Typography.Title level={4} style={{ margin: 0, lineHeight: 1.3 }}>
            {title}
          </Typography.Title>
          {tag}
        </div>
        {subtitle ? (
          <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.4 }}>
            {subtitle}
          </Typography.Text>
        ) : null}
      </div>
      {actions ? <div style={{ display: 'flex', gap: space.sm }}>{actions}</div> : null}
    </header>
  );
}

export function PageBody({
  children,
  maxWidth = 1120,
}: {
  children: ReactNode;
  /** `'none'` lets the page use the panel's full width — for tables, mostly. */
  maxWidth?: number | 'none';
}) {
  const { space } = useVeyraTokens();
  return (
    <div style={{ padding: space['2xl'] }}>
      <div style={{ maxWidth: maxWidth === 'none' ? undefined : maxWidth, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );
}

export function RoomStatusTag({ status }: { status: RoomStatus }) {
  return <Tag color={ROOM_STATUS_COLORS[status]}>{ROOM_STATUS_LABELS[status]}</Tag>;
}
