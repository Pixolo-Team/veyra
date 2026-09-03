import { useRef, useState } from 'react';
import { Input, Typography } from 'antd';
import type { InputRef } from 'antd';
import { FolderIcon } from '../icons';
import { useVeyraTokens } from '@veyra/design-system';

/**
 * Naming a node where it will live, rather than in a dialog — used to create a
 * folder and to rename a folder or a file, because the three are the same
 * interaction with a different starting value.
 *
 * Commits on Enter or blur, cancels on Escape or an empty name — the contract
 * every file explorer uses, so nobody has to learn it here.
 *
 * Both keys route through blur so there is exactly one commit path. Handling
 * Enter separately means Enter *and* the blur it causes both fire, and either
 * you create the folder twice or you add a latch that then has to be released
 * on failure.
 *
 * `NameEditor` is the field itself, with no opinion about where it sits: the
 * tree wraps it in an indented row (`InlineNameInput`), the file table drops it
 * straight into the name cell.
 */
export function NameEditor({
  busy,
  siblings,
  initialName = '',
  placeholder = 'Folder name',
  kind = 'folder',
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  /** Names already used at this level, for the duplicate check. Renaming passes
   *  the siblings *without* the node itself, so keeping its own name is fine. */
  siblings: string[];
  /** Pre-filled and selected when renaming; empty when creating. */
  initialName?: string;
  placeholder?: string;
  /** Only shapes the duplicate message — the check is the caller's list. */
  kind?: 'folder' | 'file';
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const cancelled = useRef(false);
  const inputRef = useRef<InputRef>(null);

  const trimmed = name.trim();
  // Case-insensitive, matching the server: "Stability" beside "stability" is a
  // mistake every time, not a distinction anyone means to draw.
  const duplicate =
    trimmed.length > 0 &&
    siblings.some((sibling) => sibling.toLowerCase() === trimmed.toLowerCase());

  const handleBlur = () => {
    if (cancelled.current) {
      onCancel();
      return;
    }
    // Unchanged is not an edit — closing the row is the whole of it, and a
    // no-op PATCH would still write an audit entry saying it was renamed.
    if (!trimmed || trimmed === initialName) {
      onCancel();
      return;
    }
    if (duplicate) {
      // Don't discard what they typed and don't create a clash — hold the row
      // open with the reason, and put the caret back so Escape still works.
      inputRef.current?.focus();
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <>
      <Input
        ref={inputRef}
        size="small"
        autoFocus
        disabled={busy}
        value={name}
        maxLength={200}
        status={duplicate ? 'error' : undefined}
        placeholder={placeholder}
        aria-invalid={duplicate}
        aria-label={placeholder}
        // Renaming starts with the old name selected, so typing replaces it the
        // way it does everywhere else; on an empty field this does nothing.
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setName(event.target.value)}
        onBlur={handleBlur}
        // The table row underneath opens the node when clicked; a click meant
        // for the caret must not navigate away from the field.
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            event.stopPropagation();
            cancelled.current = true;
            event.currentTarget.blur();
          }
        }}
      />
      {duplicate ? (
        <Typography.Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>
          There’s already a {kind} called “{trimmed}” here. Escape to cancel.
        </Typography.Text>
      ) : null}
    </>
  );
}

/** The editor as a tree row: same indentation and icon as the row it replaces. */
export function InlineNameInput({
  depth,
  indent,
  icon,
  ...editor
}: {
  depth: number;
  indent: number;
  /** Defaults to a folder; a rename shows the row's own icon instead. */
  icon?: React.ReactNode;
} & Parameters<typeof NameEditor>[0]) {
  const { colors, space } = useVeyraTokens();

  return (
    <div
      style={{
        paddingInlineStart: space.sm + depth * indent + 18,
        paddingInlineEnd: space.sm,
        paddingBlock: space.xxs,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <span style={{ color: colors.brand, flex: '0 0 auto', display: 'flex' }}>
          {icon ?? <FolderIcon />}
        </span>
        {/* The field and its duplicate note are siblings, so the note has to
            share the row's flow — hence the wrapper below rather than a
            fragment straight into the flex line. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <NameEditor {...editor} />
        </div>
      </div>
    </div>
  );
}
