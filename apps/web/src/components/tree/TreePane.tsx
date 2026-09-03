import { Fragment, useState } from 'react';
import { Input, Popover, Tooltip, Typography } from 'antd';
import type { DocumentDto, FolderNode, ModuleTree } from '@veyra/contracts';
import { Button, useVeyraTokens } from '@veyra/design-system';
import { allNodeIds, countDocuments, moduleLabel } from '../../lib/tree';
import { InlineNameInput } from './InlineNameInput';
import { FileTypeIcon } from '../FileTypeIcon';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CollapseAllIcon,
  DeleteIcon,
  ExpandAllIcon,
  FolderIcon,
  FolderOpenIcon,
  MoreIcon,
  NewFileIcon,
  NewFolderIcon,
  PlusIcon,
  RenameIcon,
  SearchIcon,
} from '../icons';

const INDENT = 14;

/** The row a menu verb was chosen on — enough to act on it without a lookup. */
export interface RowTarget {
  id: string;
  kind: 'folder' | 'document';
  name: string;
}

/**
 * The modules as a segregated collapsible stack — each module is its own block
 * with its own header, not a row in one long list.
 *
 * A CTD dossier is five separate submissions that happen to travel together;
 * running them into a continuous tree makes Module 3's fourth level look like a
 * sibling of Module 4. The blocks keep that boundary visible even when several
 * are open at once.
 */
