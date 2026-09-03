/**
 * Creates (or resets) a ready-to-use local login.
 *
 * Unlike `seed.ts`, this **overwrites** the password every run and leaves the
 * account `active` rather than `invited` — so there's no forced first-login
 * reset (D11) between you and the app. That's the whole point: a dev account
 * you can log straight into.
 *
 * Run: npm run db:dev-user  (from apps/api)
 * Override with DEV_USER_EMAIL / DEV_USER_PASSWORD / DEV_USER_NAME.
 */
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { COMPANY_DOMAIN, ensureDiscloserCompany } from './dev-company';

const prisma = new PrismaClient();

const EMAIL = process.env.DEV_USER_EMAIL ?? `dev@${COMPANY_DOMAIN}`;
const PASSWORD = process.env.DEV_USER_PASSWORD ?? 'VeyraDev2026!';
const NAME = process.env.DEV_USER_NAME ?? 'Dev Admin';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to create a known-password account in production.');
  }

  // Reuse the seed's company/tenant so this account owns the same rooms.
  const { company, tenant } = await ensureDiscloserCompany(prisma);

  // An earlier run of this script used a different address; move it rather
  // than leaving two dev logins behind.
  await prisma.user.updateMany({ where: { email: 'dev@veyra.local' }, data: { email: EMAIL } });

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    // `active`, so `mustResetPassword` is false and login lands in the app.
    update: { passwordHash, status: 'active', name: NAME },
    create: { email: EMAIL, name: NAME, passwordHash, status: 'active' },
  });

  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: { role: 'owner' },
    create: { tenantId: tenant.id, userId: user.id, role: 'owner' },
  });

  /*
   * Tenant ownership is not room membership — `GET /rooms` reads
   * `room_participants` — so without this the account lands on an empty list
   * even though it owns the tenant. The NDA is deliberately left unaccepted:
   * the click-through gate is a real screen, and one click is not friction
   * worth faking.
   */
  const rooms = await prisma.room.findMany({ where: { tenantId: tenant.id }, select: { id: true } });
  for (const room of rooms) {
    const existing = await prisma.roomParticipant.findFirst({
      where: { roomId: room.id, userId: user.id },
    });
    if (existing) continue;
    await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId: user.id,
        companyId: company.id,
        side: 'discloser',
        role: 'admin',
        status: 'active',
        acceptedAt: new Date(),
      },
    });
  }

  console.log('Dev login ready — no password reset required.');
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
  console.log(`  tenant:   ${company.name} (owner)`);
  console.log(`  rooms:    ${rooms.length} in this tenant — NDA click-through still applies`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
