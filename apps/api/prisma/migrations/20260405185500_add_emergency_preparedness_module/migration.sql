CREATE TYPE "EmergencyPreparednessType" AS ENUM ('FIRE', 'CHEMICAL_SPILL', 'MEDICAL', 'EVACUATION', 'POWER_LOSS', 'OTHER');
CREATE TYPE "EmergencyPreparednessStatus" AS ENUM ('ACTIVE', 'MONITORING', 'OBSOLETE');
CREATE TYPE "EmergencyPreparednessLinkType" AS ENUM ('PROCESS', 'RISK', 'ACTION', 'INCIDENT');

CREATE TABLE "EmergencyPreparedness" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referenceNo" TEXT,
  "scenario" TEXT NOT NULL,
  "emergencyType" "EmergencyPreparednessType" NOT NULL,
  "potentialImpact" TEXT NOT NULL,
  "responseSummary" TEXT,
  "resourceSummary" TEXT,
  "ownerUserId" TEXT,
  "drillFrequencyMonths" INTEGER,
  "nextDrillDate" TIMESTAMP(3),
  "status" "EmergencyPreparednessStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,

  CONSTRAINT "EmergencyPreparedness_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmergencyPreparednessLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "emergencyId" TEXT NOT NULL,
  "linkType" "EmergencyPreparednessLinkType" NOT NULL,
  "linkedId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "EmergencyPreparednessLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmergencyPreparedness_tenantId_referenceNo_key" ON "EmergencyPreparedness"("tenantId", "referenceNo");
CREATE INDEX "EmergencyPreparedness_tenantId_status_idx" ON "EmergencyPreparedness"("tenantId", "status");
CREATE INDEX "EmergencyPreparedness_tenantId_ownerUserId_idx" ON "EmergencyPreparedness"("tenantId", "ownerUserId");
CREATE INDEX "EmergencyPreparedness_tenantId_nextDrillDate_idx" ON "EmergencyPreparedness"("tenantId", "nextDrillDate");
CREATE INDEX "EmergencyPreparedness_tenantId_deletedAt_idx" ON "EmergencyPreparedness"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "EmergencyPreparednessLink_emergencyId_linkType_linkedId_key" ON "EmergencyPreparednessLink"("emergencyId", "linkType", "linkedId");
CREATE INDEX "EmergencyPreparednessLink_tenantId_emergencyId_idx" ON "EmergencyPreparednessLink"("tenantId", "emergencyId");
CREATE INDEX "EmergencyPreparednessLink_tenantId_linkType_linkedId_idx" ON "EmergencyPreparednessLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "EmergencyPreparedness"
ADD CONSTRAINT "EmergencyPreparedness_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmergencyPreparednessLink"
ADD CONSTRAINT "EmergencyPreparednessLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmergencyPreparednessLink"
ADD CONSTRAINT "EmergencyPreparednessLink_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "EmergencyPreparedness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
