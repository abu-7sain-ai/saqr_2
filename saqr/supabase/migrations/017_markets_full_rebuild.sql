-- ============================================================
-- Saqr (الصقر) — Markets Full System Rebuild
-- Migration: 017_markets_full_rebuild.sql
-- Purpose: Replace simple markets table with full 4-table
--          system: markets, market_apis, whitelist, market_leaders
-- ============================================================

-- ============================================================
-- STEP 1: Safely evolve the existing 'markets' table
-- (Cannot DROP because halal_coins.market_id references it)
-- ============================================================

-- Add new columns to existing markets table (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='markets' AND column_name='type') THEN
        ALTER TABLE markets ADD COLUMN type TEXT DEFAULT 'crypto'
            CHECK (type IN ('crypto', 'stocks', 'forex'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='markets' AND column_name='is_active') THEN
        ALTER TABLE markets ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        -- Copy over from old 'active' column if it exists
        UPDATE markets SET is_active = active WHERE is_active IS NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='markets' AND column_name='user_id') THEN
        ALTER TABLE markets ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================
-- STEP 2: market_apis — 3 API groups per market
-- ============================================================
CREATE TABLE IF NOT EXISTS market_apis (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id           UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- API المتابعة — Watch prices in real-time
    watch_api_key       TEXT,
    watch_api_secret    TEXT,

    -- API التحكم — Enter and exit trades
    control_api_key     TEXT,
    control_api_secret  TEXT,

    -- API البيانات القديمة — Historical data for backtesting
    historical_api_key   TEXT,
    historical_api_secret TEXT,

    -- Connection status per API type
    watch_connected     BOOLEAN DEFAULT FALSE,
    control_connected   BOOLEAN DEFAULT FALSE,
    historical_connected BOOLEAN DEFAULT FALSE,

    last_tested_at      TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='market_apis' AND column_name='historical_api_secret') THEN
        ALTER TABLE market_apis ADD COLUMN historical_api_secret TEXT;
    END IF;
END $$;

-- ============================================================
-- STEP 3: whitelist — Symbols the worker CAN trade
-- ============================================================
CREATE TABLE IF NOT EXISTS whitelist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    symbol      TEXT NOT NULL,
    symbol_name TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One symbol per market
    CONSTRAINT unique_whitelist_symbol UNIQUE (market_id, symbol)
);

-- ============================================================
-- STEP 4: market_leaders — Symbols to MONITOR for direction
-- ============================================================
CREATE TABLE IF NOT EXISTS market_leaders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id   UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
    symbol      TEXT NOT NULL,
    symbol_name TEXT,
    reason      TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One symbol per market
    CONSTRAINT unique_leader_symbol UNIQUE (market_id, symbol)
);

-- ============================================================
-- STEP 5: Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_market_apis_market_id ON market_apis(market_id);
CREATE INDEX IF NOT EXISTS idx_whitelist_market_id ON whitelist(market_id);
CREATE INDEX IF NOT EXISTS idx_market_leaders_market_id ON market_leaders(market_id);

-- ============================================================
-- STEP 6: RLS for market_apis
-- ============================================================
ALTER TABLE market_apis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_apis_select" ON market_apis;
CREATE POLICY "market_apis_select"
ON market_apis FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "market_apis_manage" ON market_apis;
CREATE POLICY "market_apis_manage"
ON market_apis FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
);

-- ============================================================
-- STEP 7: RLS for whitelist
-- ============================================================
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whitelist_select" ON whitelist;
CREATE POLICY "whitelist_select"
ON whitelist FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "whitelist_manage" ON whitelist;
CREATE POLICY "whitelist_manage"
ON whitelist FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
);

-- ============================================================
-- STEP 8: RLS for market_leaders
-- ============================================================
ALTER TABLE market_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "market_leaders_select" ON market_leaders;
CREATE POLICY "market_leaders_select"
ON market_leaders FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "market_leaders_manage" ON market_leaders;
CREATE POLICY "market_leaders_manage"
ON market_leaders FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
);

-- ============================================================
-- STEP 9: Update markets RLS to use new is_active column
-- ============================================================
DROP POLICY IF EXISTS "markets_manager_manage" ON markets;
CREATE POLICY "markets_manager_manage"
ON markets FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
);
