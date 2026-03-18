ALTER TYPE "RiskStatus" ADD VALUE IF NOT EXISTS 'IN_TREATMENT';

ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'INVESTIGATING';
ALTER TYPE "CapaStatus" ADD VALUE IF NOT EXISTS 'ACTION_PLANNED';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus') THEN
    CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'OBSOLETE');
  END IF;
END $$;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Procedure',
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "effectiveDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewDueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "obsoletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "changeSummary" TEXT;

ALTER TABLE "Document"
  ALTER COLUMN "version" DROP DEFAULT,
  ALTER COLUMN "version" TYPE INTEGER
  USING COALESCE(NULLIF(split_part("version", '.', 1), ''), '1')::INTEGER;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "status_v2" "DocumentStatus";

UPDATE "Document"
SET "status_v2" = CASE UPPER("status")
  WHEN 'DRAFT' THEN 'DRAFT'::"DocumentStatus"
  WHEN 'REVIEW' THEN 'REVIEW'::"DocumentStatus"
  WHEN 'APPROVED' THEN 'APPROVED'::"DocumentStatus"
  ELSE 'OBSOLETE'::"DocumentStatus"
END
WHERE "status_v2" IS NULL;

ALTER TABLE "Document" DROP COLUMN IF EXISTS "status";
ALTER TABLE "Document" RENAME COLUMN "status_v2" TO "status";
ALTER TABLE "Document" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Risk" RENAME COLUMN "impact" TO "severity";
ALTER TABLE "Risk" RENAME COLUMN "mitigationPlan" TO "treatmentPlan";
ALTER TABLE "Risk"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "treatmentSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "targetDate" TIMESTAMP(3);

ALTER TABLE "Capa"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "containmentAction" TEXT,
  ADD COLUMN IF NOT EXISTS "verificationMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "closureSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Document_tenantId_status_idx" ON "Document"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Risk_tenantId_status_idx" ON "Risk"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Capa_tenantId_status_idx" ON "Capa"("tenantId", "status");
