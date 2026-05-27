-- Add per-service scheduling mode and auto-distribute flag
ALTER TABLE services ADD COLUMN IF NOT EXISTS "schedulingMode" TEXT NOT NULL DEFAULT 'SCHEDULE';
ALTER TABLE services ADD COLUMN IF NOT EXISTS "autoDistribute" BOOLEAN NOT NULL DEFAULT false;

-- Add hideFromBot flag to collaborators
ALTER TABLE collaborators ADD COLUMN IF NOT EXISTS "hideFromBot" BOOLEAN NOT NULL DEFAULT false;
