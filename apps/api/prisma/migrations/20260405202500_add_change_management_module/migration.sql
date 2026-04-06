CREATE TYPE "ChangeRequestType" AS ENUM ('PROCESS', 'PRODUCT', 'EQUIPMENT', 'MATERIAL', 'ORGANIZATIONAL', 'DOCUMENTATION', 'FACILITY', 'OTHER');
CREATE TYPE "ChangeRequestStatus" AS ENUM ('PROPOSED', 'REVIEWING', 'APPROVED', 'IMPLEMENTING', 'VERIFIED', 'CLOSED', 'REJECTED');
CREATE TYPE "ChangeRequestLinkType" AS ENUM ('PROCESS', 'RISK', 'ACTION', 'DOCUMENT', 'OBLIGATION', 'PROVIDER');

CREATE TABLE "ChangeRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referenceNo" TEXT,
  "title" TEXT NOT NULL,
  "changeType" "ChangeRequestType" NOT NULL,
  "reason" TEXT NOT NULL,
  "affectedArea" TEXT NOT NULL,
  "proposedChange" TEXT NOT NULL,
  "impactSummary" TEXT,
  "controlSummary" TEXT,
  "ownerUserId" TEXT,
  "targetImplementationDate" TIMESTAMP(3),
  "reviewDate" TIMESTAMP(3),
  "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "deletedById" TEXT,

  CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChangeRequestLink" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "changeId" TEXT NOT NULL,
  "linkType" "ChangeRequestLinkType" NOT NULL,
  "linkedId" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,

  CONSTRAINT "ChangeRequestLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChangeRequest_tenantId_referenceNo_key" ON "ChangeRequest"("tenantId", "referenceNo");
CREATE INDEX "ChangeRequest_tenantId_status_idx" ON "ChangeRequest"("tenantId", "status");
CREATE INDEX "ChangeRequest_tenantId_ownerUserId_idx" ON "ChangeRequest"("tenantId", "ownerUserId");
CREATE INDEX "ChangeRequest_tenantId_targetImplementationDate_idx" ON "ChangeRequest"("tenantId", "targetImplementationDate");
CREATE INDEX "ChangeRequest_tenantId_deletedAt_idx" ON "ChangeRequest"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "ChangeRequestLink_changeId_linkType_linkedId_key" ON "ChangeRequestLink"("changeId", "linkType", "linkedId");
CREATE INDEX "ChangeRequestLink_tenantId_changeId_idx" ON "ChangeRequestLink"("tenantId", "changeId");
CREATE INDEX "ChangeRequestLink_tenantId_linkType_linkedId_idx" ON "ChangeRequestLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "ChangeRequest"
ADD CONSTRAINT "ChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeRequestLink"
ADD CONSTRAINT "ChangeRequestLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeRequestLink"
ADD CONSTRAINT "ChangeRequestLink_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "ChangeRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
