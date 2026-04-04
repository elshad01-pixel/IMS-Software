-- CreateEnum
CREATE TYPE "ProcessRegisterStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProcessRegisterLinkType" AS ENUM ('DOCUMENT', 'RISK', 'AUDIT', 'KPI', 'ACTION', 'NCR');

-- CreateTable
CREATE TABLE "ProcessRegister" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referenceNo" TEXT,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "ownerUserId" TEXT,
    "department" TEXT,
    "scope" TEXT,
    "inputsText" TEXT,
    "outputsText" TEXT,
    "status" "ProcessRegisterStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,

    CONSTRAINT "ProcessRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRegisterLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "linkType" "ProcessRegisterLinkType" NOT NULL,
    "linkedId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ProcessRegisterLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegister_tenantId_referenceNo_key" ON "ProcessRegister"("tenantId", "referenceNo");

-- CreateIndex
CREATE INDEX "ProcessRegister_tenantId_status_idx" ON "ProcessRegister"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ProcessRegister_tenantId_ownerUserId_idx" ON "ProcessRegister"("tenantId", "ownerUserId");

-- CreateIndex
CREATE INDEX "ProcessRegister_tenantId_deletedAt_idx" ON "ProcessRegister"("tenantId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRegisterLink_processId_linkType_linkedId_key" ON "ProcessRegisterLink"("processId", "linkType", "linkedId");

-- CreateIndex
CREATE INDEX "ProcessRegisterLink_tenantId_processId_idx" ON "ProcessRegisterLink"("tenantId", "processId");

-- CreateIndex
CREATE INDEX "ProcessRegisterLink_tenantId_linkType_linkedId_idx" ON "ProcessRegisterLink"("tenantId", "linkType", "linkedId");

-- AddForeignKey
ALTER TABLE "ProcessRegister" ADD CONSTRAINT "ProcessRegister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegister" ADD CONSTRAINT "ProcessRegister_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegister" ADD CONSTRAINT "ProcessRegister_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegisterLink" ADD CONSTRAINT "ProcessRegisterLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegisterLink" ADD CONSTRAINT "ProcessRegisterLink_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ProcessRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRegisterLink" ADD CONSTRAINT "ProcessRegisterLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
