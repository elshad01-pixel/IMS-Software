CREATE TYPE "HazardExposureStage" AS ENUM ('ROUTINE', 'NON_ROUTINE', 'EMERGENCY');
CREATE TYPE "HazardSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "HazardStatus" AS ENUM ('ACTIVE', 'MONITORING', 'OBSOLETE');
CREATE TYPE "HazardLinkType" AS ENUM ('PROCESS', 'RISK', 'ACTION', 'INCIDENT');

CREATE TABLE "HazardIdentification" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referenceNo" TEXT,
  "activity" TEXT NOT NULL,
  "hazard" TEXT NOT NULL,
  "potentialHarm" TEXT NOT NULL,
  "exposureStage" "HazardExposureStage" NOT NULL,
  "existingControls" TEXT,
  "severity" "HazardSeverity" NOT NULL,
  "ownerUserId" TEXT,
  "reviewDate" TIMESTAMP(3),
  "status" "HazardStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,

  CONSTRAINT "HazardIdentification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HazardIdentificationLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "hazardId" TEXT NOT NULL,
  "linkType" "HazardLinkType" NOT NULL,
  "linkedId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "HazardIdentificationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HazardIdentification_tenantId_referenceNo_key" ON "HazardIdentification"("tenantId", "referenceNo");
CREATE INDEX "HazardIdentification_tenantId_status_idx" ON "HazardIdentification"("tenantId", "status");
CREATE INDEX "HazardIdentification_tenantId_ownerUserId_idx" ON "HazardIdentification"("tenantId", "ownerUserId");
CREATE INDEX "HazardIdentification_tenantId_reviewDate_idx" ON "HazardIdentification"("tenantId", "reviewDate");
CREATE INDEX "HazardIdentification_tenantId_deletedAt_idx" ON "HazardIdentification"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "HazardIdentificationLink_hazardId_linkType_linkedId_key" ON "HazardIdentificationLink"("hazardId", "linkType", "linkedId");
CREATE INDEX "HazardIdentificationLink_tenantId_hazardId_idx" ON "HazardIdentificationLink"("tenantId", "hazardId");
CREATE INDEX "HazardIdentificationLink_tenantId_linkType_linkedId_idx" ON "HazardIdentificationLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "HazardIdentification"
ADD CONSTRAINT "HazardIdentification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HazardIdentificationLink"
ADD CONSTRAINT "HazardIdentificationLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HazardIdentificationLink"
ADD CONSTRAINT "HazardIdentificationLink_hazardId_fkey" FOREIGN KEY ("hazardId") REFERENCES "HazardIdentification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
