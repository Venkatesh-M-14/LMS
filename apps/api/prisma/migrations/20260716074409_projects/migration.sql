-- CreateEnum
CREATE TYPE "ProjectKind" AS ENUM ('MINI_PROJECT', 'MACHINE_CODING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED');

-- CreateTable
CREATE TABLE "project_briefs" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "kind" "ProjectKind" NOT NULL,
    "title" TEXT NOT NULL,
    "briefMd" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "maxPoints" INTEGER NOT NULL,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_submissions" (
    "id" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoUrl" TEXT NOT NULL,
    "demoUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "submissionRound" INTEGER NOT NULL DEFAULT 1,
    "reviewerId" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_scores" (
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "rubric_scores_pkey" PRIMARY KEY ("submissionId","criterionId")
);

-- CreateTable
CREATE TABLE "submission_messages" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_briefs_topicId_key" ON "project_briefs"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criteria_briefId_order_key" ON "rubric_criteria"("briefId", "order");

-- CreateIndex
CREATE INDEX "project_submissions_status_submittedAt_idx" ON "project_submissions"("status", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_submissions_briefId_userId_key" ON "project_submissions"("briefId", "userId");

-- CreateIndex
CREATE INDEX "submission_messages_submissionId_createdAt_idx" ON "submission_messages"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "project_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "project_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_submissions" ADD CONSTRAINT "project_submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_scores" ADD CONSTRAINT "rubric_scores_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "project_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_scores" ADD CONSTRAINT "rubric_scores_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_messages" ADD CONSTRAINT "submission_messages_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "project_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_messages" ADD CONSTRAINT "submission_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
