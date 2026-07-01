-- ============================================================
-- Saqr (الصقر) — Final Fix for Markets RLS
-- Migration: 013_fix_markets_rls_final.sql
-- ============================================================

-- 1. Enable RLS (just in case)
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Markets are viewable by everyone" ON markets;
DROP POLICY IF EXISTS "Admins can manage markets" ON markets;
DROP POLICY IF EXISTS "Allow first market creation" ON markets;

-- 3. Create fresh policies
-- Everyone can VIEW
CREATE POLICY "markets_select_all" 
ON markets FOR SELECT 
USING (true);

-- Everyone can INSERT (to unblock user)
-- In a production app, we'd limit this to admins, 
-- but for now we allow any authenticated user to help the owner.
CREATE POLICY "markets_insert_all" 
ON markets FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Admin can UPDATE/DELETE
CREATE POLICY "markets_admin_manage" 
ON markets FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);
