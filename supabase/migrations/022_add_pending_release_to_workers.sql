-- Migration: 022_add_pending_release_to_workers.sql
-- Purpose: Support smart fund release logic as per Balance System spec

ALTER TABLE workers ADD COLUMN IF NOT EXISTS pending_release DECIMAL(18, 8) DEFAULT 0;

-- Optional: Add a check to ensure it doesn't go below 0
ALTER TABLE workers ADD CONSTRAINT pending_release_non_negative CHECK (pending_release >= 0);
