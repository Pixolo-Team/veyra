import type { DocumentDto, FolderNode, ModuleTree } from '@veyra/contracts';

/**
 * Where a selected node sits in the tree. `folder` is null when the module
 * itself is selected — a module is the root of its own tree, not a folder.
 */
export interface TreeLocation {
  module: ModuleTree;
  folder: FolderNode | null;
  /** Ancestors from the module's first folder down to (and including) `folder`. */
  trail: FolderNode[];
}

export interface NodeContents {
  folders: FolderNode[];
  documents: DocumentDto[];
}

export function contentsOf(location: TreeLocation): NodeContents {
  return location.folder
    ? { folders: location.folder.folders, documents: location.folder.documents }
    : { folders: location.module.folders, documents: location.module.documents };
}

/** Every document at or below a node. Modules show a total, not a shallow count. */
export function countDocuments(node: { folders: FolderNode[]; documents: DocumentDto[] }): number {
  return (
    node.documents.length +
    node.folders.reduce((total, folder) => total + countDocuments(folder), 0)
  );
}

export function countBytes(node: { folders: FolderNode[]; documents: DocumentDto[] }): number {
  return (
    node.documents.reduce((total, doc) => total + (doc.currentVersion?.byteSize ?? 0), 0) +
    node.folders.reduce((total, folder) => total + countBytes(folder), 0)
  );
}

/**
 * Resolves a node id to its place in the tree. Module ids and folder ids come
 * from different tables, so one lookup can safely try both.
 */
export function locate(modules: ModuleTree[], nodeId: string | undefined): TreeLocation | null {
  if (!nodeId) return null;

  for (const module of modules) {
    if (module.id === nodeId) return { module, folder: null, trail: [] };
    const trail = trailTo(module.folders, nodeId);
    if (trail) return { module, folder: trail[trail.length - 1], trail };
  }
  return null;
}

function trailTo(folders: FolderNode[], nodeId: string): FolderNode[] | null {
  for (const folder of folders) {
    if (folder.id === nodeId) return [folder];
    const deeper = trailTo(folder.folders, nodeId);
    if (deeper) return [folder, ...deeper];
  }
  return null;
}

/** Every node that can be expanded: modules plus every folder beneath them. */
export function allNodeIds(modules: ModuleTree[]): string[] {
  const ids: string[] = [];
  const walk = (folders: FolderNode[]): void => {
    for (const folder of folders) {
      ids.push(folder.id);
      walk(folder.folders);
    }
  };
  for (const module of modules) {
    ids.push(module.id);
    walk(module.folders);
  }
  return ids;
}

/** Ids of every folder on the path to a node — what has to be open to see it. */
export function ancestorIds(modules: ModuleTree[], nodeId: string | undefined): string[] {
  const location = locate(modules, nodeId);
  if (!location) return [];
  return [location.module.id, ...location.trail.map((folder) => folder.id)];
}

export interface FilteredTree {
  modules: ModuleTree[];
  /** Everything that has to be open for the surviving nodes to be visible. */
  reveal: string[];
  matches: number;
}

/**
 * Prunes the tree to what matches `query`, by name.
 *
 * Two rules, both of which people expect without being told:
 *
 * - A folder survives if it matches *or* anything under it does, so a hit five
 *   levels down still shows you the path to itself.
 * - A folder that matches keeps its whole subtree. Searching "stability" and
 *   getting the 3.2.P.8 folder with its contents hidden — because the children
 *   don't have "stability" in their own names — is the behaviour that makes
 *   people stop trusting a filter.
 *
 * Matching is a case-insensitive substring: a dossier is numbered, and someone
 * typing "3.2.P.8" is doing something a fuzzy matcher would only get in the way of.
 */
export function filterModules(modules: ModuleTree[], query: string): FilteredTree {
  const needle = query.trim().toLowerCase();
  if (!needle) return { modules, reveal: [], matches: 0 };

  const hit = (text: string): boolean => text.toLowerCase().includes(needle);
  const reveal: string[] = [];
  let matches = 0;

  const walk = (folders: FolderNode[], documents: DocumentDto[]) => {
    const keptDocuments = documents.filter((doc) => hit(doc.name));
    matches += keptDocuments.length;

    const keptFolders: FolderNode[] = [];
    for (const folder of folders) {
      if (hit(folder.name)) {
        // Matched itself: keep it whole, and don't count its contents as hits.
        matches += 1;
        keptFolders.push(folder);
        continue;
      }
      const inner = walk(folder.folders, folder.documents);
      if (inner.folders.length || inner.documents.length) {
        keptFolders.push({ ...folder, folders: inner.folders, documents: inner.documents });
        reveal.push(folder.id);
      }
    }
    return { folders: keptFolders, documents: keptDocuments };
  };

  const kept: ModuleTree[] = [];
  for (const module of modules) {
    const inner = walk(module.folders, module.documents);
    if (inner.folders.length || inner.documents.length) {
      kept.push({ ...module, folders: inner.folders, documents: inner.documents });
      reveal.push(module.id);
    }
  }
  return { modules: kept, reveal, matches };
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—';
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${UNITS[exponent]}`;
}

/** "Module 3 · Quality" — the code carries the ordering, the title the meaning. */
export function moduleLabel(module: ModuleTree): string {
  return module.section === 'documents' ? module.title : `Module ${module.code} · ${module.title}`;
}
