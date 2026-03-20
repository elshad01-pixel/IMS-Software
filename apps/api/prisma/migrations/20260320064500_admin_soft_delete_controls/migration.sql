ALTER TABLE "Attachment" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Attachment" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "ActionItem" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ActionItem" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "Document" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "Risk" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Risk" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "Capa" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Capa" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "Audit" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Audit" ADD COLUMN "deletedById" TEXT;

ALTER TABLE "ManagementReview" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ManagementReview" ADD COLUMN "deletedById" TEXT;
