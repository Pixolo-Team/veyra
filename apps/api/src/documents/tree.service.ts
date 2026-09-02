import { Injectable } from '@nestjs/common';
import type { Document, DocumentVersion, Folder } from '@prisma/client';
import type { FolderNode, ModuleSection, ModuleTree } from '@veyra/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { toDocumentDto } from './dto';

type DocWithVersion = Document & { currentVersion: DocumentVersion | null };

/** Reads a room section (dossier | documents) as a nested module → folder → document tree. */
@Injectable()
export class TreeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
  ) {}

  async forSection(userId: string, roomId: string, section: ModuleSection): Promise<ModuleTree[]> {
    await this.access.requireParticipant(userId, roomId);

    const [modules, folders, documents] = await Promise.all([
      this.prisma.roomModule.findMany({
        where: { roomId, section },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.folder.findMany({
        where: { roomId, deletedAt: null, roomModule: { section } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.document.findMany({
        where: { roomId, deletedAt: null, roomModule: { section } },
        include: { currentVersion: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const foldersByModule = groupBy(folders, (f) => f.roomModuleId);
    const docsByFolder = groupBy(documents, (d) => d.folderId ?? '__root__');

    return modules.map((m) => {
      const roots = (foldersByModule.get(m.id) ?? []).filter((f) => !f.parentFolderId);
      return {
        id: m.id,
        code: m.code,
        title: m.title,
        section: m.section,
        sortOrder: m.sortOrder,
        folders: roots.map((f) => this.buildFolder(f, foldersByModule.get(m.id) ?? [], docsByFolder)),
        documents: (docsByFolder.get('__root__') ?? [])
          .filter((d) => d.roomModuleId === m.id)
          .map(toDocumentDto),
      };
    });
  }

  private buildFolder(
    folder: Folder,
    allInModule: Folder[],
    docsByFolder: Map<string, DocWithVersion[]>,
  ): FolderNode {
    const children = allInModule.filter((f) => f.parentFolderId === folder.id);
    return {
      id: folder.id,
      name: folder.name,
      path: folder.path,
      folders: children.map((c) => this.buildFolder(c, allInModule, docsByFolder)),
      documents: (docsByFolder.get(folder.id) ?? []).map(toDocumentDto),
    };
  }
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    (map.get(k) ?? map.set(k, []).get(k)!).push(item);
  }
  return map;
}
