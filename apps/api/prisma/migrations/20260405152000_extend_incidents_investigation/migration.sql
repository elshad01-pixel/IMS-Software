CREATE TYPE "IncidentRcaMethod" AS ENUM ('FIVE_WHY', 'FISHBONE', 'IS_IS_NOT', 'OTHER');

ALTER TABLE "Incident"
ADD COLUMN "rootCause" TEXT,
ADD COLUMN "rcaMethod" "IncidentRcaMethod";
