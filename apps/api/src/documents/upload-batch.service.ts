import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { UploadBatch } from '@prisma/client';
import type { CreateUploadBatchRequest, UploadBatchDto } from '@veyra/contracts';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { DocumentWriter, type IncomingFile } from './document-writer';
import { FoldersService } from './folders.service';

/**
 * Folder-drop upload (mvp-plan §5.3, Risk #1). The client declares every
 * relative path up front, then streams files one at a time; each file
 * reconstructs its folder chain and becomes a document version. A failed file
 * retries on its own without redoing the batch.
 */
@Injectable()
export class UploadBatchService {
  private readonly logger = new Logger(UploadBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
    private readonly audit: AuditService,
    private readonly folders: FoldersService,
    private readonly writer: DocumentWriter,
  ) {}

  async create(userId: string, roomId: string, input: CreateUploadBatchRequest): Promise<UploadBatchDto> {
    await this.access.requireRole(userId, roomId, 'contributor');

    const roomModule = await this.prisma.roomModule.findFirst({
      where: { id: input.roomModuleId, roomId },
    });
    if (!roomModule) throw new NotFoundException('Module not found in this room');
    if (input.folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: input.folderId, roomId, roomModuleId: roomModule.id, deletedAt: null },
      });
      if (!folder) throw new BadRequestException('Folder not found in this module');
    }

    const paths = [...new Set(input.paths.map((p) => p.replace(/^\/+/, '')))];
    const batch = await this.prisma.uploadBatch.create({
      data: {
        roomId,
        roomModuleId: roomModule.id,
        folderId: input.folderId ?? null,
        createdBy: userId,
        status: 'uploading',
        fileCount: paths.length,
        startedAt: new Date(),
        files: { create: paths.map((relativePath) => ({ relativePath })) },
      },
    });
    await this.audit.record({
      action: 'upload_batch.created',
      roomId,
      targetType: 'upload_batch',
      targetId: batch.id,
      metadata: { fileCount: paths.length },
    });
    return this.toDto(batch.id);
  }

  async uploadFile(
    userId: string,
    batchId: string,
    relativePath: string,
    file: IncomingFile,
  ): Promise<UploadBatchDto> {
    const batch = await this.loadBatch(userId, batchId);
    await this.access.requireWritableRoom(batch.roomId);
    const cleanPath = relativePath.replace(/^\/+/, '');
    const row = await this.prisma.uploadBatchFile.findUnique({
      where: { batchId_relativePath: { batchId, relativePath: cleanPath } },
    });
    if (!row) throw new BadRequestException('That path was not declared for this batch');
    if (row.status === 'ready') return this.toDto(batchId); // idempotent re-send

    await this.prisma.uploadBatchFile.update({
      where: { id: row.id },
      data: { status: 'uploading', error: null },
    });

    try {
      const parts = cleanPath.split('/').filter(Boolean);
      const segments = parts.slice(0, -1);
      const folderId = await this.folders.ensurePath(
        batch.roomId,
        batch.roomModuleId!,
        batch.folderId,
        segments,
      );
      const { document } = await this.writer.createOrReplace({
        roomId: batch.roomId,
        roomModuleId: batch.roomModuleId!,
        folderId,
        userId,
        // The document name comes from the dropped path, not the multipart
        // filename (a resumable client may send parts under a generic name).
        file: { ...file, originalname: parts.at(-1) ?? file.originalname },
      });
      await this.prisma.uploadBatchFile.update({
        where: { id: row.id },
        data: { status: 'ready', documentId: document.id, byteSize: BigInt(file.buffer.length) },
      });
    } catch (err) {
      await this.prisma.uploadBatchFile.update({
        where: { id: row.id },
        data: { status: 'failed', error: (err as Error).message.slice(0, 500) },
      });
      this.logger.warn(`Batch ${batchId} file "${cleanPath}" failed: ${(err as Error).message}`);
    }

    await this.refreshTotals(batchId);
    return this.toDto(batchId);
  }

  async complete(userId: string, batchId: string): Promise<UploadBatchDto> {
    const batch = await this.loadBatch(userId, batchId);
    await this.access.requireWritableRoom(batch.roomId);
    const counts = await this.prisma.uploadBatchFile.groupBy({
      by: ['status'],
      where: { batchId },
      _count: true,
    });
    const failed = counts.find((c) => c.status === 'failed')?._count ?? 0;
    const pending = counts
      .filter((c) => c.status === 'queued' || c.status === 'uploading' || c.status === 'processing')
      .reduce((n, c) => n + c._count, 0);

    const status = pending > 0 ? 'uploading' : failed > 0 ? 'failed' : 'completed';
    await this.prisma.uploadBatch.update({
      where: { id: batchId },
      data: { status, finishedAt: pending > 0 ? null : new Date() },
    });
    await this.audit.record({
      action: 'upload_batch.completed',
      roomId: (await this.prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } })).roomId,
      targetType: 'upload_batch',
      targetId: batchId,
      metadata: { status, failed },
    });
    return this.toDto(batchId);
  }

  async get(userId: string, batchId: string): Promise<UploadBatchDto> {
    await this.loadBatch(userId, batchId);
    return this.toDto(batchId);
  }

  private async loadBatch(userId: string, batchId: string): Promise<UploadBatch> {
    const batch = await this.prisma.uploadBatch.findUnique({ where: { id: batchId } });
    if (!batch || !batch.roomModuleId) throw new NotFoundException('Upload batch not found');
    await this.access.requireRole(userId, batch.roomId, 'contributor');
    return batch;
  }

  private async refreshTotals(batchId: string): Promise<void> {
    const agg = await this.prisma.uploadBatchFile.aggregate({
      where: { batchId },
      _sum: { byteSize: true },
    });
    await this.prisma.uploadBatch.update({
      where: { id: batchId },
      data: { bytesTotal: agg._sum.byteSize ?? BigInt(0) },
    });
  }

  private async toDto(batchId: string): Promise<UploadBatchDto> {
    const batch = await this.prisma.uploadBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: { files: { orderBy: { relativePath: 'asc' } } },
    });
    return {
      id: batch.id,
      status: batch.status,
      fileCount: batch.fileCount,
      bytesTotal: Number(batch.bytesTotal),
      files: batch.files.map((f) => ({
        relativePath: f.relativePath,
        status: f.status,
        error: f.error,
        documentId: f.documentId,
      })),
    };
  }
}
