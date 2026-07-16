#!/usr/bin/env node
/**
 * Sets (or resets) an account's password and revokes its sessions — the
 * admin's escape hatch until an in-app password-change flow exists.
 *
 * Usage, from apps/api (reads DATABASE_URL from .env):
 *   pnpm set:password admin@academy.local 'New-Strong-Passw0rd'
 *
 * Quote the password so the shell doesn't eat special characters. The policy
 * mirrors registration: at least 10 chars with a lower, an upper and a digit.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: pnpm set:password <email> '<new password>'");
  process.exit(1);
}
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(password)) {
  console.error('Password must be 10+ characters with a lowercase, an uppercase and a digit.');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
    select: { email: true, role: true },
  });
  // Force re-login everywhere with the new password.
  await prisma.refreshToken.deleteMany({ where: { user: { email } } });
  console.log(`Password updated for ${user.email} (${user.role}); all sessions revoked.`);
} catch (err) {
  console.error(err.code === 'P2025' ? `No account found for ${email}` : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