export function TreePane({
  modules,
  selectedId,
  openDocumentId,
  expanded,
  onSelect,
  onToggle,
  onCollapseAll,
  onExpandAll,
  onNewFolder,
  onNewFile,
  onOpenDocument,
  creatingAt,
  creating,
  onCreateSubmit,
  onCreateCancel,
  renamingId,
  renaming,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
  query,
  onQueryChange,
}: {
  modules: ModuleTree[];
  selectedId: string | undefined;
  /** The document open in the reader — a selection the tree has to show too. */
  openDocumentId?: string;
  expanded: ReadonlySet<string>;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onNewFolder: (nodeId: string) => void;
  onNewFile: (nodeId: string) => void;
  /** Opens a document in the reader. */
  onOpenDocument: (documentId: string) => void;
  /** Node whose children currently show a naming row, if any. */
  creatingAt: string | null;
  creating: boolean;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
  /** Row currently being renamed in place, if any. */
  renamingId: string | null;
  renaming: boolean;
  onRename: (target: RowTarget) => void;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  /** Deleting is confirmed by the caller — the tree only names the row. */
  onDelete: (target: RowTarget) => void;
  /** Filters the tree by name — `modules` arrives already pruned to matches. */
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { colors, space } = useVeyraTokens();
  // Expandable nodes, not just modules — "expand all" that leaves folders shut
  // is not all.
  const everyNode = allNodeIds(modules);
  const openCount = everyNode.filter((id) => expanded.has(id)).length;

  return (
    // The pane scrolls itself rather than taking the page with it: the header
    // and the two panes stay put, and only the list of modules moves.
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${space.sm}px ${space.md}px`,
        }}
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
        >
          Modules
        </Typography.Text>
        {/* Icon-only: both stay available, and the rail keeps its width for
            folder names. The tooltip carries the label an icon can't. */}
        <div style={{ display: 'flex', gap: space.xxs }}>
          <Tooltip title="Expand all">
            <Button
              intent="ghost"
              size="small"
              aria-label="Expand all"
              icon={<ExpandAllIcon />}
              disabled={openCount === everyNode.length}
              onClick={onExpandAll}
            />
          </Tooltip>
          <Tooltip title="Collapse all">
            <Button
              intent="ghost"
              size="small"
              aria-label="Collapse all"
              icon={<CollapseAllIcon />}
              disabled={openCount === 0}
              onClick={onCollapseAll}
            />
          </Tooltip>
        </div>
      </div>

      <div style={{ flex: '0 0 auto', padding: `0 ${space.md}px ${space.sm}px` }}>
        <Input
          allowClear
          size="small"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter this dossier"
          aria-label="Filter this dossier by name"
          prefix={
            <SearchIcon size={14} style={{ color: colors.textTertiary, marginInlineEnd: 4 }} />
          }
          style={{ borderRadius: 8, borderColor: colors.divider }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      {query.trim() && modules.length === 0 ? (
        <Typography.Text
          type="secondary"
          style={{
            display: 'block',
            fontSize: 12,
            padding: `${space.lg}px ${space.md}px`,
            textAlign: 'center',
          }}
        >
          Nothing here matches “{query.trim()}”.
        </Typography.Text>
      ) : null}
      {modules.map((module) => {
        const open = expanded.has(module.id);
        const total = countDocuments(module);
        const selected = selectedId === module.id;

        return (
          <section
            key={module.id}
            /*
             * An open module is grouped by its own ground rather than fenced
             * off by a rule. `bgWash` and not a neutral tint on purpose: the
             * canvas outside this panel is grey, so a grey fill in here reads
             * as the page showing through rather than as a group.
             */
            style={{ background: open ? colors.bgWash : 'transparent' }}
          >
            <div
              className="veyra-tree-row"
              style={{
                position: 'sticky',
                top: 0,
                // Above the rows it scrolls over, and opaque — a sticky header
                // that lets content through reads as a rendering bug.
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: space.xs,
                paddingInline: space.sm,
                background: selected ? colors.brandSubtle : colors.bgSurface,
                // The same accent every selected row carries, so a module reads
                // as selected by the same mark as the folder three levels down.
                boxShadow: selected ? `inset 3px 0 0 ${colors.brand}` : 'none',
              }}
            >
              <Chevron
                open={open}
                label={moduleLabel(module)}
                onClick={() => onToggle(module.id)}
              />
              <button
                type="button"
                onClick={() => onSelect(module.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'block',
                  padding: `${space.sm}px 0`,
                  background: 'none',
                  border: 'none',
                  textAlign: 'start',
                  cursor: 'pointer',
                }}
              >
                <Typography.Paragraph
                  ellipsis={{ tooltip: moduleLabel(module) }}
                  style={{
                    margin: 0,
                    fontSize: 13,
                    fontWeight: 600,
                    color: selected ? colors.brand : colors.textPrimary,
                  }}
                >
                  {moduleLabel(module)}
                </Typography.Paragraph>
              </button>
              {/* A module is the dossier's structure, not the reader's — its
                  name comes from the CTD template, so there is no rename here. */}
              <AddMenu
                label={moduleLabel(module)}
                onNewFolder={() => onNewFolder(module.id)}
                onNewFile={() => onNewFile(module.id)}
              />
              <Count value={total} />
            </div>

            {open ? (
              <div style={{ padding: `${space.xs}px 0 ${space.sm}px`, background: colors.bgCanvas }}>
                {creatingAt === module.id ? (
                  <InlineNameInput
                    depth={1}
                    indent={INDENT}
                    busy={creating}
                    siblings={module.folders.map((folder) => folder.name)}
                    onSubmit={onCreateSubmit}
                    onCancel={onCreateCancel}
                  />
                ) : null}
                {module.folders.length + module.documents.length === 0 ? (
                  creatingAt === module.id ? null : (
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, display: 'block', paddingInlineStart: space.xl + INDENT, paddingBlock: space.xs }}
                    >
                      Nothing in this module yet.
                    </Typography.Text>
                  )
                ) : (
                  <Branch
                    folders={module.folders}
                    documents={module.documents}
                    depth={1}
                    selectedId={selectedId}
                    openDocumentId={openDocumentId}
                    expanded={expanded}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    onNewFolder={onNewFolder}
                    onNewFile={onNewFile}
                    onOpenDocument={onOpenDocument}
                    creatingAt={creatingAt}
                    creating={creating}
                    onCreateSubmit={onCreateSubmit}
                    onCreateCancel={onCreateCancel}
                    renamingId={renamingId}
                    renaming={renaming}
                    onRename={onRename}
                    onRenameSubmit={onRenameSubmit}
                    onRenameCancel={onRenameCancel}
                    onDelete={onDelete}
                  />
                )}
              </div>
            ) : null}
          </section>
        );
      })}
      </div>
    </div>
  );
}

function Branch({
  folders,
  documents,
  depth,
  selectedId,
  openDocumentId,
  expanded,
  onSelect,
  onToggle,
  onNewFolder,
  onNewFile,
  onOpenDocument,
  creatingAt,
  creating,
  onCreateSubmit,
  onCreateCancel,
  renamingId,
  renaming,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: {
  folders: FolderNode[];
  documents: DocumentDto[];
  depth: number;
  selectedId: string | undefined;
  openDocumentId?: string;
  expanded: ReadonlySet<string>;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
  onNewFolder: (nodeId: string) => void;
  onNewFile: (nodeId: string) => void;
  onOpenDocument: (documentId: string) => void;
  creatingAt: string | null;
  creating: boolean;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
  renamingId: string | null;
  renaming: boolean;
  onRename: (target: RowTarget) => void;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  onDelete: (target: RowTarget) => void;
}) {
  return (
    <>
      {folders.map((folder) => {
        const open = expanded.has(folder.id);
        return (
          <Fragment key={folder.id}>
            {renamingId === folder.id ? (
              /* The row becomes its own editor, at its own indentation — a
                 rename that opens somewhere else makes you find the thing you
                 were already pointing at. */
              <InlineNameInput
                depth={depth}
                indent={INDENT}
                busy={renaming}
                initialName={folder.name}
                placeholder="Folder name"
                icon={open ? <FolderOpenIcon /> : <FolderIcon />}
                siblings={folders
                  .filter((sibling) => sibling.id !== folder.id)
                  .map((sibling) => sibling.name)}
                onSubmit={onRenameSubmit}
                onCancel={onRenameCancel}
              />
            ) : (
              <Row
                label={folder.name}
                depth={depth}
                count={countDocuments(folder)}
                hasChildren={folder.folders.length + folder.documents.length > 0}
                open={open}
                selected={selectedId === folder.id}
                icon={open ? <FolderOpenIcon /> : <FolderIcon />}
                onSelect={() => onSelect(folder.id)}
                onToggle={() => onToggle(folder.id)}
                onNewFolder={() => onNewFolder(folder.id)}
                onNewFile={() => onNewFile(folder.id)}
                onRename={() => onRename({ id: folder.id, kind: 'folder', name: folder.name })}
                onDelete={() => onDelete({ id: folder.id, kind: 'folder', name: folder.name })}
              />
            )}
            {creatingAt === folder.id ? (
              <InlineNameInput
                depth={depth + 1}
                indent={INDENT}
                busy={creating}
                siblings={folder.folders.map((child) => child.name)}
                onSubmit={onCreateSubmit}
                onCancel={onCreateCancel}
              />
            ) : null}
            {open ? (
              <Branch
                folders={folder.folders}
                documents={folder.documents}
                depth={depth + 1}
                selectedId={selectedId}
                openDocumentId={openDocumentId}
                expanded={expanded}
                onSelect={onSelect}
                onToggle={onToggle}
                onNewFolder={onNewFolder}
                onNewFile={onNewFile}
                onOpenDocument={onOpenDocument}
                creatingAt={creatingAt}
                creating={creating}
                onCreateSubmit={onCreateSubmit}
                onCreateCancel={onCreateCancel}
                renamingId={renamingId}
                renaming={renaming}
                onRename={onRename}
                onRenameSubmit={onRenameSubmit}
                onRenameCancel={onRenameCancel}
                onDelete={onDelete}
              />
            ) : null}
          </Fragment>
        );
      })}
      {documents.map((doc) =>
        renamingId === doc.id ? (
          <InlineNameInput
            key={doc.id}
            depth={depth}
            indent={INDENT}
            busy={renaming}
            initialName={doc.name}
            placeholder="File name"
            kind="file"
            icon={<FileTypeIcon name={doc.name} mimeType={doc.currentVersion?.mimeType} />}
            // Two files with the same name in one folder are legal — versions
            // are the server's answer to "the same document again", and a
            // duplicate name is a smell, not a clash. So: nothing to block on.
            siblings={[]}
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
          />
        ) : (
          <Row
            key={doc.id}
            label={doc.name}
            depth={depth}
            selected={openDocumentId === doc.id}
            icon={<FileTypeIcon name={doc.name} mimeType={doc.currentVersion?.mimeType} />}
            onSelect={() => onOpenDocument(doc.id)}
            onRename={() => onRename({ id: doc.id, kind: 'document', name: doc.name })}
            onDelete={() => onDelete({ id: doc.id, kind: 'document', name: doc.name })}
            leaf
          />
        ),
      )}
    </>
  );
}

function Chevron({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  const { colors } = useVeyraTokens();
  return (
    <button
      type="button"
      aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
      aria-expanded={open}
      onClick={onClick}
      style={{
        width: 18,
        height: 18,
        flex: '0 0 18px',
        display: 'grid',
        placeItems: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: colors.textTertiary,
        fontSize: 10,
      }}
    >
      {/* The chevron is drawn in a 7x11 box with a 2px stroke, so at row size
          its line is proportionally the heaviest thing in the tree. */}
      {open ? (
        <ChevronDownIcon size={11} strokeWidth={1.5} />
      ) : (
        <ChevronRightIcon size={11} strokeWidth={1.5} />
      )}
    </button>
  );
}

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  /** Destructive: drawn in the danger colour, and last in the list. */
  danger?: boolean;
  onClick: () => void;
}

/**
 * The hover-revealed menus on a row. One component for both because they are
 * the same object — a small popover of verbs — and only the glyph and the list
 * differ.
 */
function RowMenu({
  ariaLabel,
  glyph,
  items,
}: {
  ariaLabel: string;
  glyph: React.ReactNode;
  items: MenuItem[];
}) {
  const { colors } = useVeyraTokens();
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      styles={{ container: { padding: 4 } }}
      content={
        <div style={{ display: 'grid', gap: 2, minWidth: 168 }}>
          {items.map((item) => (
            <MenuOption
              key={item.key}
              icon={item.icon}
              label={item.label}
              danger={item.danger}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            />
          ))}
        </div>
      }
    >
      <button
        type="button"
        className="veyra-tree-action"
        aria-label={ariaLabel}
        aria-expanded={open}
        style={{
          width: 22,
          height: 22,
          flex: '0 0 22px',
          display: 'grid',
          placeItems: 'center',
          background: 'none',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          color: colors.textTertiary,
          fontSize: 11,
        }}
      >
        {glyph}
      </button>
    </Popover>
  );
}

/** The `+` on a row: a folder named in place, or a file chosen from disk. */
function AddMenu({
  label,
  onNewFolder,
  onNewFile,
}: {
  label: string;
  onNewFolder: () => void;
  onNewFile: () => void;
}) {
  return (
    <RowMenu
      ariaLabel={`Add to ${label}`}
      glyph={<PlusIcon />}
      items={[
        { key: 'folder', icon: <NewFolderIcon />, label: 'New folder', onClick: onNewFolder },
        { key: 'file', icon: <NewFileIcon />, label: 'New file', onClick: onNewFile },
      ]}
    />
  );
}

/**
 * The `⋯` on a row: what you can do to the row itself, as opposed to what you
 * can put inside it. Kept apart from `+` so neither menu is a grab bag, and so
 * a leaf — which can be renamed but can't contain anything — gets a menu of
 * its own rather than a disabled half of someone else's.
 */
function EditMenu({
  label,
  onRename,
  onDelete,
}: {
  label: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <RowMenu
      ariaLabel={`Actions for ${label}`}
      glyph={<MoreIcon />}
      items={[
        { key: 'rename', icon: <RenameIcon />, label: 'Rename', onClick: onRename },
        { key: 'delete', icon: <DeleteIcon />, label: 'Delete', danger: true, onClick: onDelete },
      ]}
    />
  );
}

function MenuOption({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  const { colors, space } = useVeyraTokens();
  return (
    <button
      type="button"
      className="veyra-add-option"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        width: '100%',
        padding: `${space.sm}px ${space.md}px`,
        background: 'none',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'start',
        fontSize: 13,
        color: danger ? colors.danger : colors.textPrimary,
      }}
    >
      {/* A destructive verb is coloured throughout — an icon left grey beside
          red text reads as a rendering slip, not as restraint. */}
      <span style={{ color: danger ? colors.danger : colors.textSecondary }}>{icon}</span>
      {label}
    </button>
  );
}

/** A count, or nothing at all. Zero already reads as empty; labelling every
 *  untouched folder "empty" just adds noise down the whole tree. The width is
 *  held either way so the numbers stay in a column. */
function Count({ value }: { value: number }) {
  const { colors } = useVeyraTokens();
  return (
    <span
      style={{
        fontSize: 11,
        color: colors.textTertiary,
        minWidth: 34,
        textAlign: 'end',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value > 0 ? value : ''}
    </span>
  );
}

function Row({
  label,
  depth,
  count,
  hasChildren = false,
  open = false,
  selected = false,
  leaf = false,
  icon,
  onSelect,
  onToggle,
  onNewFolder,
  onNewFile,
  onRename,
  onDelete,
}: {
  label: string;
  depth: number;
  count?: number;
  hasChildren?: boolean;
  open?: boolean;
  selected?: boolean;
  leaf?: boolean;
  icon: React.ReactNode;
  onSelect?: () => void;
  onToggle?: () => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}) {
  const { colors, space } = useVeyraTokens();

  return (
    <div
      className="veyra-tree-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.xs,
        paddingInlineStart: space.sm + depth * INDENT,
        paddingInlineEnd: space.sm,
        background: selected ? colors.brandSubtle : 'transparent',
        color: selected ? colors.brand : colors.textPrimary,
        /*
         * A tint alone is weak at this row height and disappears entirely over
         * an open module's `bgWash`. The accent runs down the pane's own edge,
         * where it reads as a marker in the margin rather than as a border the
         * row has grown — and it costs no width, so nothing shifts when the
         * selection moves.
         */
        boxShadow: selected ? `inset 3px 0 0 ${colors.brand}` : 'none',
      }}
    >
      {hasChildren ? (
        <Chevron open={open} label={label} onClick={() => onToggle?.()} />
      ) : (
        <span aria-hidden style={{ width: 18, flex: '0 0 18px' }} />
      )}

      <button
        type="button"
        onClick={onSelect}
        // Leaves were inert while there was nothing to open them into. Now a
        // document row opens the reader, so what decides is whether this row
        // was given somewhere to go.
        disabled={!onSelect}
        /*
         * No double-click-to-rename here, tempting as the file-explorer idiom
         * is: the first click on a document row already opens the reader, so
         * the second one lands on a pane that has replaced the row. The `⋯`
         * menu is the one path, and it works the same on every row.
         */
        aria-current={selected ? 'true' : undefined}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: space.sm,
          padding: `${space.xs}px 0`,
          background: 'none',
          border: 'none',
          textAlign: 'start',
          cursor: onSelect ? 'pointer' : 'default',
          color: 'inherit',
          fontSize: 13,
        }}
      >
        <span
          style={{
            color: selected ? colors.brand : leaf ? colors.textTertiary : colors.textSecondary,
          }}
        >
          {icon}
        </span>
        <Typography.Paragraph
          ellipsis={{ tooltip: label }}
          style={{
            margin: 0,
            color: 'inherit',
            fontSize: 13,
            // Weight rather than a second colour: the row is already tinted,
            // and this is what still separates it in a printed-looking list.
            fontWeight: selected ? 600 : 400,
          }}
        >
          {label}
        </Typography.Paragraph>
      </button>

      {onNewFolder && onNewFile ? (
        <AddMenu label={label} onNewFolder={onNewFolder} onNewFile={onNewFile} />
      ) : (
        <span aria-hidden style={{ width: 22 }} />
      )}
      {onRename && onDelete ? (
        <EditMenu label={label} onRename={onRename} onDelete={onDelete} />
      ) : (
        <span aria-hidden style={{ width: 22 }} />
      )}
      {count !== undefined ? <Count value={count} /> : <span aria-hidden style={{ width: 34 }} />}
    </div>
  );
}
