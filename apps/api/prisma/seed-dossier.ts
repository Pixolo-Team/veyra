/**
 * Replaces every room's dossier with the reference CTD structure.
 *
 * Destructive on purpose: it deletes the folders and documents of each room it
 * touches (and, by cascade, their versions, annotations and comment threads)
 * before rebuilding. That is what makes it a *seed* rather than an import —
 * running it twice leaves the same tree, not two of them.
 *
 * Refuses to run against production, and refuses without `--yes`, because the
 * thing it empties is the thing the product is for.
 *
 *   npm run db:seed-dossier -- --yes            (from apps/api)
 *   npm run db:seed-dossier -- --yes --room <id>
 */
import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STORAGE_ROOT = resolve(process.cwd(), process.env.STORAGE_LOCAL_ROOT ?? 'storage');

/**
 * The reference dossier, lifted from the Veyra Data Room design canvas.
 *
 * `[depth, kind, label]` — depth 1 is a CTD module, `F` is a folder and `L` a
 * document. Order is the tree's own; a node's parent is the nearest preceding
 * node one level shallower, which is all the nesting information a flat list
 * needs to carry.
 */
const DOSSIER: [depth: number, kind: 'F' | 'L', label: string][] = [
  [1, "F", "1 Administrative information and prescribing information"],
  [2, "L", "1.0 Cover letter"],
  [2, "L", "1.2 Application form"],
  [2, "F", "1.3 Product information"],
  [3, "L", "1.3.1 Summary of product characteristics"],
  [3, "L", "1.3.1 Labelling \u2014 outer and immediate"],
  [3, "L", "1.3.1 Package leaflet"],
  [2, "L", "1.4.2 Quality expert declaration"],
  [2, "L", "1.6 Environmental risk assessment"],
  [2, "L", "1.8.2 Risk management plan v4.1"],
  [1, "F", "2 Common technical document summaries"],
  [2, "L", "2.2 Introduction"],
  [2, "F", "2.3 Quality overall summary"],
  [3, "L", "2.3.S Drug substance \u2014 elacitinib"],
  [3, "L", "2.3.P Drug product"],
  [3, "L", "2.3.R Regional information"],
  [2, "L", "2.4 Nonclinical overview"],
  [2, "L", "2.5 Clinical overview"],
  [2, "F", "2.6 Nonclinical written and tabulated summaries"],
  [3, "L", "2.6.2 Pharmacology written summary"],
  [3, "L", "2.6.4 Pharmacokinetics written summary"],
  [3, "L", "2.6.6 Toxicology written summary"],
  [2, "F", "2.7 Clinical summary"],
  [3, "L", "2.7.1 Biopharmaceutic studies"],
  [3, "L", "2.7.2 Clinical pharmacology studies"],
  [3, "L", "2.7.3 Summary of clinical efficacy"],
  [3, "L", "2.7.4 Summary of clinical safety"],
  [1, "F", "3 Quality"],
  [2, "F", "3.2 Body of data"],
  [3, "F", "3.2.S Drug substance \u2014 elacitinib"],
  [4, "F", "3.2.S.1 General information"],
  [5, "L", "3.2.S.1.1 Nomenclature"],
  [5, "L", "3.2.S.1.2 Structure"],
  [5, "L", "3.2.S.1.3 General properties"],
  [4, "F", "3.2.S.2 Manufacture"],
  [5, "L", "3.2.S.2.1 Manufacturer(s)"],
  [5, "L", "3.2.S.2.2 Description of manufacturing process"],
  [5, "L", "3.2.S.2.3 Control of materials"],
  [5, "L", "3.2.S.2.4 Controls of critical steps and intermediates"],
  [5, "L", "3.2.S.2.5 Process validation"],
  [4, "L", "3.2.S.3.2 Impurities"],
  [4, "F", "3.2.S.4 Control of drug substance"],
  [5, "L", "3.2.S.4.1 Specification"],
  [5, "L", "3.2.S.4.2 Analytical procedures"],
  [5, "L", "3.2.S.4.4 Batch analyses"],
  [4, "L", "3.2.S.6 Container closure system"],
  [4, "L", "3.2.S.7 Stability \u2014 drug substance"],
  [3, "F", "3.2.P Drug product"],
  [4, "F", "3.2.P.1 Description and composition"],
  [5, "L", "Composition \u2014 50 mg film-coated tablet"],
  [4, "L", "3.2.P.2 Pharmaceutical development"],
  [4, "F", "3.2.P.3 Manufacture"],
  [5, "L", "3.2.P.3.1 Manufacturer(s)"],
  [5, "L", "3.2.P.3.2 Batch formula"],
  [5, "L", "3.2.P.3.3 Description of process and process controls"],
  [5, "L", "3.2.P.3.5 Process validation \u2014 PPQ report"],
  [4, "L", "3.2.P.4 Control of excipients"],
  [4, "F", "3.2.P.5 Control of drug product"],
  [5, "L", "3.2.P.5.1 Specification(s)"],
  [5, "L", "3.2.P.5.2 Analytical procedures"],
  [5, "L", "3.2.P.5.3 Validation of analytical procedures"],
  [5, "L", "3.2.P.5.4 Batch analyses"],
  [5, "L", "3.2.P.5.5 Characterisation of impurities"],
  [4, "L", "3.2.P.6 Reference standards or materials"],
  [4, "L", "3.2.P.7 Container closure system"],
  [4, "F", "3.2.P.8 Stability"],
  [5, "F", "3.2.P.8.1 Stability summary and conclusion"],
  [6, "L", "Stability summary \u2014 elacitinib 50 mg"],
  [5, "F", "3.2.P.8.2 Post-approval stability protocol"],
  [6, "L", "Post-approval stability commitment"],
  [5, "F", "3.2.P.8.3 Stability data"],
  [6, "L", "Stability data \u2014 long term 24 month"],
  [6, "L", "Stability data \u2014 accelerated 6 month"],
  [6, "L", "Stability data \u2014 photostability ICH Q1B"],
  [3, "F", "3.2.A Appendices"],
  [4, "L", "3.2.A.1 Facilities and equipment"],
  [4, "L", "3.2.A.2 Adventitious agents safety evaluation"],
  [3, "F", "3.2.R Regional information"],
  [4, "L", "3.2.R.1 Process validation scheme"],
  [4, "L", "3.2.R.3 Medical device \u2014 not applicable"],
  [1, "F", "4 Nonclinical study reports"],
  [2, "F", "4.2.1 Pharmacology"],
  [3, "L", "Primary pharmacodynamics \u2014 VP17-NC-004"],
  [3, "L", "Safety pharmacology core battery \u2014 VP17-NC-011"],
  [2, "F", "4.2.2 Pharmacokinetics"],
  [3, "L", "Absorption and distribution \u2014 rat and dog"],
  [3, "L", "Metabolism and excretion \u2014 VP17-NC-021"],
  [2, "F", "4.2.3 Toxicology"],
  [3, "L", "26-week repeat-dose toxicity \u2014 rat"],
  [3, "L", "39-week repeat-dose toxicity \u2014 dog"],
  [3, "L", "Genotoxicity battery \u2014 Ames, MLA, micronucleus"],
  [3, "L", "Reproductive and developmental toxicity"],
  [1, "F", "5 Clinical study reports"],
  [2, "L", "5.2 Tabular listing of all clinical studies"],
  [2, "F", "5.3.1 Biopharmaceutic study reports"],
  [3, "L", "Bioequivalence \u2014 Phase 2 to commercial tablet"],
  [2, "F", "5.3.3 Human PK study reports"],
  [3, "L", "VP-1017-102 hepatic impairment PK"],
  [3, "L", "VP-1017-104 drug interaction \u2014 itraconazole"],
  [2, "F", "5.3.5 Efficacy and safety study reports"],
  [3, "L", "VP-1017-201 clinical study report (final)"],
  [3, "L", "VP-1017-202 interim analysis"],
  [3, "L", "VP-1017-301 protocol and SAP"],
  [2, "L", "5.3.6 Post-marketing experience \u2014 not applicable"],
  [2, "L", "5.4 Literature references"],
];

