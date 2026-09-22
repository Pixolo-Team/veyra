/**
 * Dashboard demo seed — one login per role for the acceptance test:
 *
 *   D1  discloser + admin       d1.demo@corvellis.com
 *   D2  discloser + contributor d2.demo@corvellis.com
 *   R1  recipient + admin       r1.demo@astrivax.com
 *   R2  recipient + contributor r2.demo@astrivax.com
 *
 * All share one password (override with DEMO_PASSWORD, default
 * `VeyraDemo2026!`). The demo room has NDA disabled so each login lands
 * straight on the Overview dashboard, and carries just enough content —
 * documents, a viewed/read trail, a download, threads with a mention, and one
 * pending invite — that every dashboard block has something to show.
 *
 * Safe to re-run: users, companies, room and participants are upserted, and
 * sample content is only created when the room has no documents yet.
 *
 * Run: npm run db:seed-dashboard  (from apps/api)
 */
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { ensureDiscloserCompany } from './dev-company';

const prisma = new PrismaClient();

const PASSWORD = process.env.DEMO_PASSWORD ?? 'VeyraDemo2026!';
const ROOM_NAME = 'Elacitinib — Demo Dataroom';

const RECIPIENT_COMPANY_ID = 'seed-company-astrivax';
const RECIPIENT_COMPANY_NAME = 'Astrivax Therapeutics';
const RECIPIENT_DOMAIN = 'astrivax.com';

