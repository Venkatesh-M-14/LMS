import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { MODULES_SEED, PATH_SEED } from './seedData/curriculum';
import { LESSONS_SEED } from './seedData/lessons';
import { QUIZZES_SEED } from './seedData/quizzes';
import { CHALLENGE_ATTACHMENTS, CHALLENGES_SEED } from './seedData/challenges';
import { PROJECT_BRIEFS_SEED } from './seedData/projects';
import { generateDefaultRules } from '../src/modules/progress/domain/gating';
import { seedAchievementDefinitions } from '../src/modules/gamification/infrastructure/prismaGamificationRepository';

/**
 * Development/demo seed. Idempotent: structure rows are upserted by slug;
 * deep lesson content is only created when the lesson has no versions yet
 * (so re-seeding never clobbers CMS work). Refuses to run in production.
 */

async function seedUsers(prisma: PrismaClient) {
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

  const users = [] as Array<{ email: string; id: string; role: string }>;
  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: { ...account, passwordHash, emailVerifiedAt: new Date() },
    });
    users.push(user);
  }
  console.warn(`Seeded ${accounts.length} accounts (password: ${password})`);
  return {
    admin: users.find((u) => u.role === 'ADMIN')!,
    instructor: users.find((u) => u.role === 'INSTRUCTOR')!,
  };
}

async function seedCurriculum(prisma: PrismaClient) {
  const path = await prisma.path.upsert({
    where: { slug: PATH_SEED.slug },
    update: { title: PATH_SEED.title, description: PATH_SEED.description },
    create: PATH_SEED,
  });

  let topicCount = 0;
  let skillCount = 0;
  const topicIdBySlug = new Map<string, string>();

  for (const [moduleIndex, moduleSeed] of MODULES_SEED.entries()) {
    const module = await prisma.module.upsert({
      where: { pathId_slug: { pathId: path.id, slug: moduleSeed.slug } },
      update: {
        title: moduleSeed.title,
        description: moduleSeed.description,
        order: moduleIndex + 1,
      },
      create: {
        pathId: path.id,
        slug: moduleSeed.slug,
        title: moduleSeed.title,
        description: moduleSeed.description,
        order: moduleIndex + 1,
      },
    });

    for (const [topicIndex, topicSeed] of moduleSeed.topics.entries()) {
      const topic = await prisma.topic.upsert({
        where: { moduleId_slug: { moduleId: module.id, slug: topicSeed.slug } },
        update: {
          title: topicSeed.title,
          description: topicSeed.description,
          order: topicIndex + 1,
          depth: topicSeed.depth,
        },
        create: {
          moduleId: module.id,
          slug: topicSeed.slug,
          title: topicSeed.title,
          description: topicSeed.description,
          order: topicIndex + 1,
          depth: topicSeed.depth,
        },
      });
      topicIdBySlug.set(topicSeed.slug, topic.id);
      topicCount++;

      for (const skill of topicSeed.skills) {
        await prisma.skill.upsert({
          where: { slug: skill.slug },
          update: { name: skill.name, topicId: topic.id },
          create: { slug: skill.slug, name: skill.name, topicId: topic.id },
        });
        skillCount++;
      }
    }
  }

  console.warn(
    `Seeded path "${path.slug}": ${MODULES_SEED.length} modules, ${topicCount} topics, ${skillCount} skills`,
  );
  return topicIdBySlug;
}

