-- ============================================================
-- Saqr (الصقر) — Profile Auto-Creation Trigger
-- Migration: 002_profile_trigger.sql
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- FUNCTION: handle_new_user
-- Automatically creates a profile row when a user signs up.
-- Profile is created with role='owner' and status='pending'.
-- The first admin must be set manually via seed_admin.sql.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'owner',
        'pending'
    )
    ON CONFLICT (id) DO NOTHING;  -- Idempotent: safe to re-run
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- TRIGGER: on_auth_user_created
-- Fires AFTER INSERT on auth.users
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
