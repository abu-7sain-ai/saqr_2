-- ============================================================
-- Saqr (الصقر) — Phase 4: Halal Vision & Multi-Market System
-- Migration: 011_halal_vision_system.sql
-- ============================================================

-- 1. Create exchange_configs table for managing API keys per market
CREATE TABLE IF NOT EXISTS exchange_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL, -- e.g. 'Binance', 'Alpaca'
    exchange_type   TEXT NOT NULL CHECK (exchange_type IN ('binance', 'alpaca')),
    api_key         TEXT,
    api_secret      TEXT,
    is_paper        BOOLEAN NOT NULL DEFAULT TRUE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure unique name per user
    CONSTRAINT unique_exchange_name_per_user UNIQUE (user_id, name)
);

-- 2. Update halal_coins to support the multi-market indicator logic
ALTER TABLE halal_coins 
ADD COLUMN IF NOT EXISTS exchange_config_id UUID REFERENCES exchange_configs(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS can_trade BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_indicator BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Enable RLS on exchange_configs
ALTER TABLE exchange_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own exchange configs"
    ON exchange_configs FOR ALL
    USING (auth.uid() = user_id);

-- 4. Seed initial data (Indicator example: BTCUSDT)
-- Note: This assumes BTCUSDT should be an indicator by default for Binance if it exists
DO $$
BEGIN
    -- If BTCUSDT exists, mark it as indicator
    UPDATE halal_coins SET is_indicator = TRUE WHERE symbol = 'BTCUSDT';
END $$;