async function seedLessons(
  prisma: PrismaClient,
  topicIdBySlug: Map<string, string>,
  authorId: string,
  reviewerId: string,
) {
  let created = 0;
  let skipped = 0;

  for (const [index, lessonSeed] of LESSONS_SEED.entries()) {
    const topicId = topicIdBySlug.get(lessonSeed.topicSlug);
    if (!topicId) throw new Error(`Seed bug: unknown topic slug ${lessonSeed.topicSlug}`);

    // Order within the topic: position among seeds that share the topic.
    const order =
      LESSONS_SEED.filter((l) => l.topicSlug === lessonSeed.topicSlug).indexOf(lessonSeed) + 1;

    const lesson = await prisma.lesson.upsert({
      where: { topicId_slug: { topicId, slug: lessonSeed.slug } },
      update: { title: lessonSeed.title, estimatedMinutes: lessonSeed.estimatedMinutes, order },
      create: {
        topicId,
        slug: lessonSeed.slug,
        title: lessonSeed.title,
        estimatedMinutes: lessonSeed.estimatedMinutes,
        order,
      },
    });

    // Skill tags (idempotent replace).
    const skills = await prisma.skill.findMany({
      where: { slug: { in: lessonSeed.skillSlugs } },
      select: { id: true },
    });
    await prisma.lessonSkill.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.lessonSkill.createMany({
      data: skills.map((skill) => ({ lessonId: lesson.id, skillId: skill.id })),
      skipDuplicates: true,
    });

    // Content: only when the lesson has no versions yet (protects CMS edits).
    const versionCount = await prisma.lessonVersion.count({ where: { lessonId: lesson.id } });
    if (versionCount > 0) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const version = await tx.lessonVersion.create({
        data: {
          lessonId: lesson.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          authorId,
          reviewerId,
          changelog: 'Initial authored version',
          publishedAt: new Date(),
        },
      });
      await tx.contentBlock.createMany({
        data: lessonSeed.blocks.map((block, blockIndex) => ({
          lessonVersionId: version.id,
          order: blockIndex + 1,
          type: block.type,
          payload: block.payload,
          payloadSchemaVersion: 1,
        })),
      });
      await tx.lesson.update({
        where: { id: lesson.id },
        data: { currentPublishedVersionId: version.id },
      });
      // Generous timeouts: seeding over a remote DB (e.g. Neon) pays a network
      // round-trip per statement, easily exceeding Prisma's 5s default.
    }, { timeout: 120_000, maxWait: 30_000 });
    created++;
    void index;
  }

  console.warn(
    `Seeded lessons: ${created} published, ${skipped} left untouched (already versioned)`,
  );
}

async function seedQuizzes(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;

  for (const quiz of QUIZZES_SEED) {
    const lesson = await prisma.lesson.findFirst({ where: { slug: quiz.lessonSlug } });
    if (!lesson) throw new Error(`Seed bug: no lesson with slug ${quiz.lessonSlug}`);

    // Never clobber CMS-authored questions; settings are kept in sync though,
    // so threshold tuning in the seed reaches existing dev databases.
    const existing = await prisma.assessment.findUnique({ where: { lessonId: lesson.id } });
    if (existing) {
      await prisma.assessment.update({
        where: { id: existing.id },
        data: { title: quiz.title, passingScorePct: quiz.passingScorePct },
      });
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const assessment = await tx.assessment.create({
        data: {
          lessonId: lesson.id,
          kind: 'LESSON_QUIZ',
          title: quiz.title,
          passingScorePct: quiz.passingScorePct,
          maxAttempts: null,
          cooldownMinutes: 0,
          shuffleItems: false,
        },
      });
      for (const [index, seedItem] of quiz.items.entries()) {
        const item = await tx.assessmentItem.create({
          data: {
            assessmentId: assessment.id,
            order: index + 1,
            type: seedItem.item.type,
            points: seedItem.points,
            payload: seedItem.item.payload,
          },
        });
        const skills = await tx.skill.findMany({
          where: { slug: { in: seedItem.skillSlugs } },
          select: { id: true },
        });
        if (skills.length > 0) {
          await tx.assessmentItemSkill.createMany({
            data: skills.map((skill) => ({ itemId: item.id, skillId: skill.id })),
            skipDuplicates: true,
          });
        }
      }
    }, { timeout: 120_000, maxWait: 30_000 });
    created++;
  }

  console.warn(`Seeded quizzes: ${created} created, ${skipped} left untouched`);
}

