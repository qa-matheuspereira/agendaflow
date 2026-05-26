-- Migration: add separate message template for daily reminder
-- Run in Coolify terminal: psql $DATABASE_URL -f this_file.sql

ALTER TABLE "whatsapp_configs"
  ADD COLUMN IF NOT EXISTS "dailyReminderMessage" TEXT;
