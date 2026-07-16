-- CreateEnum
CREATE TYPE "MentorRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('ASSIGNED', 'COMPLETED');

-- CreateTable
CREATE TABLE "mentor_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MentorRole" NOT NULL,
    "content" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_usage" (
    "userId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "messages" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "mentor_usage_pkey" PRIMARY KEY ("userId","day")
);

-- CreateTable
CREATE TABLE "revision_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "targetLessonId" TEXT NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "blocksRetake" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "revision_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mentor_conversations_userId_updatedAt_idx" ON "mentor_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "mentor_messages_conversationId_createdAt_idx" ON "mentor_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "revision_assignments_userId_status_idx" ON "revision_assignments"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "revision_assignments_userId_assessmentId_skillId_key" ON "revision_assignments"("userId", "assessmentId", "skillId");

-- AddForeignKey
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_conversations" ADD CONSTRAINT "mentor_conversations_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_messages" ADD CONSTRAINT "mentor_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "mentor_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_usage" ADD CONSTRAINT "mentor_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_assignments" ADD CONSTRAINT "revision_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_assignments" ADD CONSTRAINT "revision_assignments_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_assignments" ADD CONSTRAINT "revision_assignments_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_assignments" ADD CONSTRAINT "revision_assignments_targetLessonId_fkey" FOREIGN KEY ("targetLessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
