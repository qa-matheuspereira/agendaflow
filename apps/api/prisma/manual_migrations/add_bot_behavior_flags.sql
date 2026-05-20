-- Migration: add bot behavior flags to whatsapp_configs
-- Run this in the Coolify terminal (psql or node -e with prisma.$executeRawUnsafe)

ALTER TABLE "whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "skipCollaboratorSelection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "allowMultipleServices" BOOLEAN NOT NULL DEFAULT false;
