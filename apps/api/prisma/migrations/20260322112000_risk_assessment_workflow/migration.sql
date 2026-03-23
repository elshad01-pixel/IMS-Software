CREATE TYPE "RiskIssueContextType" AS ENUM ('INTERNAL', 'EXTERNAL');

ALTER TABLE "Risk"
ADD COLUMN "existingControls" TEXT,
ADD COLUMN "plannedMitigationActions" TEXT,
ADD COLUMN "residualLikelihood" INTEGER,
ADD COLUMN "residualImpact" INTEGER,
ADD COLUMN "residualScore" INTEGER,
ADD COLUMN "issueContextType" "RiskIssueContextType",
ADD COLUMN "issueContext" TEXT;