/**
 * Extensions, so the tree shows the mix a real dossier has rather than a column
 * of identical PDFs. Anything unlisted is a PDF, which is what most of a CTD
 * submission actually is.
 */
const EXTENSION: [match: RegExp, extension: string][] = [
  [/batch analyses|batch formula|control of excipients|specification/i, 'xlsx'],
  [/cover letter|application form|declaration|term sheet|protocol and SAP/i, 'docx'],
  [/tabular listing|literature references/i, 'csv'],
];

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

function extensionFor(label: string): string {
  return EXTENSION.find(([match]) => match.test(label))?.[1] ?? 'pdf';
}

/**
 * A real, openable one-page PDF carrying the document's own title.
 *
 * Seeding rows that point at bytes which don't exist would give a dossier where
 * every document 404s on click — worse than an empty room, because it looks
 * populated. The recorded `byteSize` is this file's actual length: the design's
 * "42.1 MB" is a mock number, and a UI reporting a size the store doesn't hold
 * is a UI that lies.
 */
function placeholderPdf(title: string): Buffer {
  const text = title.replace(/[\\()]/g, '').slice(0, 90);
  const stream = `BT /F1 16 Tf 56 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

async function seedRoom(roomId: string, roomName: string): Promise<void> {
  const modules = await prisma.roomModule.findMany({
    where: { roomId, section: 'dossier' },
    orderBy: { sortOrder: 'asc' },
  });
  if (modules.length === 0) {
    console.log(`  ${roomName}: no dossier modules — skipped`);
    return;
  }

  // Documents first: a folder delete cascades to its children, but a document
  // row outlives its folder (`onDelete: SetNull`) and would be left orphaned.
  await prisma.document.deleteMany({ where: { roomId } });
  await prisma.folder.deleteMany({ where: { roomId } });
  await rm(join(STORAGE_ROOT, 'rooms', roomId), { recursive: true, force: true });

  const byCode = new Map(modules.map((m) => [m.code, m]));
  /** The open path: index `n` holds the folder id for depth `n`. */
  const parents: (string | null)[] = [];
  let currentModuleId: string | null = null;
  let folders = 0;
  let documents = 0;

  for (const [depth, kind, label] of DOSSIER) {
    if (depth === 1) {
      const code = label.split(' ')[0];
      currentModuleId = byCode.get(code)?.id ?? null;
      if (!currentModuleId) console.warn(`  no module ${code} in ${roomName}`);
      parents.length = 0;
      continue;
    }
    if (!currentModuleId) continue;

    const parentFolderId = parents[depth - 1] ?? null;

    if (kind === 'F') {
      const parent = parentFolderId
        ? await prisma.folder.findUniqueOrThrow({ where: { id: parentFolderId } })
        : null;
      const folder = await prisma.folder.create({
        data: {
          roomId,
          roomModuleId: currentModuleId,
          parentFolderId,
          name: label,
          path: parent ? `${parent.path}/${label}` : label,
          sortOrder: folders,
        },
      });
      parents[depth] = folder.id;
      // Anything deeper belonged to the previous branch, not this one.
      parents.length = depth + 1;
      folders += 1;
      continue;
    }

    const extension = extensionFor(label);
    const name = `${label}.${extension}`;
    const document = await prisma.document.create({
      data: { roomId, roomModuleId: currentModuleId, folderId: parentFolderId, name },
    });

    const bytes = placeholderPdf(label);
    const key = `rooms/${roomId}/docs/${document.id}/v1/${name.replace(/[^\w.\- ]+/g, '_')}`;
    await mkdir(dirname(join(STORAGE_ROOT, key)), { recursive: true });
    await writeFile(join(STORAGE_ROOT, key), bytes);

    const isPdf = extension === 'pdf';
    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNo: 1,
        storageKey: key,
        byteSize: BigInt(bytes.length),
        checksumSha256: createHash('sha256').update(bytes).digest('hex'),
        mimeType: MIME[extension],
        // The bytes are a PDF whatever the extension claims, but only the ones
        // that say so are servable as-is; the rest wait on the conversion job
        // the real upload path also waits on (D2).
        renderStatus: isPdf ? 'ready' : 'pending',
        renderedPdfKey: isPdf ? key : null,
      },
    });
    await prisma.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id },
    });
    documents += 1;
  }

  console.log(`  ${roomName}: ${folders} folders, ${documents} documents`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to empty rooms in production.');
  }
  if (!process.argv.includes('--yes')) {
    throw new Error(
      'This deletes every folder and document in the rooms it touches. Re-run with --yes.',
    );
  }

  const only = process.argv[process.argv.indexOf('--room') + 1];
  const rooms = await prisma.room.findMany({
    where: process.argv.includes('--room') ? { id: only } : {},
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (rooms.length === 0) throw new Error('No rooms to seed.');

  console.log(`Seeding the reference dossier into ${rooms.length} room(s):`);
  for (const room of rooms) await seedRoom(room.id, room.name);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
