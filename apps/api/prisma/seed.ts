/**
 * Operator-provisioning seed (D1, D11). Creates:
 *   - the `ctd` module template (Modules 1–5) that every room seeds from (D7)
 *   - one discloser Company + Tenant + first admin User, arriving on a
 *     one-time password they are forced to reset on first login
 *
 * Run: npm run db:seed  (from apps/api)
 */
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { COMPANY_DOMAIN, COMPANY_NAME, ensureDiscloserCompany } from './dev-company';

const prisma = new PrismaClient();

const CTD_MODULES = [
  { code: '1', title: 'Administrative Information and Prescribing Information' },
  { code: '2', title: 'Common Technical Document Summaries' },
  { code: '3', title: 'Quality' },
  { code: '4', title: 'Nonclinical Study Reports' },
  { code: '5', title: 'Clinical Study Reports' },
];

async function main(): Promise<void> {
  await prisma.moduleTemplate.upsert({
    where: { key: 'ctd' },
    update: {},
    create: {
      key: 'ctd',
      name: 'Common Technical Document',
      nodes: {
        create: CTD_MODULES.map((m, i) => ({ code: m.code, title: m.title, sortOrder: i })),
      },
    },
  });

  const operatorEmail = process.env.SEED_ADMIN_EMAIL ?? `admin@${COMPANY_DOMAIN}`;
  const oneTimePassword = process.env.SEED_ADMIN_OTP ?? randomBytes(9).toString('base64url');

  const { tenant } = await ensureDiscloserCompany(prisma);

  const user = await prisma.user.upsert({
    where: { email: operatorEmail },
    update: {},
    create: {
      email: operatorEmail,
      name: `${COMPANY_NAME} Admin`,
      status: 'invited', // forced reset until they set a real password (D11)
      passwordHash: await argon2.hash(oneTimePassword, { type: argon2.argon2id }),
    },
  });

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: { tenantId: tenant.id, userId: user.id, role: 'owner' },
  });

  console.log('Seeded CTD template + first admin.');
  console.log(`  email: ${operatorEmail}`);
  console.log(`  one-time password: ${oneTimePassword}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
