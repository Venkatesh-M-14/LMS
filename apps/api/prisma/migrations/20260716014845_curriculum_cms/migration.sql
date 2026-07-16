-- CreateEnum
CREATE TYPE "TopicDepth" AS ENUM ('AUTHORED', 'OUTLINE');

-- CreateEnum
CREATE TYPE "LessonVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContentBlockType" AS ENUM ('MARKDOWN', 'CODE', 'CALLOUT', 'VIDEO', 'IMAGE', 'EMBED');

-- CreateTable
CREATE TABLE "paths" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    "depth" "TopicDepth" NOT NULL DEFAULT 'OUTLINE',

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 10,
    "currentPublishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_versions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "LessonVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "changelog" TEXT NOT NULL DEFAULT '',
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "lesson_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_blocks" (
    "id" TEXT NOT NULL,
    "lessonVersionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "ContentBlockType" NOT NULL,
    "payload" JSONB NOT NULL,
    "payloadSchemaVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "content_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "topicId" TEXT,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_skills" (
    "lessonId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "lesson_skills_pkey" PRIMARY KEY ("lessonId","skillId")
);

-- CreateIndex
CREATE UNIQUE INDEX "paths_slug_key" ON "paths"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "modules_pathId_slug_key" ON "modules"("pathId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "modules_pathId_order_key" ON "modules"("pathId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "topics_moduleId_slug_key" ON "topics"("moduleId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "topics_moduleId_order_key" ON "topics"("moduleId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_currentPublishedVersionId_key" ON "lessons"("currentPublishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_topicId_slug_key" ON "lessons"("topicId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_topicId_order_key" ON "lessons"("topicId", "order");

-- CreateIndex
CREATE INDEX "lesson_versions_lessonId_status_idx" ON "lesson_versions"("lessonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_versions_lessonId_versionNumber_key" ON "lesson_versions"("lessonId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "content_blocks_lessonVersionId_order_key" ON "content_blocks"("lessonVersionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_key" ON "skills"("slug");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_currentPublishedVersionId_fkey" FOREIGN KEY ("currentPublishedVersionId") REFERENCES "lesson_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_versions" ADD CONSTRAINT "lesson_versions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_lessonVersionId_fkey" FOREIGN KEY ("lessonVersionId") REFERENCES "lesson_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_skills" ADD CONSTRAINT "lesson_skills_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_skills" ADD CONSTRAINT "lesson_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- At most one PUBLISHED version per lesson, enforced at the database level.
CREATE UNIQUE INDEX "lesson_versions_one_published"
ON "lesson_versions" ("lessonId")
WHERE "status" = 'PUBLISHED';
