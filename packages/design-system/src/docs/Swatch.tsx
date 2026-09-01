/**
 * Small presentational helpers shared by the Foundations stories.
 * Not exported from the design system — these exist to document it.
 */

import type { ReactNode } from 'react';
import { Typography } from 'antd';

import { fontFamily, fontSize, radius, space } from '../tokens';
import { useVeyraTokens } from '../theme';

const { Text } = Typography;

export function Section({ title, description, children }: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const { colors } = useVeyraTokens();
  return (
    <section style={{ marginBottom: space['3xl'] }}>
      <Typography.Title level={4} style={{ marginBottom: description ? space.xs : space.lg }}>
        {title}
      </Typography.Title>
      {description && (
        <Text style={{ display: 'block', marginBottom: space.lg, color: colors.textSecondary }}>
          {description}
        </Text>
      )}
      {children}
    </section>
  );
}

export function Swatch({ name, value, note }: { name: string; value: string; note?: string }) {
  const { colors } = useVeyraTokens();
  return (
    <div style={{ width: 168 }}>
      <div
        style={{
          height: 56,
          borderRadius: radius.md,
          background: value,
          border: `1px solid ${colors.border}`,
          marginBottom: space.sm,
        }}
      />
      <Text strong style={{ display: 'block', fontSize: fontSize.sm }}>{name}</Text>
      <Text
        style={{ fontFamily: fontFamily.mono, fontSize: fontSize.xs, color: colors.textTertiary }}
      >
        {value}
      </Text>
      {note && (
        <Text style={{ display: 'block', fontSize: fontSize.xs, color: colors.textTertiary }}>
          {note}
        </Text>
      )}
    </div>
  );
}

export function Grid({ children, min = 168 }: { children: ReactNode; min?: number }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        gap: space.lg,
      }}
    >
      {children}
    </div>
  );
}
