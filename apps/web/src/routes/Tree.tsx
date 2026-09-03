import { useCallback, useMemo, useState } from 'react';
import { Alert, App, Skeleton, Typography } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { ModuleSection } from '@veyra/contracts';
import { useVeyraTokens } from '@veyra/design-system';
import { PageHeader } from '../components/Page';
import { UploadDrawer } from '../components/tree/UploadDrawer';
import { NodeDetail } from '../components/tree/NodeDetail';
import { DocumentReview } from '../components/viewer/DocumentReview';
import { TreePane, type RowTarget } from '../components/tree/TreePane';
import { messageOf } from '../lib/errorMessage';
import { documentsApi, foldersApi } from '../lib/api/endpoints';
import { qk, treeQuery, roomQuery } from '../lib/queries';
import { folderPreview, itemsFromDrop, pickFiles, type UploadItem } from '../lib/upload';
import { useUploadBatch, type UploadTarget } from '../lib/useUploadBatch';
import {
  allNodeIds,
  ancestorIds,
  filterModules,
  countBytes,
  countDocuments,
  formatBytes,
  locate,
  moduleLabel,
} from '../lib/tree';

/**
 * Dossier and Documents are one screen over two sections (D13) — same tree
 * mechanics, different `room_modules.section`. Splitting them into two
 * components would be two copies of the same bug.
 */
