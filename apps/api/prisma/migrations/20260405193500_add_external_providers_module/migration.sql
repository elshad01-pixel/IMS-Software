CREATE TYPE "ExternalProviderType" AS ENUM ('SUPPLIER', 'OUTSOURCED_SERVICE', 'CONTRACTOR', 'CALIBRATION', 'LOGISTICS', 'OTHER');
CREATE TYPE "ExternalProviderCriticality" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ExternalProviderStatus" AS ENUM ('APPROVED', 'CONDITIONAL', 'UNDER_REVIEW', 'INACTIVE');
CREATE TYPE "ExternalProviderLinkType" AS ENUM ('PROCESS', 'RISK', 'AUDIT', 'ACTION', 'OBLIGATION');

CREATE TABLE "ExternalProviderControl" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referenceNo" TEXT,
  "providerName" TEXT NOT NULL,
  "providerType" "ExternalProviderType" NOT NULL,
  "suppliedScope" TEXT NOT NULL,
  "approvalBasis" TEXT,
  "criticality" "ExternalProviderCriticality" NOT NULL,
  "ownerUserId" TEXT,
  "nextReviewDate" TIMESTAMP(3),
  "status" "ExternalProviderStatus" NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,

  CONSTRAINT "ExternalProviderControl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExternalProviderLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "linkType" "ExternalProviderLinkType" NOT NULL,
  "linkedId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "ExternalProviderLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalProviderControl_tenantId_referenceNo_key" ON "ExternalProviderControl"("tenantId", "referenceNo");
CREATE INDEX "ExternalProviderControl_tenantId_status_idx" ON "ExternalProviderControl"("tenantId", "status");
CREATE INDEX "ExternalProviderControl_tenantId_ownerUserId_idx" ON "ExternalProviderControl"("tenantId", "ownerUserId");
CREATE INDEX "ExternalProviderControl_tenantId_nextReviewDate_idx" ON "ExternalProviderControl"("tenantId", "nextReviewDate");
CREATE INDEX "ExternalProviderControl_tenantId_deletedAt_idx" ON "ExternalProviderControl"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "ExternalProviderLink_providerId_linkType_linkedId_key" ON "ExternalProviderLink"("providerId", "linkType", "linkedId");
CREATE INDEX "ExternalProviderLink_tenantId_providerId_idx" ON "ExternalProviderLink"("tenantId", "providerId");
CREATE INDEX "ExternalProviderLink_tenantId_linkType_linkedId_idx" ON "ExternalProviderLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "ExternalProviderControl"
ADD CONSTRAINT "ExternalProviderControl_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalProviderLink"
ADD CONSTRAINT "ExternalProviderLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExternalProviderLink"
ADD CONSTRAINT "ExternalProviderLink_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ExternalProviderControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
