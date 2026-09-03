/**
 * Turning a user's gesture into a flat list of files with the paths the server
 * needs.
 *
 * `relativePath` is what rebuilds the folder tree server-side — for a plain
 * file it's just the name, for a dropped folder it's the whole path under it.
 * Everything goes through the batch API either way, so retry and progress work
 * the same however the files arrived.
 */
export interface UploadItem {
  file: File;
  relativePath: string;
}

/** Opens the OS picker. `directory` swaps it for a folder chooser. */
export function pickFiles(directory: boolean): Promise<UploadItem[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (directory) {
      // Not in React's typings, and only these two spellings are honoured.
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
    }
    input.style.display = 'none';

    const finish = (files: FileList | null) => {
      input.remove();
      resolve(files ? [...files].map(toItem) : []);
    };
    input.addEventListener('change', () => finish(input.files), { once: true });
    // A cancelled picker fires no `change`; without this the promise never
    // settles and the caller waits forever.
    input.addEventListener('cancel', () => finish(null), { once: true });

    document.body.append(input);
    input.click();
  });
}

function toItem(file: File): UploadItem {
  // `webkitRelativePath` is set only by a directory pick.
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  return { file, relativePath: path && path.length > 0 ? path : file.name };
}

/**
 * Files from a drop. Directories are walked so dropping a folder keeps its
 * shape — a plain `dataTransfer.files` read would flatten it and lose the tree.
 */
export async function itemsFromDrop(transfer: DataTransfer): Promise<UploadItem[]> {
  const entries = [...transfer.items]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);

  if (entries.length === 0) return [...transfer.files].map(toItem);

  const collected: UploadItem[] = [];
  await Promise.all(entries.map((entry) => walk(entry, '', collected)));
  return collected;
}

async function walk(entry: FileSystemEntry, prefix: string, out: UploadItem[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) =>
      (entry as FileSystemFileEntry).file(resolve, () => resolve(null)),
    );
    if (file) out.push({ file, relativePath: `${prefix}${entry.name}` });
    return;
  }
  if (!entry.isDirectory) return;

  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns at most 100 per call — keep reading until it's empty.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) =>
      reader.readEntries(resolve, () => resolve([])),
    );
    if (batch.length === 0) break;
    for (const child of batch) await walk(child, `${prefix}${entry.name}/`, out);
  }
}

/** Runs `worker` over `items`, at most `limit` in flight. */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index]);
    }
  });
  await Promise.all(lanes);
}

/** Distinct folder paths a set of relative paths will create, for the preview. */
export function folderPreview(relativePaths: string[]): string[] {
  const folders = new Set<string>();
  for (const relativePath of relativePaths) {
    const parts = relativePath.split('/').slice(0, -1);
    for (let i = 0; i < parts.length; i++) folders.add(parts.slice(0, i + 1).join('/'));
  }
  return [...folders].sort();
}
