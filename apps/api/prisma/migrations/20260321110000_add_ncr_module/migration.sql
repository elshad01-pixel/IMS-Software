CREATE TYPE "NcrCategory" AS ENUM ('PROCESS', 'PRODUCT', 'SERVICE', 'SUPPLIER', 'COMPLAINT');
CREATE TYPE "NcrSource" AS ENUM ('INTERNAL', 'CUSTOMER', 'SUPPLIER', 'AUDIT');
CREATE TYPE "NcrStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'INVESTIGATION',
  'ACTION_IN_PROGRESS',
  'PENDING_VERIFICATION',
  'CLOSED',
  'ARCHIVED'
);
CREATE TYPE "NcrSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "NcrPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "NcrVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "NcrRcaMethod" AS ENUM ('FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER');

CREATE TABLE "Ncr" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "deletedById" TEXT,
  "referenceNo" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "NcrCategory" NOT NULL,
  "source" "NcrSource" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "NcrStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "NcrSeverity" NOT NULL,
  "priority" "NcrPriority" NOT NULL,
  "dateReported" TIMESTAMP(3) NOT NULL,
  "reportedByUserId" TEXT,
  "ownerUserId" TEXT,
  "department" TEXT,
  "location" TEXT,
  "dueDate" TIMESTAMP(3),
  "containmentAction" TEXT,
  "investigationSummary" TEXT,
  "rootCause" TEXT,
  "rcaMethod" "NcrRcaMethod",
  "correctiveActionSummary" TEXT,
  "verificationStatus" "NcrVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verifiedByUserId" TEXT,
  "verificationDate" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Ncr_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NcrComment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ncrId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NcrComment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Ncr_tenantId_referenceNo_key" ON "Ncr"("tenantId", "referenceNo");
CREATE INDEX "Ncr_tenantId_idx" ON "Ncr"("tenantId");
CREATE INDEX "Ncr_tenantId_status_idx" ON "Ncr"("tenantId", "status");
CREATE INDEX "Ncr_tenantId_ownerUserId_idx" ON "Ncr"("tenantId", "ownerUserId");
CREATE INDEX "Ncr_tenantId_dueDate_idx" ON "Ncr"("tenantId", "dueDate");
CREATE INDEX "NcrComment_tenantId_ncrId_createdAt_idx" ON "NcrComment"("tenantId", "ncrId", "createdAt");

ALTER TABLE "Ncr"
ADD CONSTRAINT "Ncr_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NcrComment"
ADD CONSTRAINT "NcrComment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NcrComment"
ADD CONSTRAINT "NcrComment_ncrId_fkey"
FOREIGN KEY ("ncrId") REFERENCES "Ncr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NcrComment"
ADD CONSTRAINT "NcrComment_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
