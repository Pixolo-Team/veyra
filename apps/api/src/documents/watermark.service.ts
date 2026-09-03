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
  /** The company the viewer is in this room on behalf of. */
  company: string | null;
}

/**
 * Watermarked renditions (D9). The un-stamped PDF never reaches the browser
 * once `room.watermark_enabled` is on. Stamped lazily on first view and cached
 * on `(version, participant)` in `document_renditions`; a template change bumps
 * `template_hash` and stale rows fall out.
 *
 * The mark itself names the reader's *company* by default — see `text` — while
 * the cache stays per participant, so a room that switches to a per-reader
 * template gets correct copies without a migration.
 *
 * The mark is burned into every page's content stream server-side, which is the
 * point: it survives a download, where an overlay drawn by the browser would
 * not.
 *
 * It is stamped as pdf-lib *text*, so it lands in the extractable text layer
 * and a reader dragging across a page selects the watermark along with the
 * prose. The viewer is told the exact string (see `DocumentsService.contentUrl`)
 * and drops those spans, which keeps both selections and quote anchors clean.
 * That is a patch over the real fix: the mark belongs in vector outlines, where
 * it cannot be extracted as text at all. Doing that needs a glyph-outline
 * pipeline pdf-lib does not provide, so it is deliberately deferred — but until
 * it lands, any *other* consumer of these renditions inherits the problem.
 */
@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * The mark as it is stamped. Public because the viewer needs the exact string
   * to keep it out of text selections — see `DocumentsService.contentUrl`.
   */
  textFor(room: Room, viewer: Viewer): string {
    return this.text(room, viewer);
  }

  /**
   * The default mark names the *company*, not the person.
   *
   * A page that leaves the room leaves as an organisation's copy — which is
   * the unit a discloser acts on when something turns up where it shouldn't —
   * and a reader's own email tiled across every page of a 600-page report is
   * a lot of personal data to burn into a file that then gets forwarded
   * internally. The person is still recorded: every open writes a
   * `document.viewed` audit event against the participant, and the rendition
   * row keeps the copy they were served.
   *
   * `{name}` and `{email}` still resolve, so a room that deliberately wants a
   * per-reader mark sets `watermarkTemplate` and gets one.
   */
  private text(room: Room, viewer: Viewer): string {
    const template = room.watermarkTemplate ?? '{company} · {date}';
    return template
      .replaceAll('{company}', viewer.company ?? room.name)
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
