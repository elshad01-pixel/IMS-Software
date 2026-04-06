CREATE TYPE "ExternalProviderEvaluationOutcome" AS ENUM ('APPROVED', 'APPROVED_WITH_CONDITIONS', 'ESCALATED', 'DISQUALIFIED');

ALTER TABLE "ExternalProviderControl"
ADD COLUMN "evaluationDate" TIMESTAMP(3),
ADD COLUMN "qualityScore" INTEGER,
ADD COLUMN "deliveryScore" INTEGER,
ADD COLUMN "responsivenessScore" INTEGER,
ADD COLUMN "complianceScore" INTEGER,
ADD COLUMN "traceabilityScore" INTEGER,
ADD COLUMN "changeControlScore" INTEGER,
ADD COLUMN "evaluationScore" INTEGER,
ADD COLUMN "evaluationOutcome" "ExternalProviderEvaluationOutcome",
ADD COLUMN "evaluationSummary" TEXT;
