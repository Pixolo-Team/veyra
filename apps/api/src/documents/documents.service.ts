import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  DocumentDetail,
  MoveDocumentRequest,
  RecordViewRequest,
} from '@veyra/contracts';

/**
 * The longest single sitting the log will believe.
 *
 * A browser reports the time between opening a document and leaving it, which
 * includes the hours a tab spent behind other windows. Eight hours is already
 * generous for one document; past that the number says more about the tab than
 * the reader.
 */
const MAX_READ_SECONDS = 8 * 60 * 60;
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomAccessService } from '../rooms/room-access.service';
import { STORAGE_SIGNED_URL_TTL_SECONDS, StorageService } from '../storage/storage.service';
import { DocumentWriter, type IncomingFile, sanitizeName } from './document-writer';
import { toDocumentDto, toVersionDto } from './dto';
import { WatermarkService } from './watermark.service';

interface UploadInput {
  roomModuleId: string;
  folderId?: string | null;
  file: IncomingFile;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RoomAccessService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly watermark: WatermarkService,
    private readonly writer: DocumentWriter,
  ) {}

  async upload(userId: string, roomId: string, input: UploadInput): Promise<DocumentDetail> {
    await this.access.requireWriteRole(userId, roomId, 'contributor');

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

    const { document, created } = await this.writer.createOrReplace({
      roomId,
      roomModuleId: roomModule.id,
      folderId: input.folderId ?? null,
      userId,
      file: input.file,
    });

    await this.audit.record({
      action: created ? 'document.uploaded' : 'document.version_added',
      roomId,
      targetType: 'document',
      targetId: document.id,
      metadata: { name: document.name },
    });
    return this.get(userId, document.id);
  }

  /** Replace the file → a new version. Threads on v(n) will need re-anchoring to
   *  v(n+1) (D4) — that job is not built yet, so this just advances the pointer. */
  async addVersion(
    userId: string,
    documentId: string,
    file: UploadInput['file'],
  ): Promise<DocumentDetail> {
    const document = await this.loadDocument(userId, documentId, 'contributor');
    const nextNo = await this.writer.appendVersion(document, userId, file);

    await this.audit.record({
      action: 'document.version_added',
      roomId: document.roomId,
      targetType: 'document',
      targetId: document.id,
      metadata: { versionNo: nextNo },
    });
    return this.get(userId, documentId);
  }

  async get(userId: string, documentId: string): Promise<DocumentDetail> {
    const document = await this.loadDocument(userId, documentId, 'reviewer');
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { versionNo: 'desc' },
    });
    const current = versions.find((v) => v.id === document.currentVersionId) ?? null;
    return {
      ...toDocumentDto({ ...document, currentVersion: current }),
      roomModuleId: document.roomModuleId,
      versions: versions.map(toVersionDto),
    };
  }

  async rename(userId: string, documentId: string, name: string): Promise<void> {
    const document = await this.loadDocument(userId, documentId, 'contributor');
    await this.prisma.document.update({ where: { id: document.id }, data: { name: sanitizeName(name) } });
    await this.audit.record({ action: 'document.renamed', roomId: document.roomId, targetType: 'document', targetId: document.id });
  }

  async move(userId: string, documentId: string, input: MoveDocumentRequest): Promise<void> {
    const document = await this.loadDocument(userId, documentId, 'contributor');
    const roomModuleId = input.roomModuleId ?? document.roomModuleId;

    if (input.roomModuleId) {
      const rm = await this.prisma.roomModule.findFirst({ where: { id: roomModuleId, roomId: document.roomId } });
      if (!rm) throw new BadRequestException('Target module not found in this room');
    }
    if (input.folderId) {
      const folder = await this.prisma.folder.findFirst({
        where: { id: input.folderId, roomId: document.roomId, roomModuleId, deletedAt: null },
      });
      if (!folder) throw new BadRequestException('Target folder not found in that module');
    }
    await this.prisma.document.update({
      where: { id: document.id },
      data: { folderId: input.folderId, roomModuleId },
    });
    await this.audit.record({ action: 'document.moved', roomId: document.roomId, targetType: 'document', targetId: document.id });
  }

  async softDelete(userId: string, documentId: string): Promise<void> {
    const document = await this.loadDocument(userId, documentId, 'contributor');
    await this.prisma.document.update({ where: { id: document.id }, data: { deletedAt: new Date() } });
    await this.audit.record({ action: 'document.deleted', roomId: document.roomId, targetType: 'document', targetId: document.id });
  }

  /** A short-TTL URL the viewer can GET. Watermarked renditions (D9) are a later
   *  layer — for now this serves the rendered PDF (or the original). */
  async contentUrl(
    userId: string,
    versionId: string,
  ): Promise<{ url: string; expiresInSeconds: number; watermark: string | null }> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { room: true } } },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('Version not found');
    const participant = await this.access.requireParticipant(userId, version.document.roomId);
    const room = version.document.room;

    let key: string;
    let watermark: string | null = null;
    if (room.watermarkEnabled && version.mimeType === 'application/pdf' && version.renderStatus === 'ready') {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      // The mark names the company the reader is here on behalf of, not the
      // reader — see WatermarkService.text.
      const company = await this.prisma.company.findUnique({
        where: { id: participant.companyId },
        select: { name: true },
      });
      const viewer = { participant, name: user.name, email: user.email, company: company?.name ?? null };
      key = await this.watermark.keyFor(version, room, viewer);
      // The mark is stamped as real text, so it is extractable — the viewer
      // needs the string to keep it out of selections and quote anchors.
      watermark = this.watermark.textFor(room, viewer);
    } else {
      key = version.renderedPdfKey ?? version.storageKey;
    }

    // targetId is the *document* so "counterparty reading" counts distinct docs.
    await this.audit.record({
      action: 'document.viewed',
      roomId: version.document.roomId,
      actorParticipantId: participant.id,
      targetType: 'document',
      targetId: version.document.id,
    });
    return {
      watermark,
      url: await this.storage.getSignedUrl(key),
      expiresInSeconds: STORAGE_SIGNED_URL_TTL_SECONDS,
    };
  }

  /** Download the *original* file — gated by the room toggle (D8) and the
   *  participant's download capability. */
  /**
   * Records how long a reader had a document open.
   *
   * Separate from `document.viewed`, which fires when the file is opened: the
   * pair is what turns "they looked at it" into "they read it for four
   * minutes", which is the question a data room is usually asked. The reader's
   * own clock is the only one that knows, so the number arrives from the
   * browser and is bounded here rather than trusted — a tab left open all
   * weekend is not three days of reading, and nor is a hostile client's
   * arithmetic.
   */
  async recordView(
    userId: string,
    versionId: string,
    input: RecordViewRequest,
  ): Promise<void> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: true },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('Version not found');
    const participant = await this.access.requireParticipant(userId, version.document.roomId);

    await this.audit.record({
      action: 'document.read',
      roomId: version.document.roomId,
      actorParticipantId: participant.id,
      targetType: 'document',
      targetId: version.document.id,
      metadata: {
        seconds: Math.min(input.seconds, MAX_READ_SECONDS),
        versionId,
        ...(input.pagesRead ? { pagesRead: input.pagesRead } : {}),
      },
    });
  }

  async downloadUrl(userId: string, versionId: string): Promise<{ url: string; expiresInSeconds: number }> {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { room: true } } },
    });
    if (!version || version.document.deletedAt) throw new NotFoundException('Version not found');

    const participant = await this.access.requireParticipant(userId, version.document.roomId);
    if (!version.document.room.allowDownload) {
      throw new ForbiddenException('Downloads are disabled for this room');
    }
    const granted =
      participant.role !== 'reviewer' ||
      (await this.prisma.participantCapability.findFirst({
        where: { participantId: participant.id, capability: 'download', allow: true, scopeType: 'room' },
      })) !== null;
    if (!granted) throw new ForbiddenException('You do not have download access in this room');

    await this.audit.record({
      action: 'document.downloaded',
      roomId: version.document.roomId,
      actorParticipantId: participant.id,
      targetType: 'document_version',
      targetId: version.id,
    });
    return {
      url: await this.storage.getSignedUrl(version.storageKey),
      expiresInSeconds: STORAGE_SIGNED_URL_TTL_SECONDS,
    };
  }

  private async loadDocument(userId: string, documentId: string, min: 'reviewer' | 'contributor') {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');
    // 'reviewer' is only ever the read path; 'contributor' means a mutation follows.
    if (min === 'contributor') {
      await this.access.requireWriteRole(userId, document.roomId, min);
    } else {
      await this.access.requireRole(userId, document.roomId, min);
    }
    return document;
  }
}
