-- CreateEnum
CREATE TYPE "ContextIssueType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ContextIssueStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InterestedPartyType" AS ENUM ('CUSTOMER', 'REGULATOR', 'EMPLOYEE', 'SUPPLIER', 'OTHER');

-- CreateTable
CREATE TABLE "ContextIssue" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ContextIssueType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "status" "ContextIssueStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContextIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterestedParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InterestedPartyType" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InterestedParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NeedExpectation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "interestedPartyId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "NeedExpectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContextIssueRiskLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ContextIssueRiskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContextIssue_tenantId_type_status_idx" ON "ContextIssue"("tenantId", "type", "status");

-- CreateIndex
CREATE INDEX "ContextIssue_tenantId_deletedAt_idx" ON "ContextIssue"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "InterestedParty_tenantId_type_idx" ON "InterestedParty"("tenantId", "type");

-- CreateIndex
CREATE INDEX "InterestedParty_tenantId_deletedAt_idx" ON "InterestedParty"("tenantId", "deletedAt");

-- CreateIndex
CREATE INDEX "NeedExpectation_tenantId_interestedPartyId_idx" ON "NeedExpectation"("tenantId", "interestedPartyId");

-- CreateIndex
CREATE INDEX "NeedExpectation_tenantId_deletedAt_idx" ON "NeedExpectation"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContextIssueRiskLink_issueId_riskId_key" ON "ContextIssueRiskLink"("issueId", "riskId");

-- CreateIndex
CREATE INDEX "ContextIssueRiskLink_tenantId_issueId_idx" ON "ContextIssueRiskLink"("tenantId", "issueId");

-- CreateIndex
CREATE INDEX "ContextIssueRiskLink_tenantId_riskId_idx" ON "ContextIssueRiskLink"("tenantId", "riskId");

-- AddForeignKey
ALTER TABLE "ContextIssue" ADD CONSTRAINT "ContextIssue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterestedParty" ADD CONSTRAINT "InterestedParty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedExpectation" ADD CONSTRAINT "NeedExpectation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NeedExpectation" ADD CONSTRAINT "NeedExpectation_interestedPartyId_fkey" FOREIGN KEY ("interestedPartyId") REFERENCES "InterestedParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextIssueRiskLink" ADD CONSTRAINT "ContextIssueRiskLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContextIssueRiskLink" ADD CONSTRAINT "ContextIssueRiskLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "ContextIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
