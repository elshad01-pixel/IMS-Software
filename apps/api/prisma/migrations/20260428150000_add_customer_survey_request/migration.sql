-- CreateEnum
CREATE TYPE "CustomerSurveyRequestStatus" AS ENUM ('OPEN', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CustomerSurveyRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "interestedPartyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "scaleMax" INTEGER NOT NULL,
    "categoryLabels" JSONB NOT NULL,
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "status" "CustomerSurveyRequestStatus" NOT NULL DEFAULT 'OPEN',
    "sentAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "respondentName" TEXT,
    "respondentEmail" TEXT,
    "respondentCompany" TEXT,
    "respondentReference" TEXT,
    "ratings" JSONB,
    "whatWorkedWell" TEXT,
    "improvementPriority" TEXT,
    "comments" TEXT,
    "averageScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSurveyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSurveyRequest_token_key" ON "CustomerSurveyRequest"("token");

-- CreateIndex
CREATE INDEX "CustomerSurveyRequest_tenantId_interestedPartyId_idx" ON "CustomerSurveyRequest"("tenantId", "interestedPartyId");

-- CreateIndex
CREATE INDEX "CustomerSurveyRequest_tenantId_status_idx" ON "CustomerSurveyRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CustomerSurveyRequest_tenantId_createdAt_idx" ON "CustomerSurveyRequest"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerSurveyRequest" ADD CONSTRAINT "CustomerSurveyRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSurveyRequest" ADD CONSTRAINT "CustomerSurveyRequest_interestedPartyId_fkey" FOREIGN KEY ("interestedPartyId") REFERENCES "InterestedParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
