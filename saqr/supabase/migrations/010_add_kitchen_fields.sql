-- Migration: 010_add_kitchen_fields.sql
-- Purpose: Add missing columns to kitchen_sessions to support the new Expert Meeting Window features

ALTER TABLE kitchen_sessions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS symbol TEXT DEFAULT 'BTCUSDT',
ADD COLUMN IF NOT EXISTS issuers JSONB DEFAULT '["prince"]'::jsonb;

-- Update existing sessions to have a status
UPDATE kitchen_sessions SET status = 'completed' WHERE final_decision IS NOT NULL;
UPDATE kitchen_sessions SET status = 'pending' WHERE final_decision IS NULL;
