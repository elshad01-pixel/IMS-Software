DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditStatus') THEN
    CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditFindingSeverity') THEN
    CREATE TYPE "AuditFindingSeverity" AS ENUM ('OBSERVATION', 'MINOR', 'MAJOR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditFindingStatus') THEN
    CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'CAPA_CREATED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ManagementReviewStatus') THEN
    CREATE TYPE "ManagementReviewStatus" AS ENUM ('PLANNED', 'HELD', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'KpiDirection') THEN
    CREATE TYPE "KpiDirection" AS ENUM ('AT_LEAST', 'AT_MOST');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TrainingAssignmentStatus') THEN
    CREATE TYPE "TrainingAssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;

ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Internal Audit',
  ADD COLUMN IF NOT EXISTS "leadAuditorId" TEXT,
  ADD COLUMN IF NOT EXISTS "auditeeArea" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "status_v2" "AuditStatus";

WITH audit_codes AS (
  SELECT id, 'IA-LEGACY-' || ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS generated_code
  FROM "Audit"
)
UPDATE "Audit" a
SET "code" = audit_codes.generated_code
FROM audit_codes
WHERE a.id = audit_codes.id
  AND a."code" IS NULL;

UPDATE "Audit"
SET "status_v2" = CASE UPPER("status")
  WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"AuditStatus"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"AuditStatus"
  WHEN 'CLOSED' THEN 'CLOSED'::"AuditStatus"
  ELSE 'PLANNED'::"AuditStatus"
END
WHERE "status_v2" IS NULL;

ALTER TABLE "Audit" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Audit" RENAME COLUMN "status_v2" TO "status";
ALTER TABLE "Audit" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Audit" ALTER COLUMN "status" SET DEFAULT 'PLANNED';
ALTER TABLE "Audit" ALTER COLUMN "code" SET NOT NULL;

ALTER TABLE "ManagementReview"
  ADD COLUMN IF NOT EXISTS "chairpersonId" TEXT,
  ADD COLUMN IF NOT EXISTS "agenda" TEXT,
  ADD COLUMN IF NOT EXISTS "minutes" TEXT,
  ADD COLUMN IF NOT EXISTS "decisions" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "status_v2" "ManagementReviewStatus";

UPDATE "ManagementReview"
SET "status_v2" = CASE UPPER("status")
  WHEN 'HELD' THEN 'HELD'::"ManagementReviewStatus"
  WHEN 'CLOSED' THEN 'CLOSED'::"ManagementReviewStatus"
  ELSE 'PLANNED'::"ManagementReviewStatus"
END
WHERE "status_v2" IS NULL;

ALTER TABLE "ManagementReview" DROP COLUMN IF EXISTS "status";
ALTER TABLE "ManagementReview" RENAME COLUMN "status_v2" TO "status";
ALTER TABLE "ManagementReview" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "ManagementReview" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

ALTER TABLE "Kpi"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "warningThreshold" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "direction" "KpiDirection" NOT NULL DEFAULT 'AT_LEAST';

ALTER TABLE "Training"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryMethod" TEXT;

CREATE TABLE IF NOT EXISTS "AuditChecklistItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT,
  "isComplete" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditFinding" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "severity" "AuditFindingSeverity" NOT NULL,
  "ownerId" TEXT,
  "dueDate" TIMESTAMP(3),
  "linkedCapaId" TEXT,
  "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ManagementReviewInput" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagementReviewInput_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KpiReading" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kpiId" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "readingDate" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KpiReading_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingAssignment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "trainingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "status" "TrainingAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "notes" TEXT,
  "evidenceSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrainingAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Audit_tenantId_code_key" ON "Audit"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Audit_tenantId_status_idx" ON "Audit"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ManagementReview_tenantId_status_idx" ON "ManagementReview"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "AuditChecklistItem_tenantId_auditId_idx" ON "AuditChecklistItem"("tenantId", "auditId");
CREATE INDEX IF NOT EXISTS "AuditFinding_tenantId_auditId_idx" ON "AuditFinding"("tenantId", "auditId");
CREATE INDEX IF NOT EXISTS "AuditFinding_tenantId_status_idx" ON "AuditFinding"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ManagementReviewInput_tenantId_reviewId_idx" ON "ManagementReviewInput"("tenantId", "reviewId");
CREATE INDEX IF NOT EXISTS "KpiReading_tenantId_kpiId_idx" ON "KpiReading"("tenantId", "kpiId");
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingAssignment_trainingId_userId_key" ON "TrainingAssignment"("trainingId", "userId");
CREATE INDEX IF NOT EXISTS "TrainingAssignment_tenantId_trainingId_idx" ON "TrainingAssignment"("tenantId", "trainingId");
CREATE INDEX IF NOT EXISTS "TrainingAssignment_tenantId_userId_idx" ON "TrainingAssignment"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "TrainingAssignment_tenantId_status_idx" ON "TrainingAssignment"("tenantId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditChecklistItem_tenantId_fkey'
  ) THEN
    ALTER TABLE "AuditChecklistItem"
      ADD CONSTRAINT "AuditChecklistItem_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditChecklistItem_auditId_fkey'
  ) THEN
    ALTER TABLE "AuditChecklistItem"
      ADD CONSTRAINT "AuditChecklistItem_auditId_fkey"
      FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditFinding_tenantId_fkey'
  ) THEN
    ALTER TABLE "AuditFinding"
      ADD CONSTRAINT "AuditFinding_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditFinding_auditId_fkey'
  ) THEN
    ALTER TABLE "AuditFinding"
      ADD CONSTRAINT "AuditFinding_auditId_fkey"
      FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManagementReviewInput_tenantId_fkey'
  ) THEN
    ALTER TABLE "ManagementReviewInput"
      ADD CONSTRAINT "ManagementReviewInput_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ManagementReviewInput_reviewId_fkey'
  ) THEN
    ALTER TABLE "ManagementReviewInput"
      ADD CONSTRAINT "ManagementReviewInput_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "ManagementReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KpiReading_tenantId_fkey'
  ) THEN
    ALTER TABLE "KpiReading"
      ADD CONSTRAINT "KpiReading_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KpiReading_kpiId_fkey'
  ) THEN
    ALTER TABLE "KpiReading"
      ADD CONSTRAINT "KpiReading_kpiId_fkey"
      FOREIGN KEY ("kpiId") REFERENCES "Kpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrainingAssignment_tenantId_fkey'
  ) THEN
    ALTER TABLE "TrainingAssignment"
      ADD CONSTRAINT "TrainingAssignment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TrainingAssignment_trainingId_fkey'
  ) THEN
    ALTER TABLE "TrainingAssignment"
      ADD CONSTRAINT "TrainingAssignment_trainingId_fkey"
      FOREIGN KEY ("trainingId") REFERENCES "Training"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
