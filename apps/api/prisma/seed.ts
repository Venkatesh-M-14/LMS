import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

/**
 * Development seed: creates one account per role so every portal can be
 * exercised immediately. Refuses to run in production.
 */
async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const prisma = new PrismaClient();
  const password = process.env.SEED_PASSWORD ?? 'Academy-dev1';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const accounts = [
    { email: 'admin@academy.local', displayName: 'Academy Admin', role: 'ADMIN' as const },
    {
      email: 'instructor@academy.local',
      displayName: 'Iris Instructor',
      role: 'INSTRUCTOR' as const,
    },
    { email: 'student@academy.local', displayName: 'Sam Student', role: 'STUDENT' as const },
  ];

  for (const account of accounts) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, passwordHash, emailVerifiedAt: new Date() },
    });
  }

  console.warn(`Seeded ${accounts.length} accounts (password: ${password})`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
