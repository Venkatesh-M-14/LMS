-- CreateEnum
CREATE TYPE "ChallengeEnvironment" AS ENUM ('JS', 'DOM');

-- CreateEnum
CREATE TYPE "TestCaseKind" AS ENUM ('UNIT', 'DOM');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'TIMEOUT', 'ERROR');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AssessmentItemType" ADD VALUE 'CODING';
ALTER TYPE "AssessmentItemType" ADD VALUE 'DEBUGGING';

-- CreateTable
CREATE TABLE "coding_challenges" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "environment" "ChallengeEnvironment" NOT NULL,
    "instructionsMd" TEXT NOT NULL,
    "starterFiles" JSONB NOT NULL,
    "solutionFiles" JSONB NOT NULL,
    "timeLimitMs" INTEGER NOT NULL DEFAULT 5000,
    "memoryLimitMb" INTEGER NOT NULL DEFAULT 128,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_cases" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "TestCaseKind" NOT NULL,
    "specCode" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "timeoutMs" INTEGER NOT NULL DEFAULT 2000,

    CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_runs" (
    "id" TEXT NOT NULL,
    "itemSubmissionId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "submittedFiles" JSONB NOT NULL,
    "resultsJson" JSONB,
    "stdout" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "durationMs" INTEGER,
    "judgeVersion" TEXT NOT NULL DEFAULT '1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "execution_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coding_challenges_slug_key" ON "coding_challenges"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "test_cases_challengeId_order_key" ON "test_cases"("challengeId", "order");

-- CreateIndex
CREATE INDEX "execution_runs_itemSubmissionId_createdAt_idx" ON "execution_runs"("itemSubmissionId", "createdAt");

-- CreateIndex
CREATE INDEX "execution_runs_status_idx" ON "execution_runs"("status");

-- AddForeignKey
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "coding_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_runs" ADD CONSTRAINT "execution_runs_itemSubmissionId_fkey" FOREIGN KEY ("itemSubmissionId") REFERENCES "item_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
