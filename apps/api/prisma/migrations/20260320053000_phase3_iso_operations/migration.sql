CREATE TYPE "AuditChecklistResponse" AS ENUM ('YES', 'NO', 'PARTIAL');

ALTER TABLE "Audit"
ADD COLUMN "standard" TEXT;

ALTER TABLE "AuditChecklistItem"
ADD COLUMN "clause" TEXT,
ADD COLUMN "standard" TEXT,
ADD COLUMN "response" "AuditChecklistResponse";

ALTER TABLE "ManagementReview"
ADD COLUMN "auditResults" TEXT,
ADD COLUMN "capaStatus" TEXT,
ADD COLUMN "kpiPerformance" TEXT,
ADD COLUMN "risksOpportunities" TEXT,
ADD COLUMN "changesAffectingSystem" TEXT,
ADD COLUMN "previousActions" TEXT,
ADD COLUMN "improvementActions" TEXT,
ADD COLUMN "resourceNeeds" TEXT;
