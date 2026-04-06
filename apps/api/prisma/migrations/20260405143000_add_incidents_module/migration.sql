CREATE TYPE "IncidentType" AS ENUM ('INCIDENT', 'NEAR_MISS');

CREATE TYPE "IncidentCategory" AS ENUM ('SAFETY', 'ENVIRONMENT', 'QUALITY', 'SECURITY', 'OTHER');

CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'INVESTIGATION', 'ACTION_IN_PROGRESS', 'CLOSED', 'ARCHIVED');

CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "IncidentLinkType" AS ENUM ('PROCESS', 'RISK', 'ACTION');

CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referenceNo" TEXT,
    "title" TEXT NOT NULL,
    "type" "IncidentType" NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "ownerUserId" TEXT,
    "severity" "IncidentSeverity" NOT NULL,
    "immediateAction" TEXT,
    "investigationSummary" TEXT,
    "correctiveActionSummary" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "linkType" "IncidentLinkType" NOT NULL,
    "linkedId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "IncidentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Incident_tenantId_referenceNo_key" ON "Incident"("tenantId", "referenceNo");
CREATE INDEX "Incident_tenantId_status_idx" ON "Incident"("tenantId", "status");
CREATE INDEX "Incident_tenantId_type_idx" ON "Incident"("tenantId", "type");
CREATE INDEX "Incident_tenantId_ownerUserId_idx" ON "Incident"("tenantId", "ownerUserId");
CREATE INDEX "Incident_tenantId_eventDate_idx" ON "Incident"("tenantId", "eventDate");
CREATE INDEX "Incident_tenantId_deletedAt_idx" ON "Incident"("tenantId", "deletedAt");

CREATE UNIQUE INDEX "IncidentLink_incidentId_linkType_linkedId_key" ON "IncidentLink"("incidentId", "linkType", "linkedId");
CREATE INDEX "IncidentLink_tenantId_incidentId_idx" ON "IncidentLink"("tenantId", "incidentId");
CREATE INDEX "IncidentLink_tenantId_linkType_linkedId_idx" ON "IncidentLink"("tenantId", "linkType", "linkedId");

ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentLink"
ADD CONSTRAINT "IncidentLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentLink"
ADD CONSTRAINT "IncidentLink_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
