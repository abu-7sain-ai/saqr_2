-- ============================================================
-- Saqr (الصقر) — Fix Permissions and Schema Alignment
-- Migration: 015_fix_permissions_and_schema.sql
-- ============================================================

-- 1. Ensure market_id exists in halal_coins and is linked to markets
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='halal_coins' AND column_name='market_id') THEN
        ALTER TABLE halal_coins ADD COLUMN market_id UUID REFERENCES markets(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Update Markets RLS to allow 'owner' as well
DROP POLICY IF EXISTS "markets_admin_manage" ON markets;
CREATE POLICY "markets_manager_manage" 
ON markets FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'owner')
    )
);

-- 3. Enable and Setup RLS for halal_coins
ALTER TABLE halal_coins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "halal_coins_select_all" ON halal_coins;
CREATE POLICY "halal_coins_select_all" 
ON halal_coins FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "halal_coins_manager_manage" ON halal_coins;
CREATE POLICY "halal_coins_manager_manage" 
ON halal_coins FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'owner')
    )
);

-- 4. Fix potential issue with unique constraint in halal_coins
-- If we want to allow the same symbol in different markets, we need a composite unique constraint
ALTER TABLE halal_coins DROP CONSTRAINT IF EXISTS halal_coins_symbol_key;
ALTER TABLE halal_coins DROP CONSTRAINT IF EXISTS unique_symbol_per_market;
ALTER TABLE halal_coins ADD CONSTRAINT unique_symbol_per_market UNIQUE (symbol, market_id);
