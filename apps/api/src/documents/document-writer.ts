import { createHash } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { Document } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface IncomingFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

export function sanitizeName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file';
  return base.replace(/[^\w.\- ()]+/g, '_').slice(0, 200) || 'file';
}

/**
 * The one place a `document_version` is written and bytes hit storage. Shared by
 * the single-file upload, the replace-a-file flow, and folder-drop batches so
 * they can't drift apart.
 */
@Injectable()
export class DocumentWriter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Create the document, or add a version to the one that already occupies
   *  (module, folder, name). Returns whether it was newly created. */
  async createOrReplace(opts: {
    roomId: string;
    roomModuleId: string;
    folderId: string | null;
    userId: string;
    file: IncomingFile;
  }): Promise<{ document: Document; created: boolean }> {
    const name = sanitizeName(opts.file.originalname);
    const existing = await this.prisma.document.findFirst({
      where: {
        roomId: opts.roomId,
        roomModuleId: opts.roomModuleId,
        folderId: opts.folderId,
        name,
        deletedAt: null,
      },
    });
    if (existing) {
      await this.appendVersion(existing, opts.userId, opts.file);
      return { document: existing, created: false };
    }
    const document = await this.prisma.document.create({
      data: {
        roomId: opts.roomId,
        roomModuleId: opts.roomModuleId,
        folderId: opts.folderId,
        name,
        createdBy: opts.userId,
      },
    });
    await this.writeVersion(document, 1, opts.userId, opts.file);
    return { document, created: true };
  }

  async appendVersion(document: Document, userId: string, file: IncomingFile): Promise<number> {
    const latest = await this.prisma.documentVersion.findFirst({
      where: { documentId: document.id },
      orderBy: { versionNo: 'desc' },
      select: { versionNo: true },
    });
    const nextNo = (latest?.versionNo ?? 0) + 1;
    await this.writeVersion(document, nextNo, userId, file);
    return nextNo;
  }

  private async writeVersion(
    document: Document,
    versionNo: number,
    userId: string,
    file: IncomingFile,
  ): Promise<void> {
    if (!file?.buffer?.length) throw new BadRequestException('Empty file');
    const isPdf = file.mimetype === 'application/pdf';
    const key = `rooms/${document.roomId}/docs/${document.id}/v${versionNo}/${sanitizeName(file.originalname)}`;
    await this.storage.put(key, file.buffer, file.mimetype);

    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNo,
        storageKey: key,
        byteSize: BigInt(file.buffer.length),
        checksumSha256: createHash('sha256').update(file.buffer).digest('hex'),
        mimeType: file.mimetype,
        // Native PDFs are viewable as-is; everything else waits on the (not yet
        // built) Office→PDF conversion job (D2).
        renderStatus: isPdf ? 'ready' : 'pending',
        renderedPdfKey: isPdf ? key : null,
        uploadedBy: userId,
      },
    });
    await this.prisma.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id },
    });
  }
}
