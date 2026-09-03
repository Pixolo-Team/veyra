import { useState } from 'react';
import { Input, Tooltip, Typography } from 'antd';
import { Button, useVeyraTokens } from '@veyra/design-system';
import { ChevronDownIcon } from '../icons';

/**
 * Page navigation for a continuously-scrolling document.
 *
 * The scroll is continuous on purpose — a CTD reviewer reads across a page
 * break constantly, and paging one sheet at a time would make a selection that
 * spans two pages impossible. So this reports where you are and takes you
 * somewhere, rather than being the only way to move.
 *
 * The box is a text field, not a stepper: "go to 148" is the actual task in a
 * 600-page report, and clicking next 147 times is not a way to do it.
 */
export function PageNav({
  page,
  pageCount,
  onJump,
}: {
  page: number;
  pageCount: number;
  onJump: (page: number) => void;
}) {
  const { colors, space } = useVeyraTokens();
  /*
   * The field follows the scroll, except while it is being typed in —
   * overwriting a half-typed "14" with the page that just scrolled past is
   * maddening. Derived rather than synced by an effect: `null` means "not being
   * edited", so the displayed value falls back to wherever the reader is.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(page);

  const go = (next: number) => {
    const clamped = Math.min(Math.max(1, next), pageCount);
    setDraft(null);
    onJump(clamped);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.xxs }}>
      <Tooltip title="Previous page">
        <Button
          intent="ghost"
          size="small"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
          icon={<ChevronDownIcon size={12} style={{ transform: 'rotate(180deg)' }} />}
        />
      </Tooltip>

      <Input
        size="small"
        value={shown}
        aria-label={`Page ${page} of ${pageCount}. Type a page number to jump.`}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => {
          const next = Number(draft);
          if (next) go(next);
          else setDraft(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
        // Four digits is a 600-page report's worst case and still fits;
        // wider than that was a field sized for numbers nobody types.
        style={{ width: 44, textAlign: 'center', paddingInline: 4 }}
      />

      <Typography.Text
        type="secondary"
        style={{
          fontSize: 12,
          color: colors.textTertiary,
          // The count belongs to the field, not to the next-page button.
          margin: `0 ${space.xs}px 0 ${space.xxs}px`,
          whiteSpace: 'nowrap',
        }}
      >
        / {pageCount}
      </Typography.Text>

      <Tooltip title="Next page">
        <Button
          intent="ghost"
          size="small"
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => go(page + 1)}
          icon={<ChevronDownIcon size={12} />}
        />
      </Tooltip>
    </div>
  );
}