const DEMO_USERS = [
  { email: 'd1.demo@corvellis.com', name: 'Demo Disclosure Admin', side: 'discloser', role: 'admin' },
  { email: 'd2.demo@corvellis.com', name: 'Demo Disclosure Contributor', side: 'discloser', role: 'contributor' },
  { email: 'r1.demo@astrivax.com', name: 'Demo Recipient Admin', side: 'recipient', role: 'admin' },
  { email: 'r2.demo@astrivax.com', name: 'Demo Recipient Contributor', side: 'recipient', role: 'contributor' },
] as const;

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create known-password accounts in production.');
  }

  const { company: discloser, tenant } = await ensureDiscloserCompany(prisma);

  const recipient = await prisma.company.upsert({
    where: { id: RECIPIENT_COMPANY_ID },
    update: { name: RECIPIENT_COMPANY_NAME, primaryDomain: RECIPIENT_DOMAIN },
    create: {
      id: RECIPIENT_COMPANY_ID,
      name: RECIPIENT_COMPANY_NAME,
      legalName: `${RECIPIENT_COMPANY_NAME} Ltd.`,
      primaryDomain: RECIPIENT_DOMAIN,
    },
  });
  const existingDomain = await prisma.companyDomain.findFirst({
    where: { companyId: recipient.id, domain: RECIPIENT_DOMAIN },
  });
  if (!existingDomain) {
    await prisma.companyDomain.create({
      data: { companyId: recipient.id, domain: RECIPIENT_DOMAIN, verified: true },
    });
  }

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const users = new Map<string, { id: string; email: string; name: string | null }>();
  for (const demo of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { passwordHash, status: 'active', name: demo.name },
      create: { email: demo.email, name: demo.name, passwordHash, status: 'active' },
    });
    users.set(demo.email, user);
  }

  let room = await prisma.room.findFirst({
    where: { tenantId: tenant.id, name: ROOM_NAME },
  });
  if (!room) {
    room = await prisma.room.create({
      data: {
        tenantId: tenant.id,
        name: ROOM_NAME,
        status: 'active',
        creatorSide: 'discloser',
        discloserCompanyId: discloser.id,
        recipientCompanyId: recipient.id,
        // No NDA click-through on the demo room — the acceptance test is the
        // dashboard, not the gate.
        ndaRequired: false,
        allowDownload: true,
        watermarkEnabled: true,
      },
    });
    await prisma.roomModule.createMany({
      data: [
        { roomId: room.id, code: '1', title: 'Administrative Information', sortOrder: 0, section: 'dossier' },
        { roomId: room.id, code: '2', title: 'Summaries', sortOrder: 1, section: 'dossier' },
        { roomId: room.id, code: '3', title: 'Quality', sortOrder: 2, section: 'dossier' },
      ],
    });
  }

  const participants = new Map<string, { id: string }>();
  for (const demo of DEMO_USERS) {
    const user = users.get(demo.email)!;
    const participant = await prisma.roomParticipant.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
      update: {
        side: demo.side,
        role: demo.role,
        status: 'active',
        companyId: demo.side === 'discloser' ? discloser.id : recipient.id,
        acceptedAt: new Date(),
        ndaAcceptedAt: new Date(),
      },
      create: {
        roomId: room.id,
        userId: user.id,
        companyId: demo.side === 'discloser' ? discloser.id : recipient.id,
        side: demo.side,
        role: demo.role,
        status: 'active',
        acceptedAt: new Date(),
        ndaAcceptedAt: new Date(),
      },
    });
    participants.set(demo.email, participant);
  }

  // One invite left to accept, so the admin dashboards show it.
  const pendingInvites = await prisma.invitation.count({
    where: { roomId: room.id, status: 'pending' },
  });
  if (pendingInvites === 0) {
    const { randomBytes, createHash } = await import('node:crypto');
    const token = randomBytes(32).toString('hex');
    await prisma.invitation.create({
      data: {
        roomId: room.id,
        email: 'new.reviewer@astrivax.com',
        companyId: recipient.id,
        side: 'recipient',
        role: 'reviewer',
        tokenHash: createHash('sha256').update(token).digest('hex'),
        status: 'pending',
        expiresAt: new Date(Date.now() + 14 * 24 * 3600_000),
      },
    });
  }

  // Sample content only on a fresh room — never duplicate a lived-in one.
  const docCount = await prisma.document.count({ where: { roomId: room.id, deletedAt: null } });
  if (docCount === 0) {
    const module = await prisma.roomModule.findFirstOrThrow({
      where: { roomId: room.id, section: 'dossier' },
      orderBy: { sortOrder: 'asc' },
    });
    const d1 = participants.get('d1.demo@corvellis.com')!;
    const r1 = participants.get('r1.demo@astrivax.com')!;
    const r2 = participants.get('r2.demo@astrivax.com')!;

    const docs = [];
    for (const name of ['1.0 Cover letter', '1.2 Application form', '2.2 Introduction']) {
      const doc = await prisma.document.create({
        data: { roomId: room.id, roomModuleId: module.id, name },
      });
      // Two versions on the first doc so "revised" is non-zero.
      const versions = name === '1.0 Cover letter' ? [1, 2] : [1];
      for (const versionNo of versions) {
        await prisma.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNo,
            storageKey: `seed/${doc.id}/v${versionNo}.pdf`,
            byteSize: 1024,
            mimeType: 'application/pdf',
            renderStatus: 'ready',
          },
        });
      }
      const current = await prisma.documentVersion.findFirstOrThrow({
        where: { documentId: doc.id },
        orderBy: { versionNo: 'desc' },
      });
      await prisma.document.update({ where: { id: doc.id }, data: { currentVersionId: current.id } });
      docs.push({ doc, version: current });
    }

    // Recipient opened two of three docs; R1 read, R2 skimmed; one download.
    for (const { doc } of docs.slice(0, 2)) {
      await prisma.auditEvent.create({
        data: {
          roomId: room.id,
          actorParticipantId: r1.id,
          action: 'document.viewed',
          targetType: 'document',
          targetId: doc.id,
        },
      });
    }
    await prisma.auditEvent.create({
      data: {
        roomId: room.id,
        actorParticipantId: r1.id,
        action: 'document.read',
        targetType: 'document',
        targetId: docs[0].doc.id,
        metadata: { seconds: 320, versionId: docs[0].version.id },
      },
    });
    await prisma.auditEvent.create({
      data: {
        roomId: room.id,
        actorParticipantId: r2.id,
        action: 'document.read',
        targetType: 'document',
        targetId: docs[1].doc.id,
        metadata: { seconds: 95, versionId: docs[1].version.id },
      },
    });
    await prisma.auditEvent.create({
      data: {
        roomId: room.id,
        actorParticipantId: r1.id,
        action: 'document.downloaded',
        targetType: 'document_version',
        targetId: docs[0].version.id,
      },
    });

    // One open room thread mentioning R2, one resolved side thread.
    const openThread = await prisma.commentThread.create({
      data: {
        roomId: room.id,
        documentVersionId: docs[0].version.id,
        visibility: 'room',
        createdBy: r1.id,
      },
    });
    const firstComment = await prisma.comment.create({
      data: {
        threadId: openThread.id,
        authorParticipantId: r1.id,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Could you confirm the signatory on this cover letter?' }] }] },
      },
    });
    await prisma.commentMention.create({
      data: { commentId: firstComment.id, participantId: r2.id },
    });
    void d1;

    const closedThread = await prisma.commentThread.create({
      data: {
        roomId: room.id,
        documentVersionId: docs[1].version.id,
        visibility: 'side',
        status: 'resolved',
        createdBy: r2.id,
        resolvedBy: r1.id,
        resolvedAt: new Date(Date.now() - 2 * 3600_000),
        createdAt: new Date(Date.now() - 26 * 3600_000),
      },
    });
    await prisma.comment.create({
      data: {
        threadId: closedThread.id,
        authorParticipantId: r2.id,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Typo on page 2 — fixed in v2?' }] }] },
        createdAt: new Date(Date.now() - 26 * 3600_000),
      },
    });
    await prisma.comment.create({
      data: {
        threadId: closedThread.id,
        authorParticipantId: r1.id,
        body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confirmed, closing.' }] }] },
        createdAt: new Date(Date.now() - 25 * 3600_000),
      },
    });
  }

  console.log(`Demo room ready: ${ROOM_NAME} (${room.id})`);
  for (const demo of DEMO_USERS) {
    console.log(`  ${demo.side}/${demo.role}: ${demo.email}`);
  }
  console.log(`  password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
