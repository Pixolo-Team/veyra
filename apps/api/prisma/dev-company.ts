/**
 * The seeded discloser tenant, shared by `seed.ts` and `dev-user.ts`.
 *
 * Deliberately *not* named after the platform. A tenant company is a customer
 * that discloses a dossier — calling it "Veyra Pharma" made the vendor and a
 * customer look like the same entity. These names match the ones the wireframes
 * and PRD already use (Corvellis discloses, Astrivax receives).
 */
import type { PrismaClient, Prisma } from '@prisma/client';

export const COMPANY_ID = 'seed-company-corvellis';
export const COMPANY_NAME = 'Corvellis Biopharma';
export const COMPANY_DOMAIN = 'corvellis.com';

/** Older dev databases seeded this row under the platform's own name. */
const LEGACY_ID = 'seed-company-veyra-pharma';

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Returns the discloser company with its tenant, creating it if absent and
 * renaming a legacy row in place — a rename keeps the rooms already hanging off
 * that company, which a delete-and-reseed would throw away.
 */
export async function ensureDiscloserCompany(prisma: PrismaClient) {
  const legacy = await prisma.company.findUnique({ where: { id: LEGACY_ID } });

  if (legacy) {
    await prisma.company.update({
      where: { id: LEGACY_ID },
      data: {
        name: COMPANY_NAME,
        legalName: `${COMPANY_NAME} Ltd.`,
        primaryDomain: COMPANY_DOMAIN,
      },
    });
    await upsertDomain(prisma, LEGACY_ID);
    return withTenant(prisma, LEGACY_ID);
  }

  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: { name: COMPANY_NAME, legalName: `${COMPANY_NAME} Ltd.`, primaryDomain: COMPANY_DOMAIN },
    create: {
      id: COMPANY_ID,
      name: COMPANY_NAME,
      legalName: `${COMPANY_NAME} Ltd.`,
      primaryDomain: COMPANY_DOMAIN,
    },
  });
  await upsertDomain(prisma, COMPANY_ID);
  return withTenant(prisma, COMPANY_ID);
}

async function upsertDomain(prisma: Tx, companyId: string): Promise<void> {
  const existing = await prisma.companyDomain.findFirst({
    where: { companyId, domain: COMPANY_DOMAIN },
  });
  if (!existing) {
    await prisma.companyDomain.create({
      data: { companyId, domain: COMPANY_DOMAIN, verified: true },
    });
  }
}

async function withTenant(prisma: PrismaClient, companyId: string) {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    include: { tenant: true },
  });
  const tenant =
    company.tenant ??
    (await prisma.tenant.create({ data: { companyId, plan: 'pilot', status: 'active' } }));
  return { company, tenant };
}