export function Tree({ section }: { section: ModuleSection }) {
  const { roomId } = useParams({ from: '/session/app/rooms/$roomId' });
  const { colors, space } = useVeyraTokens();

  const tree = useQuery(treeQuery(roomId, section));
  const modules = useMemo(() => tree.data ?? [], [tree.data]);

  /*
   * The selection lives in the URL, not in state: an upload targets whatever is
   * selected, so losing it on a reload would silently retarget the drop — and
   * it makes a folder something you can send someone.
   */
  const { node: selectedId, doc: openDocumentId } = useSearch({ strict: false }) as {
    node?: string;
    doc?: string;
  };
  const navigate = useNavigate();
  const setSelectedId = useCallback(
    (node: string | undefined) => {
      void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...prev, node }), replace: true });
    },
    [navigate],
  );

  /*
   * `null` means untouched, which is how the first module can start open
   * without an effect writing it into state on load. The moment anyone
   * toggles, this becomes a real set and stops guessing.
   */
  const [expandedState, setExpandedState] = useState<ReadonlySet<string> | null>(null);
  /** The node whose children are showing a naming row, and where it will land. */
  const [creatingAt, setCreatingAt] = useState<{
    nodeId: string;
    roomModuleId: string;
    parentFolderId: string | null;
  } | null>(null);
  /**
   * The row being renamed in place, and which pane opened the editor — the
   * same folder can be on screen twice (a tree row and a table row), and two
   * editors for one name would fight over the focus.
   */
  const [renamingAt, setRenamingAt] = useState<(RowTarget & { from: 'tree' | 'detail' }) | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);
  /** Name filter over the tree. Deliberately not in the URL: it's a way of
   *  looking at the dossier, not a place in it — and the selected node, which
   *  an upload targets, is the thing worth surviving a reload. */
  const [filter, setFilter] = useState('');
  const room = useQuery(roomQuery(roomId));
  const queryClient = useQueryClient();
  const { message, modal } = App.useApp();
  const upload = useUploadBatch(roomId, section);

  // Default to the first module so the pane is never blank on arrival.
  const activeId = selectedId ?? modules[0]?.id;
  const location = locate(modules, activeId);

  const filtered = useMemo(() => filterModules(modules, filter), [modules, filter]);

  /*
   * Branches the filter opened and the reader then shut again, keyed by the
   * query that opened them — so the next keystroke starts from fully revealed
   * without an effect having to reset anything.
   */
  const [closedWhileFiltering, setClosedWhileFiltering] = useState<{
    query: string;
    ids: ReadonlySet<string>;
  }>({ query: '', ids: new Set() });

  /*
   * A filter that leaves its results inside collapsed branches has told you
   * something is there and then hidden it, so the reveal is derived here
   * rather than written into the reader's own expansion state: their tree is
   * exactly as they left it the moment the filter clears.
   */
  const expanded = useMemo(() => {
    const base = expandedState ?? new Set(modules[0] ? [modules[0].id] : []);
    if (!filter.trim()) return base;
    const shut = closedWhileFiltering.query === filter ? closedWhileFiltering.ids : new Set();
    return new Set([...base, ...filtered.reveal].filter((id) => !shut.has(id)));
  }, [expandedState, modules, filter, filtered, closedWhileFiltering]);

  const toggle = (nodeId: string) => {
    const closing = expanded.has(nodeId);
    setExpandedState(() => {
      const next = new Set(expanded);
      if (closing) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    // Closing something the filter had opened has to be remembered separately,
    // or the derived reveal above would put it straight back.
    if (filter.trim()) {
      setClosedWhileFiltering((current) => {
        const ids = new Set(current.query === filter ? current.ids : []);
        if (closing) ids.add(nodeId);
        else ids.delete(nodeId);
        return { query: filter, ids };
      });
    }
  };

  /*
   * Opening a document replaces the file listing in the middle pane and leaves
   * the tree where it is — reading a leaf is a move *within* the dossier, not
   * away from it, and losing the tree to read one page costs the reader their
   * place in a five-module submission.
   *
   * In the URL for the same reason the node selection is: a link to what
   * someone is looking at has to reopen it.
   */
  const openDocument = useCallback(
    (documentId: string | undefined) =>
      void navigate({
        to: '.',
        search: (current) => ({ ...current, doc: documentId }),
        replace: true,
      }),
    [navigate],
  );

  /**
   * Selecting reveals: you cannot look at a node inside a collapsed branch, so
   * a selection opens its ancestors. Collapse-all leaves the selection alone —
   * emptying the right-hand panel is not what "collapse" means.
   */
  const select = useCallback(
    (nodeId: string | undefined) => {
      setSelectedId(nodeId);
      openDocument(undefined);
      if (nodeId) {
        setExpandedState((current) => {
          const base = current ?? new Set(modules[0] ? [modules[0].id] : []);
          return new Set([...base, ...ancestorIds(modules, nodeId)]);
        });
      }
    },
    [modules, setSelectedId, openDocument],
  );


  const startNewFolder = useCallback(
    (nodeId: string) => {
      const at = locate(modules, nodeId);
      if (!at) return;
      // The naming row lives among the node's children, so the node must open.
      setExpandedState((current) => {
        const base = current ?? new Set(modules[0] ? [modules[0].id] : []);
        return new Set([...base, ...ancestorIds(modules, nodeId), nodeId]);
      });
      setCreatingAt({
        nodeId,
        roomModuleId: at.module.id,
        parentFolderId: at.folder?.id ?? null,
      });
    },
    [modules],
  );

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { id } = await foldersApi.create(roomId, {
        name,
        roomModuleId: creatingAt!.roomModuleId,
        parentFolderId: creatingAt!.parentFolderId,
      });
      return { id, name };
    },
    onSuccess: async (folder) => {
      await queryClient.invalidateQueries({ queryKey: qk.tree(roomId, section) });
      setCreatingAt(null);
      // Land inside what you just made — that's where the next thing goes.
      select(folder.id);
    },
    onError: (error) => message.error(messageOf(error, 'Could not create the folder.')),
  });

  /**
   * One mutation for both kinds: the two endpoints differ only in their path,
   * and splitting them would mean two copies of the invalidation below.
   */
  const rename = useMutation({
    mutationFn: async (name: string) => {
      const target = renamingAt!;
      if (target.kind === 'folder') await foldersApi.rename(target.id, name);
      else await documentsApi.rename(target.id, name);
      return target;
    },
    onSuccess: async (target) => {
      setRenamingAt(null);
      await queryClient.invalidateQueries({ queryKey: qk.tree(roomId, section) });
      // The reader shows the name in its own header, from its own query.
      if (target.kind === 'document') {
        await queryClient.invalidateQueries({ queryKey: qk.document(target.id) });
      }
    },
    onError: (error) => {
      // Close the row: the tree still shows the old name, so nothing is left
      // in a half-renamed state while the reason is on screen.
      setRenamingAt(null);
      message.error(messageOf(error, 'Could not rename that.'));
    },
  });

  const submitRename = useCallback(
    (name: string) => {
      if (!rename.isPending) rename.mutate(name);
    },
    [rename],
  );

  /**
   * Deleting is a soft delete on the server — the row leaves the tree and the
   * audit trail keeps what happened — but a folder takes everything beneath it
   * with it, so the confirmation says so rather than asking "are you sure?".
   */
  const remove = useMutation({
    mutationFn: async (target: RowTarget) => {
      if (target.kind === 'folder') await foldersApi.remove(target.id);
      else await documentsApi.remove(target.id);
      return target;
    },
    onSuccess: async (target) => {
      // Nothing may point at what was just deleted: the reader would 404 on
      // the open document, and the detail pane would render an empty node.
      if (target.kind === 'document' && openDocumentId === target.id) openDocument(undefined);
      if (target.kind === 'folder' && ancestorIds(modules, activeId).includes(target.id)) {
        const at = locate(modules, target.id);
        select(at?.trail.at(-2)?.id ?? at?.module.id);
      }
      await queryClient.invalidateQueries({ queryKey: qk.tree(roomId, section) });
      message.success(`Deleted “${target.name}”.`);
    },
    onError: (error) => message.error(messageOf(error, 'Could not delete that.')),
  });

  const confirmDelete = useCallback(
    (target: RowTarget) => {
      const at = target.kind === 'folder' ? locate(modules, target.id) : null;
      const inside = at?.folder ? countDocuments(at.folder) : 0;
      modal.confirm({
        title: `Delete “${target.name}”?`,
        content:
          target.kind === 'folder'
            ? inside > 0
              ? `This folder and the ${inside} file${inside === 1 ? '' : 's'} in it will be removed from the room.`
              : 'This folder will be removed from the room.'
            : 'This file and its versions will be removed from the room.',
        okText: 'Delete',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => remove.mutateAsync(target),
      });
    },
    [modal, modules, remove],
  );

  /** Where an upload lands: the selected folder, or the module root. */
  const uploadTarget = useCallback((): UploadTarget | null => {
    if (!location) return null;
    return {
      roomModuleId: location.module.id,
      folderId: location.folder?.id ?? null,
      label: location.folder?.name ?? moduleLabel(location.module),
    };
  }, [location]);

  const startUpload = useCallback(
    async (items: UploadItem[]) => {
      const to = uploadTarget();
      if (to && items.length > 0) await upload.start(items, to);
    },
    [upload, uploadTarget],
  );

  const chooseAndUpload = useCallback(
    async (directory: boolean) => {
      await startUpload(await pickFiles(directory));
    },
    [startUpload],
  );

  /** `+ → Upload file` targets that row, not whatever happens to be selected. */
  const uploadInto = useCallback(
    async (nodeId: string) => {
      const at = locate(modules, nodeId);
      if (!at) return;
      const items = await pickFiles(false);
      if (items.length === 0) return;
      await upload.start(items, {
        roomModuleId: at.module.id,
        folderId: at.folder?.id ?? null,
        label: at.folder?.name ?? moduleLabel(at.module),
      });
    },
    [modules, upload],
  );

  const title = section === 'dossier' ? 'Dossier' : 'Documents';
  const totals = modules.reduce(
    (acc, module) => ({
      files: acc.files + countDocuments(module),
      bytes: acc.bytes + countBytes(module),
    }),
    { files: 0, bytes: 0 },
  );

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          tree.isPending
            ? undefined
            : `${totals.files} file${totals.files === 1 ? '' : 's'} · ${formatBytes(totals.bytes)}`
        }
      />

        {tree.isPending ? (
          <div style={{ padding: space['2xl'] }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </div>
        ) : tree.isError ? (
          <div style={{ padding: space['2xl'] }}>
            <Alert type="error" showIcon title={messageOf(tree.error, 'Could not load the tree.')} />
          </div>
        ) : modules.length === 0 ? (
          <div style={{ padding: space['2xl'] }}>
            <Typography.Text type="secondary">
              This room has no {title.toLowerCase()} sections.
            </Typography.Text>
          </div>
        ) : (
          <div
            className={`veyra-tree-layout${openDocumentId ? ' veyra-tree-layout--reading' : ''}`}
          >
            <aside
              style={{
                // Both columns live inside the page panel and share its white,
                // so this one is drawn — the same reason PageHeader draws one.
                borderInlineEnd: `1px solid ${colors.divider}`,
              }}
            >
              <TreePane
                modules={filtered.modules}
                query={filter}
                onQueryChange={setFilter}
                selectedId={activeId}
                openDocumentId={openDocumentId}
                expanded={expanded}
                onSelect={select}
                onToggle={toggle}
                onCollapseAll={() => setExpandedState(new Set())}
                onExpandAll={() => setExpandedState(new Set(allNodeIds(modules)))}
                onNewFolder={startNewFolder}
                onNewFile={(nodeId) => void uploadInto(nodeId)}
                onOpenDocument={openDocument}
                creatingAt={creatingAt?.nodeId ?? null}
                creating={createFolder.isPending}
                onCreateSubmit={(name) => {
                  if (!createFolder.isPending) createFolder.mutate(name);
                }}
                onCreateCancel={() => setCreatingAt(null)}
                renamingId={renamingAt?.from === 'tree' ? renamingAt.id : null}
                renaming={rename.isPending}
                onRename={(target) => setRenamingAt({ ...target, from: 'tree' })}
                onRenameSubmit={submitRename}
                onRenameCancel={() => setRenamingAt(null)}
                onDelete={confirmDelete}
              />
            </aside>

            <section
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                // Fires for every child; only a real exit leaves the section.
                if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void itemsFromDrop(event.dataTransfer).then(startUpload);
              }}
              style={{
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                // The reader lays out its own panes and scrolls them itself;
                // padding here would inset the page image from its own rail.
                padding: openDocumentId ? 0 : space.xl,
                overflow: openDocumentId ? 'hidden' : undefined,
                // A dashed outline inside the panel, so the drop target reads
                // without the panel itself appearing to change size.
                outline: dragging ? `2px dashed ${colors.brand}` : 'none',
                outlineOffset: -10,
              }}
            >
              {openDocumentId ? (
                <DocumentReview
                  key={openDocumentId}
                  documentId={openDocumentId}
                  allowDownload={Boolean(room.data?.allowDownload)}
                  companies={{
                    ...(room.data?.discloserCompany
                      ? { discloser: room.data.discloserCompany.name }
                      : {}),
                    ...(room.data?.recipientCompany
                      ? { recipient: room.data.recipientCompany.name }
                      : {}),
                  }}
                  onClose={() => openDocument(undefined)}
                />
              ) : location ? (
                <NodeDetail
                  location={location}
                  onOpen={select}
                  onOpenDocument={openDocument}
                  onUpload={(directory) => void chooseAndUpload(directory)}
                  renamingId={renamingAt?.from === 'detail' ? renamingAt.id : null}
                  renaming={rename.isPending}
                  onRename={(target) => setRenamingAt({ ...target, from: 'detail' })}
                  onRenameSubmit={submitRename}
                  onRenameCancel={() => setRenamingAt(null)}
                  onDelete={confirmDelete}
                />
              ) : null}
            </section>
          </div>
        )}


      <UploadDrawer
        target={upload.target}
        files={upload.files}
        isRunning={upload.isRunning}
        fatal={upload.fatal}
        done={upload.done}
        failed={upload.failed}
        folders={folderPreview(upload.files.map((file) => file.relativePath))}
        onRetry={() => void upload.retryFailed()}
        onClose={upload.dismiss}
      />


    </>
  );
}
