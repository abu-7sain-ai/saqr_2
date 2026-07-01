-- ============================================================
-- Saqr (الصقر) — Link Kitchen Sessions to Markets
-- Migration: 019_link_sessions_to_markets.sql
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='kitchen_sessions' AND column_name='market_id') THEN
        ALTER TABLE kitchen_sessions ADD COLUMN market_id UUID REFERENCES markets(id) ON DELETE SET NULL;
    END IF;
END $$;
