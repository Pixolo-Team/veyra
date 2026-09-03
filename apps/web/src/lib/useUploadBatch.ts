import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FolderNode, ModuleSection, ModuleTree } from '@veyra/contracts';
import { foldersApi, uploadApi } from './api/endpoints';
import { messageOf } from './errorMessage';
import { qk } from './queries';
import { contentsOf, locate } from './tree';
import { folderPreview, runPool, type UploadItem } from './upload';

export type FileState = 'queued' | 'uploading' | 'ready' | 'failed';

export interface TrackedFile {
  relativePath: string;
  state: FileState;
  error: string | null;
}

export interface UploadTarget {
  roomModuleId: string;
  folderId: string | null;
  label: string;
}

/** Five at a time — enough to saturate a link, few enough to stay retryable. */
const CONCURRENCY = 5;

/**
 * Drives one upload batch: declare the paths, push the files, complete.
 *
 * Per-file state is tracked here rather than read back from the batch DTO on
 * every response, so a file that fails leaves the other lanes running and can
 * be retried on its own (mvp-plan §5.3) — the server treats a re-send of a
 * file that already landed as a no-op.
 */
export function useUploadBatch(roomId: string, section: ModuleSection) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [isRunning, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const itemsRef = useRef<Map<string, UploadItem>>(new Map());
  const batchIdRef = useRef<string | null>(null);

  const mark = useCallback((relativePath: string, patch: Partial<TrackedFile>) => {
    setFiles((current) =>
      current.map((file) => (file.relativePath === relativePath ? { ...file, ...patch } : file)),
    );
  }, []);

  /*
   * Create the folder structure before any file moves.
   *
   * The server builds missing folders lazily, per file, with a check-then-
   * insert and no unique constraint behind it — so five parallel uploads into
   * one new folder race and produce five folders. Creating the chain up front,
   * one request at a time, means the parallel push only ever *finds* folders.
   * (The underlying race is still the server's to close; see the note in the
   * hand-off.)
   */
  const ensureFolders = useCallback(
    async (items: UploadItem[], to: UploadTarget) => {
      const needed = folderPreview(items.map((item) => item.relativePath));
      if (needed.length === 0) return;

      const tree = queryClient.getQueryData<ModuleTree[]>(qk.tree(roomId, section)) ?? [];
      const base = locate(tree, to.folderId ?? to.roomModuleId);

      // Path (relative to the target) → folder id, seeded with what's already there.
      const byPath = new Map<string, string>();
      const seed = (folders: FolderNode[], prefix: string): void => {
        for (const folder of folders) {
          const path = `${prefix}${folder.name}`;
          byPath.set(path, folder.id);
          seed(folder.folders, `${path}/`);
        }
      };
      if (base) seed(contentsOf(base).folders, '');

      // `folderPreview` sorts, which puts every parent before its children.
      for (const path of needed) {
        if (byPath.has(path)) continue;
        const cut = path.lastIndexOf('/');
        const name = cut === -1 ? path : path.slice(cut + 1);
        const parentFolderId =
          cut === -1 ? to.folderId : (byPath.get(path.slice(0, cut)) ?? to.folderId);
        const { id } = await foldersApi.create(roomId, {
          name,
          roomModuleId: to.roomModuleId,
          parentFolderId,
        });
        byPath.set(path, id);
      }
    },
    [queryClient, roomId, section],
  );

  const push = useCallback(
    async (batchId: string, paths: string[]) => {
      await runPool(paths, CONCURRENCY, async (relativePath) => {
        const item = itemsRef.current.get(relativePath);
        if (!item) return;
        mark(relativePath, { state: 'uploading', error: null });
        try {
          await uploadApi.batchFile(batchId, item.file, relativePath);
          mark(relativePath, { state: 'ready' });
        } catch (error) {
          mark(relativePath, { state: 'failed', error: messageOf(error, 'Upload failed.') });
        }
      });
      await uploadApi.completeBatch(batchId).catch(() => undefined);
      await queryClient.invalidateQueries({ queryKey: qk.tree(roomId, section) });
    },
    [mark, queryClient, roomId, section],
  );

  const start = useCallback(
    async (items: UploadItem[], to: UploadTarget) => {
      if (items.length === 0) return;

      itemsRef.current = new Map(items.map((item) => [item.relativePath, item]));
      const paths = [...itemsRef.current.keys()]; // de-duplicated by the Map

      setTarget(to);
      setFatal(null);
      setFiles(paths.map((relativePath) => ({ relativePath, state: 'queued', error: null })));
      setRunning(true);

      try {
        const batch = await uploadApi.createBatch(roomId, {
          roomModuleId: to.roomModuleId,
          folderId: to.folderId,
          paths,
        });
        batchIdRef.current = batch.id;
        await ensureFolders(items, to);
        await push(batch.id, paths);
      } catch (error) {
        setFatal(messageOf(error, 'Could not start the upload.'));
      } finally {
        setRunning(false);
      }
    },
    [ensureFolders, push, roomId],
  );

  const retryFailed = useCallback(async () => {
    const batchId = batchIdRef.current;
    if (!batchId) return;
    const paths = files.filter((file) => file.state === 'failed').map((file) => file.relativePath);
    if (paths.length === 0) return;

    setRunning(true);
    try {
      await push(batchId, paths);
    } finally {
      setRunning(false);
    }
  }, [files, push]);

  const dismiss = useCallback(() => {
    setTarget(null);
    setFiles([]);
    setFatal(null);
    itemsRef.current = new Map();
    batchIdRef.current = null;
  }, []);

  const done = files.filter((file) => file.state === 'ready').length;
  const failed = files.filter((file) => file.state === 'failed').length;

  return { target, files, isRunning, fatal, done, failed, start, retryFailed, dismiss };
}
