import { useState } from 'react';
import { Breadcrumb, Dropdown, Table, Typography } from 'antd';
import {
  ChevronDownIcon,
  DeleteIcon,
  FileUploadIcon,
  FolderIcon,
  MoreIcon,
  RenameIcon,
  UploadIcon,
} from '../icons';
import { FileTypeIcon } from '../FileTypeIcon';
import { NameEditor } from './InlineNameInput';
import type { RowTarget } from './TreePane';
import { Button, Stack, useVeyraTokens } from '@veyra/design-system';
import {
  contentsOf,
  countBytes,
  countDocuments,
  formatBytes,
  moduleLabel,
  type TreeLocation,
} from '../../lib/tree';
import { relativeTime } from '../../lib/relativeTime';
import { MAX_UPLOAD_BYTES } from '@veyra/contracts';

interface Row {
  key: string;
  kind: 'folder' | 'document';
  name: string;
  /** Documents only — what FileTypeIcon falls back to when the name has no extension. */
  mimeType?: string;
  /** Documents only — a row that opens the reader rather than a folder. */
  documentId?: string;
  size: string;
  version: string;
  modified: string;
  nodeId: string | null;
  /** Folders only — the other names at this level, for the rename check. */
  siblings: string[];
}

/** What's directly inside the selected node — one level, not the whole subtree. */
export function NodeDetail({
  location,
  onOpen,
  onOpenDocument,
  onUpload,
  renamingId,
  renaming,
  onRename,
  onRenameSubmit,
  onRenameCancel,
  onDelete,
}: {
  location: TreeLocation;
  onOpen: (nodeId: string) => void;
  /** Opens a document in the reader. */
  onOpenDocument: (documentId: string) => void;
  /** `directory: true` opens the folder chooser, which keeps sub-folders. */
  onUpload: (directory: boolean) => void;
  /** The row whose name cell is currently an editor, if any. */
  renamingId: string | null;
  renaming: boolean;
  onRename: (target: RowTarget) => void;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  /** Deleting is confirmed by the caller — the table only names the row. */
  onDelete: (target: RowTarget) => void;
}) {
  const { colors, space } = useVeyraTokens();
  const { folders, documents } = contentsOf(location);
  const node = location.folder ?? location.module;
  const isEmpty = folders.length === 0 && documents.length === 0;
  const fileCount = countDocuments(node);

  /*
   * Ancestors as links, not labels. The tree is the usual way back up, but it
   * can be collapsed while a deep folder stays selected — "collapse all"
   * deliberately leaves the selection alone — and then the trail printed here
   * is the only route out of the node you are standing in.
   */
  const ancestors = location.folder
    ? [
        { id: location.module.id, title: moduleLabel(location.module) },
        ...location.trail.slice(0, -1).map((folder) => ({ id: folder.id, title: folder.name })),
      ]
    : [];

  const rows: Row[] = [
    ...folders.map((folder) => ({
      key: folder.id,
      kind: 'folder' as const,
      name: folder.name,
      size: `${countDocuments(folder)} files`,
      version: '—',
      modified: '—',
      nodeId: folder.id,
      siblings: folders.filter((other) => other.id !== folder.id).map((other) => other.name),
    })),
    ...documents.map((doc) => ({
      key: doc.id,
      kind: 'document' as const,
      name: doc.name,
      documentId: doc.id,
      mimeType: doc.currentVersion?.mimeType,
      size: formatBytes(doc.currentVersion?.byteSize ?? 0),
      version: doc.currentVersion ? `v${doc.currentVersion.versionNo}` : '—',
      modified: relativeTime(doc.currentVersion?.createdAt ?? doc.createdAt) ?? '—',
      nodeId: null,
      siblings: [],
    })),
  ];

  return (
    <Stack gap="lg">
      <Stack gap="xs">
        {/* Ancestors only. Including the selected node would print its name
            twice — once here and again as the heading below. */}
        {ancestors.length > 0 ? (
          <Breadcrumb
            items={ancestors.map(({ id, title }) => ({
              title: (
                <button
                  type="button"
                  onClick={() => onOpen(id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {title}
                </button>
              ),
            }))}
          />
        ) : null}
        {/* Wraps rather than shrinks: a CTD module title is long, and squeezing
            it against three buttons breaks it to one character per line. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space.md,
            flexWrap: 'wrap',
          }}
        >
          <Typography.Title level={5} style={{ margin: 0, flex: '1 1 240px', minWidth: 0 }}>
            {location.folder ? location.folder.name : moduleLabel(location.module)}
          </Typography.Title>
          <UploadButton onUpload={onUpload} />
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {fileCount} file{fileCount === 1 ? '' : 's'} · {formatBytes(countBytes(node))}
        </Typography.Text>
      </Stack>

      {isEmpty ? (
        <EmptyNode isModule={!location.folder} onUpload={onUpload} />
      ) : (
        // The row styling lives in a stylesheet — antd paints the cells, and a
        // hover state is not something an inline style can express — so the
        // two colours it needs are published here as custom properties rather
        // than hard-coded next to a rule that would then stop theming.
        <div
          style={{
            ['--veyra-file-active' as string]: colors.brandSubtle,
            ['--veyra-file-accent' as string]: colors.brand,
          }}
        >
        <Table<Row>
          dataSource={rows}
          size="middle"
          pagination={false}
          scroll={{ x: 580 }}
          rowClassName={(row) =>
            row.key === renamingId ? 'veyra-file-row veyra-file-row--active' : 'veyra-file-row'
          }
          onRow={(row) => ({
            onClick: (event) => {
              // A click anywhere in the row while it is being renamed belongs
              // to the editor, not to navigation.
              if (row.key === renamingId) return;
              /*
               * The row menu renders into a portal at the document root, but
               * React propagates events along the *component* tree — so a click
               * on "Rename" still arrives here, and the row would open the very
               * file you were about to rename. The portal is the one place a
               * click inside this row does not mean "open it".
               */
              if ((event.target as HTMLElement).closest('.ant-dropdown')) return;
              if (row.nodeId) onOpen(row.nodeId);
              else if (row.documentId) onOpenDocument(row.documentId);
            },
            style: { cursor: row.key === renamingId ? 'default' : 'pointer' },
          })}
          columns={[
            {
              title: 'Name',
              dataIndex: 'name',
              ellipsis: true,
              render: (name: string, row) => (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: space.sm,
                    minWidth: 0,
                  }}
                >
                  {row.kind === 'folder' ? (
                    <FolderIcon style={{ color: colors.brand, flex: '0 0 auto' }} />
                  ) : (
                    <FileTypeIcon name={name} mimeType={row.mimeType} style={{ flex: '0 0 auto' }} />
                  )}
                  {row.key === renamingId ? (
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <NameEditor
                        busy={renaming}
                        initialName={name}
                        placeholder={row.kind === 'folder' ? 'Folder name' : 'File name'}
                        kind={row.kind === 'folder' ? 'folder' : 'file'}
                        // Only folders have to be unique among their siblings;
                        // two files with one name is a smell, not a clash.
                        siblings={row.kind === 'folder' ? row.siblings : []}
                        onSubmit={onRenameSubmit}
                        onCancel={onRenameCancel}
                      />
                    </span>
                  ) : (
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                    </span>
                  )}
                </span>
              ),
            },
            { title: 'Size', dataIndex: 'size', width: 120 },
            { title: 'Ver', dataIndex: 'version', width: 70 },
            { title: 'Modified', dataIndex: 'modified', width: 140 },
            {
              title: '',
              key: 'actions',
              width: 52,
              // The whole row navigates, so the menu has to swallow its own
              // clicks — otherwise opening it also opens the folder under it.
              onCell: () => ({ onClick: (event) => event.stopPropagation() }),
              render: (_: unknown, row) => (
                <RowActions
                  label={row.name}
                  onRename={() => onRename(targetOf(row))}
                  onDelete={() => onDelete(targetOf(row))}
                />
              ),
            },
          ]}
        />
        </div>
      )}
    </Stack>
  );
}

