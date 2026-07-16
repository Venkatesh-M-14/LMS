-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('LESSON_QUIZ', 'TOPIC_ASSESSMENT', 'MODULE_EXAM');

-- CreateEnum
CREATE TYPE "AssessmentItemType" AS ENUM ('MCQ', 'MULTI_SELECT', 'OUTPUT_PREDICTION', 'REFLECTION');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'GRADING', 'GRADED');

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "kind" "AssessmentKind" NOT NULL DEFAULT 'LESSON_QUIZ',
    "lessonId" TEXT,
    "title" TEXT NOT NULL,
    "passingScorePct" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 0,
    "shuffleItems" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_items" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "AssessmentItemType" NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "payloadSchemaVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_item_skills" (
    "itemId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "assessment_item_skills_pkey" PRIMARY KEY ("itemId","skillId")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "passed" BOOLEAN,
    "scorePct" DOUBLE PRECISION,
    "rawScore" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "itemsSnapshot" JSONB NOT NULL,
    "lessonVersionId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_submissions" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "autoScore" DOUBLE PRECISION,
    "manualScore" DOUBLE PRECISION,
    "graderId" TEXT,
    "graderFeedback" TEXT NOT NULL DEFAULT '',
    "gradedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_lessonId_key" ON "assessments"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_items_assessmentId_order_key" ON "assessment_items"("assessmentId", "order");

-- CreateIndex
CREATE INDEX "attempts_assessmentId_status_idx" ON "attempts"("assessmentId", "status");

-- CreateIndex
CREATE INDEX "attempts_userId_assessmentId_idx" ON "attempts"("userId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_userId_assessmentId_attemptNumber_key" ON "attempts"("userId", "assessmentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "item_submissions_attemptId_itemId_key" ON "item_submissions"("attemptId", "itemId");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_item_skills" ADD CONSTRAINT "assessment_item_skills_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "assessment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_item_skills" ADD CONSTRAINT "assessment_item_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_submissions" ADD CONSTRAINT "item_submissions_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_submissions" ADD CONSTRAINT "item_submissions_graderId_fkey" FOREIGN KEY ("graderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
