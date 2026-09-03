import { Checkbox, Tag, Typography } from 'antd';
import { Stack, useVeyraTokens } from '@veyra/design-system';
import { ndaText } from '../content/nda';

/**
 * The NDA click-through. The text scrolls in its own box rather than in the
 * page, so the checkbox stays visible and it's obvious how much is left to read
 * (FR-ONB-08a). Acceptance records the timestamp and the version, not a
 * signature — that decision is mvp-plan §2.
 */
export function NdaPanel({
  version,
  accepted,
  onChange,
  disabled,
  /** Off where the page title already names the document. @default true */
  showTitle = true,
}: {
  version: string | null;
  accepted: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  showTitle?: boolean;
}) {
  const { colors, space } = useVeyraTokens();
  const text = ndaText(version);

  return (
    <Stack gap="md">
      {showTitle ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space.sm,
          }}
        >
          <Typography.Text strong>{text.title}</Typography.Text>
          <Tag>{version ?? 'v1'}</Tag>
        </div>
      ) : null}

      <div
        tabIndex={0}
        aria-label={`${text.title}, ${version ?? 'v1'}`}
        style={{
          maxHeight: 220,
          overflowY: 'auto',
          padding: space.lg,
          background: colors.bgCanvas,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.7,
          color: colors.textSecondary,
        }}
      >
        {text.paragraphs.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} style={{ margin: `0 0 ${space.md}px` }}>
            {paragraph}
          </p>
        ))}
      </div>

      <Checkbox
        checked={accepted}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      >
        I have read and agree to the terms of this agreement.
      </Checkbox>

      {/* The activity-recording disclosure is required before anyone reads a
          document — mvp-plan FR-ONB-08a and D9. */}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Your activity in this room is recorded: the disclosing party can see which documents you
        open and when.
      </Typography.Text>
    </Stack>
  );
}