async function seedChallenges(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;

  for (const seed of CHALLENGES_SEED) {
    const existing = await prisma.codingChallenge.findUnique({ where: { slug: seed.slug } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.codingChallenge.create({
      data: {
        slug: seed.slug,
        title: seed.title,
        environment: seed.environment,
        instructionsMd: seed.instructionsMd,
        starterFiles: seed.starterFiles,
        solutionFiles: seed.solutionFiles,
        timeLimitMs: seed.timeLimitMs,
        testCases: {
          create: seed.tests.map((test, index) => ({
            order: index + 1,
            name: test.name,
            kind: test.kind,
            specCode: test.specCode,
            weight: test.weight,
            isHidden: test.isHidden,
          })),
        },
      },
    });
    created++;
  }
  console.warn(`Seeded challenges: ${created} created, ${skipped} left untouched`);

  // Attach coding items to their lesson quizzes (idempotent).
  let attached = 0;
  for (const attachment of CHALLENGE_ATTACHMENTS) {
    const lesson = await prisma.lesson.findFirst({ where: { slug: attachment.lessonSlug } });
    const challenge = await prisma.codingChallenge.findUnique({
      where: { slug: attachment.challengeSlug },
    });
    if (!lesson || !challenge) continue;
    const assessment = await prisma.assessment.findUnique({ where: { lessonId: lesson.id } });
    if (!assessment) continue;

    const items = await prisma.assessmentItem.findMany({ where: { assessmentId: assessment.id } });
    const already = items.some(
      (item) => (item.payload as { challengeId?: string })?.challengeId === challenge.id,
    );
    if (already) continue;

    const item = await prisma.assessmentItem.create({
      data: {
        assessmentId: assessment.id,
        order: Math.max(0, ...items.map((i) => i.order)) + 1,
        type: attachment.itemType,
        points: attachment.points,
        payload: { challengeId: challenge.id },
      },
    });
    const skills = await prisma.skill.findMany({
      where: { slug: { in: attachment.skillSlugs } },
      select: { id: true },
    });
    if (skills.length > 0) {
      await prisma.assessmentItemSkill.createMany({
        data: skills.map((skill) => ({ itemId: item.id, skillId: skill.id })),
        skipDuplicates: true,
      });
    }
    attached++;
  }
  console.warn(`Attached coding items: ${attached}`);
}

async function seedProjectBriefs(prisma: PrismaClient) {
  let created = 0;
  let skipped = 0;
  for (const seed of PROJECT_BRIEFS_SEED) {
    const topic = await prisma.topic.findFirst({ where: { slug: seed.topicSlug } });
    if (!topic) continue;
    const existing = await prisma.projectBrief.findUnique({ where: { topicId: topic.id } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.projectBrief.create({
      data: {
        topicId: topic.id,
        kind: seed.kind,
        title: seed.title,
        briefMd: seed.briefMd,
        rubric: {
          create: seed.rubric.map((criterion, index) => ({
            order: index + 1,
            title: criterion.title,
            description: criterion.description,
            maxPoints: criterion.maxPoints,
          })),
        },
      },
    });
    created++;
  }
  console.warn(`Seeded project briefs: ${created} created, ${skipped} left untouched`);
}

async function seedPrerequisiteRules(prisma: PrismaClient) {
  const path = await prisma.path.findFirst({
    where: { isActive: true },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: {
          topics: {
            orderBy: { order: 'asc' },
            include: { lessons: { orderBy: { order: 'asc' }, select: { id: true, order: true } } },
          },
        },
      },
    },
  });
  if (!path) throw new Error('Seed bug: no active path');

  const structure = path.modules.map((module) => ({
    id: module.id,
    order: module.order,
    topics: module.topics.map((topic) => ({
      id: topic.id,
      order: topic.order,
      lessons: topic.lessons.map((lesson) => ({
        id: lesson.id,
        order: lesson.order,
        published: true,
      })),
    })),
  }));

  const rules = generateDefaultRules(structure);
  const result = await prisma.prerequisiteRule.createMany({ data: rules, skipDuplicates: true });
  console.warn(`Seeded prerequisite rules: ${result.count} new (${rules.length} total defaults)`);
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  const prisma = new PrismaClient();
  try {
    const { admin, instructor } = await seedUsers(prisma);
    const topicIdBySlug = await seedCurriculum(prisma);
    await seedLessons(prisma, topicIdBySlug, instructor.id, admin.id);
    await seedQuizzes(prisma);
    await seedChallenges(prisma);
    await seedProjectBriefs(prisma);
    await seedPrerequisiteRules(prisma);
    await seedAchievementDefinitions(prisma);
    console.warn('Seeded achievement definitions');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
