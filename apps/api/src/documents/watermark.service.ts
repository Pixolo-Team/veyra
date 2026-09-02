import { createHash } from 'node:crypto';
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import type { DocumentVersion, Room, RoomParticipant } from '@prisma/client';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

interface Viewer {
  participant: RoomParticipant;
  name: string | null;
  email: string;
}

/**
 * Per-viewer watermarked renditions (D9). The un-stamped PDF never reaches the
 * browser once `room.watermark_enabled` is on. Stamped lazily on first view and
 * cached on `(version, participant)` in `document_renditions`; a template change
 * bumps `template_hash` and stale rows fall out.
 *
 * The mark is burned into every page's content stream server-side. NOTE: this
 * uses pdf-lib text, which lands in the extractable text layer — acceptable
 * while text-quote anchoring on converted documents (D4) is not yet built, but
 * before that ships the mark must move to a raster/vector stamp so it can't
 * corrupt anchors.
 */
@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private text(room: Room, viewer: Viewer): string {
    const template = room.watermarkTemplate ?? '{name} · {email} · {date}';
    return template
      .replaceAll('{name}', viewer.name ?? viewer.email)
      .replaceAll('{email}', viewer.email)
      .replaceAll('{date}', new Date().toISOString().slice(0, 10))
      .replaceAll('{room}', room.name);
  }

  /** Returns the storage key of the viewer's stamped copy, creating it if needed. */
  async keyFor(version: DocumentVersion, room: Room, viewer: Viewer): Promise<string> {
    const watermarkText = this.text(room, viewer);
    const templateHash = createHash('sha256')
      .update(`${room.watermarkTemplate ?? ''}::${viewer.participant.id}::${watermarkText}`)
      .digest('hex');

    const existing = await this.prisma.documentRendition.findUnique({
      where: {
        documentVersionId_participantId: {
          documentVersionId: version.id,
          participantId: viewer.participant.id,
        },
      },
    });
    if (existing && existing.templateHash === templateHash) return existing.storageKey;

    const sourceKey = version.renderedPdfKey ?? version.storageKey;
    const stamped = await this.stamp(await this.storage.get(sourceKey), watermarkText);
    const key = `rooms/${room.id}/renditions/${version.id}/${viewer.participant.id}.pdf`;
    await this.storage.put(key, stamped, 'application/pdf');

    await this.prisma.documentRendition.upsert({
      where: {
        documentVersionId_participantId: {
          documentVersionId: version.id,
          participantId: viewer.participant.id,
        },
      },
      create: {
        documentVersionId: version.id,
        participantId: viewer.participant.id,
        storageKey: key,
        watermarkText,
        templateHash,
        byteSize: BigInt(stamped.length),
      },
      update: { storageKey: key, watermarkText, templateHash, byteSize: BigInt(stamped.length) },
    });
    this.logger.log(`Stamped v${version.versionNo} for participant ${viewer.participant.id}`);
    return key;
  }

  private async stamp(pdfBytes: Buffer, text: string): Promise<Buffer> {
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    } catch (err) {
      this.logger.warn(`Un-stampable PDF: ${(err as Error).message}`);
      throw new UnprocessableEntityException('This document could not be prepared for viewing');
    }
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const size = 24;
    const gray = rgb(0.6, 0.6, 0.6);

    for (const page of pdf.getPages()) {
      const { width, height } = page.getSize();
      const step = 220;
      for (let y = -height; y < height * 2; y += step) {
        for (let x = -width; x < width * 2; x += step * 1.6) {
          page.drawText(text, {
            x,
            y,
            size,
            font,
            color: gray,
            opacity: 0.12,
            rotate: degrees(45),
          });
        }
      }
    }
    return Buffer.from(await pdf.save());
  }
}
