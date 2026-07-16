-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('GROUP', 'DIRECT', 'LESSON');

-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('IDEA', 'DRAFT_QUESTION');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PEER_SUCCESS';
ALTER TYPE "NotificationType" ADD VALUE 'OVERTAKEN';
ALTER TYPE "NotificationType" ADD VALUE 'SUGGESTION_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'SUGGESTION_REVIEWED';

-- DropIndex
DROP INDEX "analytics_events_occurredAt_brin";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailMilestones" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyOvertaken" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "notifyPeerSuccess" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "chat_channels" (
    "id" TEXT NOT NULL,
    "type" "ChatChannelType" NOT NULL,
    "key" TEXT NOT NULL,
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_memberships" (
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "chat_memberships_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_suggestions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SuggestionKind" NOT NULL,
    "lessonId" TEXT,
    "body" TEXT NOT NULL,
    "draft" JSONB,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_channels_key_key" ON "chat_channels"("key");

-- CreateIndex
CREATE INDEX "chat_memberships_userId_idx" ON "chat_memberships"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_channelId_createdAt_idx" ON "chat_messages"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "syllabus_suggestions_status_createdAt_idx" ON "syllabus_suggestions"("status", "createdAt");

-- CreateIndex
CREATE INDEX "syllabus_suggestions_userId_idx" ON "syllabus_suggestions"("userId");

-- AddForeignKey
ALTER TABLE "chat_channels" ADD CONSTRAINT "chat_channels_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_memberships" ADD CONSTRAINT "chat_memberships_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_memberships" ADD CONSTRAINT "chat_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "chat_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_suggestions" ADD CONSTRAINT "syllabus_suggestions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_suggestions" ADD CONSTRAINT "syllabus_suggestions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_suggestions" ADD CONSTRAINT "syllabus_suggestions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
