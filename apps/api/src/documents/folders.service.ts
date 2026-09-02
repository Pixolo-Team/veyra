import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateFolderRequest } from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, roomId: string, input: CreateFolderRequest): Promise<{ id: string }> {
    await this.access.requireRole(userId, roomId, 'contributor');

    const roomModule = await this.prisma.roomModule.findFirst({
      where: { id: input.roomModuleId, roomId },
    });
    if (!roomModule) throw new NotFoundException('Module not found in this room');

    let parentPath = '';
    if (input.parentFolderId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: input.parentFolderId, roomId, roomModuleId: roomModule.id, deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Parent folder not found in this module');
      parentPath = parent.path;
    }

    const folder = await this.prisma.folder.create({
      data: {
        roomId,
        roomModuleId: roomModule.id,
        parentFolderId: input.parentFolderId ?? null,
        name: input.name,
        path: `${parentPath}${input.name}/`,
        createdBy: userId,
      },
    });
    await this.audit.record({
      action: 'folder.created',
      roomId,
      targetType: 'folder',
      targetId: folder.id,
      metadata: { path: folder.path },
    });
    return { id: folder.id };
  }

  async rename(userId: string, folderId: string, name: string): Promise<void> {
    const folder = await this.load(userId, folderId, 'contributor');
    const newPath = folder.path.replace(/[^/]+\/$/, `${name}/`);
    await this.prisma.$transaction(async (tx) => {
      await tx.folder.update({ where: { id: folder.id }, data: { name, path: newPath } });
      // Re-path descendants.
      const descendants = await tx.folder.findMany({
        where: { roomId: folder.roomId, path: { startsWith: folder.path }, id: { not: folder.id } },
      });
      for (const d of descendants) {
        await tx.folder.update({
          where: { id: d.id },
          data: { path: newPath + d.path.slice(folder.path.length) },
        });
      }
    });
    await this.audit.record({ action: 'folder.renamed', roomId: folder.roomId, targetType: 'folder', targetId: folder.id });
  }

  async move(userId: string, folderId: string, parentFolderId: string | null): Promise<void> {
    const folder = await this.load(userId, folderId, 'contributor');
    if (parentFolderId === folder.id) throw new BadRequestException('A folder cannot contain itself');

    let parentPath = '';
    if (parentFolderId) {
      const parent = await this.prisma.folder.findFirst({
        where: { id: parentFolderId, roomId: folder.roomId, roomModuleId: folder.roomModuleId, deletedAt: null },
      });
      if (!parent) throw new BadRequestException('Target folder not found in this module');
      if (parent.path.startsWith(folder.path)) {
        throw new BadRequestException('Cannot move a folder into its own subtree');
      }
      parentPath = parent.path;
    }
    const newPath = `${parentPath}${folder.name}/`;

    await this.prisma.$transaction(async (tx) => {
      const descendants = await tx.folder.findMany({
        where: { roomId: folder.roomId, path: { startsWith: folder.path }, id: { not: folder.id } },
      });
      await tx.folder.update({
        where: { id: folder.id },
        data: { parentFolderId, path: newPath },
      });
      for (const d of descendants) {
        await tx.folder.update({
          where: { id: d.id },
          data: { path: newPath + d.path.slice(folder.path.length) },
        });
      }
    });
    await this.audit.record({ action: 'folder.moved', roomId: folder.roomId, targetType: 'folder', targetId: folder.id });
  }

  async softDelete(userId: string, folderId: string): Promise<void> {
    const folder = await this.load(userId, folderId, 'contributor');
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.folder.updateMany({
        where: { roomId: folder.roomId, path: { startsWith: folder.path }, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.document.updateMany({
        where: { roomId: folder.roomId, folder: { path: { startsWith: folder.path } }, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
    await this.audit.record({ action: 'folder.deleted', roomId: folder.roomId, targetType: 'folder', targetId: folder.id });
  }

  /**
   * Idempotently materialises a chain of folders under `baseFolderId` (or the
   * module root) and returns the leaf folder id. Used by folder-drop upload to
   * rebuild the dropped tree from each file's relative path.
   */
  async ensurePath(
    roomId: string,
    roomModuleId: string,
    baseFolderId: string | null,
    segments: string[],
  ): Promise<string | null> {
    let parentId = baseFolderId;
    let parentPath = '';
    if (baseFolderId) {
      const base = await this.prisma.folder.findFirst({
        where: { id: baseFolderId, roomId, roomModuleId, deletedAt: null },
      });
      if (!base) throw new BadRequestException('Base folder not found in this module');
      parentPath = base.path;
    }

    for (const raw of segments) {
      const name = raw.trim().slice(0, 200) || 'untitled';
      const existing = await this.prisma.folder.findFirst({
        where: { roomId, roomModuleId, parentFolderId: parentId, name, deletedAt: null },
      });
      const folder =
        existing ??
        (await this.prisma.folder.create({
          data: {
            roomId,
            roomModuleId,
            parentFolderId: parentId,
            name,
            path: `${parentPath}${name}/`,
          },
        }));
      parentId = folder.id;
      parentPath = folder.path;
    }
    return parentId;
  }

  private async load(userId: string, folderId: string, min: 'contributor' | 'admin') {
    const folder = await this.prisma.folder.findFirst({ where: { id: folderId, deletedAt: null } });
    if (!folder) throw new NotFoundException('Folder not found');
    await this.access.requireRole(userId, folder.roomId, min);
    return folder;
  }
}
