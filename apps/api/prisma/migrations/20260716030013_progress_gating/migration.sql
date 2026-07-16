-- CreateEnum
CREATE TYPE "ProgressUnitType" AS ENUM ('LESSON', 'TOPIC', 'MODULE');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "enrollments" (
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("userId","pathId")
);

-- CreateTable
CREATE TABLE "progress_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "unitType" "ProgressUnitType" NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL,
    "bestScorePct" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "progress_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prerequisite_rules" (
    "id" TEXT NOT NULL,
    "unitType" "ProgressUnitType" NOT NULL,
    "unitId" TEXT NOT NULL,
    "requiredUnitType" "ProgressUnitType" NOT NULL,
    "requiredUnitId" TEXT NOT NULL,
    "minScorePct" INTEGER,

    CONSTRAINT "prerequisite_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progress_records_userId_status_idx" ON "progress_records"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "progress_records_userId_unitType_unitId_key" ON "progress_records"("userId", "unitType", "unitId");

-- CreateIndex
CREATE INDEX "prerequisite_rules_unitType_unitId_idx" ON "prerequisite_rules"("unitType", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "prerequisite_rules_unitType_unitId_requiredUnitType_require_key" ON "prerequisite_rules"("unitType", "unitId", "requiredUnitType", "requiredUnitId");

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_records" ADD CONSTRAINT "progress_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
