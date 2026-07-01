-- ============================================================
-- Saqr (الصقر) — Link Workers to Markets
-- Migration: 018_link_workers_to_markets.sql
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='workers' AND column_name='market_id') THEN
        ALTER TABLE workers ADD COLUMN market_id UUID REFERENCES markets(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update existing workers to a default market if any exists
DO $$
DECLARE
    v_first_market_id UUID;
BEGIN
    SELECT id INTO v_first_market_id FROM markets LIMIT 1;
    IF v_first_market_id IS NOT NULL THEN
        UPDATE workers SET market_id = v_first_market_id WHERE market_id IS NULL;
    END IF;
END $$;
