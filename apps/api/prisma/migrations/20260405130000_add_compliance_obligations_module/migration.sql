CREATE TYPE "ComplianceObligationStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'OBSOLETE');

CREATE TYPE "ComplianceObligationLinkType" AS ENUM ('PROCESS', 'RISK', 'AUDIT', 'ACTION');

CREATE TABLE "ComplianceObligation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referenceNo" TEXT,
    "title" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "obligationType" TEXT,
    "jurisdiction" TEXT,
    "description" TEXT,
    "ownerUserId" TEXT,
    "reviewFrequencyMonths" INTEGER,
    "nextReviewDate" TIMESTAMP(3),
    "status" "ComplianceObligationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "ComplianceObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceObligationLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "obligationId" TEXT NOT NULL,
    "linkType" "ComplianceObligationLinkType" NOT NULL,
    "linkedId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ComplianceObligationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceObligation_tenantId_referenceNo_key" ON "ComplianceObligation"("tenantId", "referenceNo");
CREATE INDEX "ComplianceObligation_tenantId_status_idx" ON "ComplianceObligation"("tenantId", "status");
CREATE INDEX "ComplianceObligation_tenantId_ownerUserId_idx" ON "ComplianceObligation"("tenantId", "ownerUserId");
CREATE INDEX "ComplianceObligation_tenantId_nextReviewDate_idx" ON "ComplianceObligation"("tenantId", "nextReviewDate");
CREATE INDEX "ComplianceObligation_tenantId_deletedAt_idx" ON "ComplianceObligation"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "ComplianceObligationLink_obligationId_linkType_linkedId_key" ON "ComplianceObligationLink"("obligationId", "linkType", "linkedId");
CREATE INDEX "ComplianceObligationLink_tenantId_obligationId_idx" ON "ComplianceObligationLink"("tenantId", "obligationId");
CREATE INDEX "ComplianceObligationLink_tenantId_linkType_linkedId_idx" ON "ComplianceObligationLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "ComplianceObligation"
ADD CONSTRAINT "ComplianceObligation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceObligationLink"
ADD CONSTRAINT "ComplianceObligationLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ComplianceObligationLink"
ADD CONSTRAINT "ComplianceObligationLink_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ComplianceObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
