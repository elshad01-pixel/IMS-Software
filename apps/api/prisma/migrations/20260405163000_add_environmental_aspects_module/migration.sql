CREATE TYPE "EnvironmentalAspectStage" AS ENUM ('NORMAL_OPERATION', 'ABNORMAL_OPERATION', 'EMERGENCY');
CREATE TYPE "EnvironmentalAspectSignificance" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "EnvironmentalAspectStatus" AS ENUM ('ACTIVE', 'MONITORING', 'OBSOLETE');
CREATE TYPE "EnvironmentalAspectLinkType" AS ENUM ('PROCESS', 'RISK', 'ACTION');

CREATE TABLE "EnvironmentalAspect" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referenceNo" TEXT,
  "activity" TEXT NOT NULL,
  "aspect" TEXT NOT NULL,
  "impact" TEXT NOT NULL,
  "lifecycleStage" "EnvironmentalAspectStage" NOT NULL,
  "controlSummary" TEXT,
  "significance" "EnvironmentalAspectSignificance" NOT NULL,
  "ownerUserId" TEXT,
  "reviewDate" TIMESTAMP(3),
  "status" "EnvironmentalAspectStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,

  CONSTRAINT "EnvironmentalAspect_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnvironmentalAspectLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "aspectId" TEXT NOT NULL,
  "linkType" "EnvironmentalAspectLinkType" NOT NULL,
  "linkedId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "EnvironmentalAspectLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnvironmentalAspect_tenantId_referenceNo_key" ON "EnvironmentalAspect"("tenantId", "referenceNo");
CREATE INDEX "EnvironmentalAspect_tenantId_status_idx" ON "EnvironmentalAspect"("tenantId", "status");
CREATE INDEX "EnvironmentalAspect_tenantId_ownerUserId_idx" ON "EnvironmentalAspect"("tenantId", "ownerUserId");
CREATE INDEX "EnvironmentalAspect_tenantId_reviewDate_idx" ON "EnvironmentalAspect"("tenantId", "reviewDate");
CREATE INDEX "EnvironmentalAspect_tenantId_deletedAt_idx" ON "EnvironmentalAspect"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "EnvironmentalAspectLink_aspectId_linkType_linkedId_key" ON "EnvironmentalAspectLink"("aspectId", "linkType", "linkedId");
CREATE INDEX "EnvironmentalAspectLink_tenantId_aspectId_idx" ON "EnvironmentalAspectLink"("tenantId", "aspectId");
CREATE INDEX "EnvironmentalAspectLink_tenantId_linkType_linkedId_idx" ON "EnvironmentalAspectLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "EnvironmentalAspect"
ADD CONSTRAINT "EnvironmentalAspect_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnvironmentalAspectLink"
ADD CONSTRAINT "EnvironmentalAspectLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnvironmentalAspectLink"
ADD CONSTRAINT "EnvironmentalAspectLink_aspectId_fkey" FOREIGN KEY ("aspectId") REFERENCES "EnvironmentalAspect"("id") ON DELETE CASCADE ON UPDATE CASCADE;
