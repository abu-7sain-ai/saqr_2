-- ============================================================
-- Saqr (الصقر) — Row-Level Security Policies
-- File: supabase/policies/rls_policies.sql
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kitchen_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_backup     ENABLE ROW LEVEL SECURITY;
ALTER TABLE halal_coins      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER: Admin check (reused across policies)
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- TABLE: profiles
-- Users can read/update their own profile.
-- Admin can manage all profiles.
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"   ON profiles;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_admin_all" ON profiles
    FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: workers
-- Users see/modify only their own workers.
-- Admin has unrestricted access.
-- ============================================================

DROP POLICY IF EXISTS "workers_select_own"   ON workers;
DROP POLICY IF EXISTS "workers_insert_own"   ON workers;
DROP POLICY IF EXISTS "workers_update_own"   ON workers;
DROP POLICY IF EXISTS "workers_delete_own"   ON workers;
DROP POLICY IF EXISTS "workers_admin_all"    ON workers;

CREATE POLICY "workers_select_own" ON workers
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "workers_insert_own" ON workers
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "workers_update_own" ON workers
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "workers_delete_own" ON workers
    FOR DELETE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "workers_admin_all" ON workers
    FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: trades
-- Users see/modify only their own trades.
-- Admin has unrestricted access.
-- ============================================================

DROP POLICY IF EXISTS "trades_select_own"    ON trades;
DROP POLICY IF EXISTS "trades_insert_own"    ON trades;
DROP POLICY IF EXISTS "trades_update_own"    ON trades;
DROP POLICY IF EXISTS "trades_delete_own"    ON trades;
DROP POLICY IF EXISTS "trades_admin_all"     ON trades;

CREATE POLICY "trades_select_own" ON trades
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "trades_insert_own" ON trades
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "trades_update_own" ON trades
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "trades_delete_own" ON trades
    FOR DELETE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "trades_admin_all" ON trades
    FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: kitchen_sessions
-- Users see/modify only their own sessions.
-- Admin has unrestricted access.
-- ============================================================

DROP POLICY IF EXISTS "kitchen_select_own"   ON kitchen_sessions;
DROP POLICY IF EXISTS "kitchen_insert_own"   ON kitchen_sessions;
DROP POLICY IF EXISTS "kitchen_update_own"   ON kitchen_sessions;
DROP POLICY IF EXISTS "kitchen_delete_own"   ON kitchen_sessions;
DROP POLICY IF EXISTS "kitchen_admin_all"    ON kitchen_sessions;

CREATE POLICY "kitchen_select_own" ON kitchen_sessions
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "kitchen_insert_own" ON kitchen_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "kitchen_update_own" ON kitchen_sessions
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "kitchen_delete_own" ON kitchen_sessions
    FOR DELETE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "kitchen_admin_all" ON kitchen_sessions
    FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: local_backup
-- Users see/modify only their own backups.
-- Admin has unrestricted access.
-- ============================================================

DROP POLICY IF EXISTS "backup_select_own"    ON local_backup;
DROP POLICY IF EXISTS "backup_insert_own"    ON local_backup;
DROP POLICY IF EXISTS "backup_update_own"    ON local_backup;
DROP POLICY IF EXISTS "backup_delete_own"    ON local_backup;
DROP POLICY IF EXISTS "backup_admin_all"     ON local_backup;

CREATE POLICY "backup_select_own" ON local_backup
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "backup_insert_own" ON local_backup
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "backup_update_own" ON local_backup
    FOR UPDATE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "backup_delete_own" ON local_backup
    FOR DELETE USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "backup_admin_all" ON local_backup
    FOR ALL USING (is_admin());

-- ============================================================
-- TABLE: halal_coins
-- Special: ALL authenticated users can SELECT (read whitelist)
-- Only admin can INSERT / UPDATE / DELETE
-- ============================================================

DROP POLICY IF EXISTS "coins_select_all_auth" ON halal_coins;
DROP POLICY IF EXISTS "coins_admin_insert"     ON halal_coins;
DROP POLICY IF EXISTS "coins_admin_update"     ON halal_coins;
DROP POLICY IF EXISTS "coins_admin_delete"     ON halal_coins;

CREATE POLICY "coins_select_all_auth" ON halal_coins
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "coins_admin_insert" ON halal_coins
    FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "coins_admin_update" ON halal_coins
    FOR UPDATE USING (is_admin());

CREATE POLICY "coins_admin_delete" ON halal_coins
    FOR DELETE USING (is_admin());
