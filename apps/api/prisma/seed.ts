import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { MODULES_SEED, PATH_SEED } from './seedData/curriculum';
import { LESSONS_SEED } from './seedData/lessons';

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
    });
    created++;
    void index;
  }

  console.warn(
    `Seeded lessons: ${created} published, ${skipped} left untouched (already versioned)`,
  );
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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
