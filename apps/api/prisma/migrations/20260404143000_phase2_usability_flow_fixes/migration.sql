ALTER TYPE "ProcessRegisterLinkType" ADD VALUE IF NOT EXISTS 'CONTEXT_ISSUE';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RiskAssessmentType') THEN
    CREATE TYPE "RiskAssessmentType" AS ENUM ('RISK', 'OPPORTUNITY');
  END IF;
END $$;

ALTER TABLE "Risk"
ADD COLUMN IF NOT EXISTS "assessmentType" "RiskAssessmentType" NOT NULL DEFAULT 'RISK';