/** A table row as the tree's verbs see it: folders and documents differ by id. */
function targetOf(row: Row): RowTarget {
  return { id: row.key, kind: row.kind === 'folder' ? 'folder' : 'document', name: row.name };
}

/**
 * What you can do to a row, as opposed to what the row opens. A menu rather
 * than a bare pencil: rename is the first verb here, not the only one it will
 * ever hold.
 */
function RowActions({
  label,
  onRename,
  onDelete,
}: {
  label: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { colors } = useVeyraTokens();
  // Controlled so a choice closes the menu here rather than leaving it open
  // over the row it just acted on — the rename editor opens underneath it.
  const [open, setOpen] = useState(false);
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          // No stopPropagation on these: the row already ignores clicks that
          // come from the menu's portal, and stopping the event here would
          // also stop antd closing the menu after a choice.
          { key: 'rename', icon: <RenameIcon />, label: 'Rename', onClick: choose(onRename) },
          {
            key: 'delete',
            icon: <DeleteIcon />,
            label: 'Delete',
            // antd's own destructive styling — red label and icon, and it
            // stays red through hover, which a colour set here would not.
            danger: true,
            onClick: choose(onDelete),
          },
        ],
      }}
    >
      <button
        type="button"
        aria-label={`Actions for ${label}`}
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: 'none',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          color: colors.textTertiary,
        }}
      >
        <MoreIcon />
      </button>
    </Dropdown>
  );
}

/**
 * One control for both, because the browser can only offer one kind of picker
 * at a time — the choice has to live somewhere, and a menu is a smaller ask
 * than three permanent buttons.
 */
function UploadButton({ onUpload }: { onUpload: (directory: boolean) => void }) {
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: [
          { key: 'files', label: 'Files…', onClick: () => onUpload(false) },
          { key: 'folder', label: 'Folder…', onClick: () => onUpload(true) },
        ],
      }}
    >
      <Button intent="primary" icon={<UploadIcon />} style={{ flexShrink: 0 }}>
        Upload <ChevronDownIcon size={12} />
      </Button>
    </Dropdown>
  );
}

/**
 * The empty state *is* the drop target.
 *
 * The whole right-hand pane already accepts a drop, but a bare "nothing here"
 * doesn't say so — this makes the affordance the thing you're looking at, and
 * states the one constraint worth knowing before you drag 400 MB across.
 */
function EmptyNode({
  isModule,
  onUpload,
}: {
  isModule: boolean;
  onUpload: (directory: boolean) => void;
}) {
  const { colors, space } = useVeyraTokens();
  return (
    <div
      style={{
        border: `1px dashed ${colors.borderStrong}`,
        borderRadius: 12,
        padding: `${space['3xl']}px ${space.xl}px`,
        textAlign: 'center',
      }}
    >
      <Stack gap="sm" align="center">
        <FileUploadIcon size={40} style={{ color: colors.textTertiary }} />
        <Typography.Text strong style={{ fontSize: 15 }}>
          Drag and drop files here
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Any file type · up to {formatBytes(MAX_UPLOAD_BYTES)} each
        </Typography.Text>
        <div style={{ paddingTop: space.sm }}>
          <UploadButton onUpload={onUpload} />
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Or use <strong>+</strong> in the tree to add an empty{' '}
          {isModule ? 'folder to this module' : 'sub-folder'}.
        </Typography.Text>
      </Stack>
    </div>
  );
}
