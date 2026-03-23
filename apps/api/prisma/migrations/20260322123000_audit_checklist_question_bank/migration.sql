CREATE TABLE "AuditChecklistQuestion" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "standard" TEXT NOT NULL,
  "clause" TEXT NOT NULL,
  "subclause" TEXT,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isTemplateDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AuditChecklistQuestion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AuditChecklistItem"
ADD COLUMN "sourceQuestionId" TEXT,
ADD COLUMN "subclause" TEXT;

CREATE INDEX "AuditChecklistQuestion_tenantId_standard_clause_sortOrder_idx"
ON "AuditChecklistQuestion"("tenantId", "standard", "clause", "sortOrder");

CREATE INDEX "AuditChecklistQuestion_tenantId_isActive_idx"
ON "AuditChecklistQuestion"("tenantId", "isActive");

CREATE INDEX "AuditChecklistItem_tenantId_sourceQuestionId_idx"
ON "AuditChecklistItem"("tenantId", "sourceQuestionId");

ALTER TABLE "AuditChecklistQuestion"
ADD CONSTRAINT "AuditChecklistQuestion_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditChecklistItem"
ADD CONSTRAINT "AuditChecklistItem_sourceQuestionId_fkey"
FOREIGN KEY ("sourceQuestionId") REFERENCES "AuditChecklistQuestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
