-- Add explicit linkage from audit findings to checklist items for traceability
ALTER TABLE "AuditFinding"
ADD COLUMN "checklistItemId" TEXT,
ADD COLUMN "clause" TEXT;

ALTER TABLE "AuditFinding"
ADD CONSTRAINT "AuditFinding_checklistItemId_fkey"
FOREIGN KEY ("checklistItemId") REFERENCES "AuditChecklistItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "AuditFinding_tenantId_checklistItemId_idx"
ON "AuditFinding"("tenantId", "checklistItemId");
