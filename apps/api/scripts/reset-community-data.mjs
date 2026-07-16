#!/usr/bin/env node
/**
 * Launch reset: wipes all community data (users, chats, notifications,
 * analytics, attempts, XP, mentor history, suggestions) while keeping the
 * curriculum, quizzes, challenges, project briefs, gating rules and
 * achievement definitions intact.
 *
 * Kept accounts (default): admin@academy.local, instructor@academy.local.
 * Override with a comma-separated KEEP_EMAILS env var. Even kept accounts
 * have their learning data (attempts, XP, notifications, …) cleared and are
 * logged out everywhere (refresh tokens revoked).
 *
 * Usage, from apps/api (reads DATABASE_URL/REDIS_URL from .env):
 *   pnpm reset:community            # asks for confirmation
 *   pnpm reset:community --yes      # non-interactive
 */
import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const KEEP = (process.env.KEEP_EMAILS ?? 'admin@academy.local,instructor@academy.local')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

const prisma = new PrismaClient();

async function confirm() {
  if (process.argv.includes('--yes')) return true;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const dbHost = (process.env.DATABASE_URL ?? '').replace(/^.*@/, '').replace(/\/.*$/, '');
  const answer = await rl.question(
    `This wipes ALL users except [${KEEP.join(', ')}] and all community data on ${dbHost}.\nType "reset" to continue: `,
  );
  rl.close();
  return answer.trim() === 'reset';
}

async function main() {
  if (!(await confirm())) {
    console.log('Aborted — nothing was changed.');
    return;
  }

  const before = await prisma.user.count();

  // 1. Clear the community tables first (kept users included) so launch day
  //    starts from zero — and so no non-cascading FK (e.g. submission-thread
  //    authors) can block the user deletion afterwards.
  const results = {
    chatChannels: (await prisma.chatChannel.deleteMany({})).count, // cascades messages+memberships
    notifications: (await prisma.notification.deleteMany({})).count,
    analyticsEvents: (await prisma.analyticsEvent.deleteMany({})).count,
    emailOutbox: (await prisma.emailOutbox.deleteMany({})).count,
    mentorConversations: (await prisma.mentorConversation.deleteMany({})).count, // cascades messages
    mentorUsage: (await prisma.mentorUsage.deleteMany({})).count,
    suggestions: (await prisma.syllabusSuggestion.deleteMany({})).count,
    revisionAssignments: (await prisma.revisionAssignment.deleteMany({})).count,
    attempts: (await prisma.attempt.deleteMany({})).count, // cascades submissions/runs
    projectSubmissions: (await prisma.projectSubmission.deleteMany({})).count, // cascades scores/thread
    progressRecords: (await prisma.progressRecord.deleteMany({})).count,
    enrollments: (await prisma.enrollment.deleteMany({})).count,
    xpTransactions: (await prisma.xpTransaction.deleteMany({})).count,
    userStats: (await prisma.userStats.deleteMany({})).count,
    userAchievements: (await prisma.userAchievement.deleteMany({})).count,
    certificates: (await prisma.certificate.deleteMany({})).count,
    refreshTokens: (await prisma.refreshToken.deleteMany({})).count, // logs everyone out
  };

  // 2. Test-authored curriculum junk: the authoring E2E publishes lessons with
  //    an e2e-lesson-* slug. Deleting the lesson cascades its versions, blocks
  //    and quiz. (The one-published-version pointer blocks a direct delete, so
  //    detach it first.)
  const junkLessons = await prisma.lesson.findMany({
    where: { slug: { startsWith: 'e2e-lesson-' } },
    select: { id: true },
  });
  if (junkLessons.length > 0) {
    const ids = junkLessons.map((l) => l.id);
    await prisma.lesson.updateMany({
      where: { id: { in: ids } },
      data: { currentPublishedVersionId: null },
    });
    await prisma.lesson.deleteMany({ where: { id: { in: ids } } });
  }
  results.e2eLessons = junkLessons.length;

  // 3. Now delete every account not in the allowlist.
  const { count: usersDeleted } = await prisma.user.deleteMany({
    where: { email: { notIn: KEEP } },
  });

  // 4. Redis: the leaderboard index rebuilds itself from Postgres on the next
  //    read, so just drop it (and any stale rate-limit counters).
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
    maxRetriesPerRequest: 2,
  });
  try {
    await redis.del('leaderboard:alltime');
  } finally {
    redis.disconnect();
  }

  const after = await prisma.user.count();
  console.log(`Users: ${before} → ${after} (deleted ${usersDeleted}, kept: ${KEEP.join(', ')})`);
  for (const [table, count] of Object.entries(results)) {
    if (count > 0) console.log(`${table}: deleted ${count}`);
  }
  console.log('\nDone. Curriculum, quizzes, challenges, briefs, rules and achievement definitions are untouched.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
