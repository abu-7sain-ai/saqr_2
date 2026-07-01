-- ============================================================
-- Saqr (الصقر) — First Admin User Elevation
-- File: supabase/seed/seed_admin.sql
-- ============================================================
-- Prerequisites:
--   1. Run 001_initial_schema.sql
--   2. Run 002_profile_trigger.sql
--   3. Sign up through Supabase Auth (Dashboard > Authentication > Users)
--      OR use the invite flow to create the admin account first.
--   4. Then run this script, replacing the placeholder email below.
-- ============================================================

-- Step 1: Elevate an existing user to admin role
-- Replace 'your-admin@email.com' with the actual admin email.
UPDATE profiles
SET
    role   = 'admin',
    status = 'active'
WHERE email = 'your-admin@email.com';

-- Step 2 (optional): Verify the update was applied
-- Expected output: 1 row with role='admin', status='active'
-- SELECT id, email, role, status FROM profiles WHERE role = 'admin';

-- ============================================================
-- NOTES:
-- - Only one admin is needed for Phase 1.
-- - Additional admins can be added using the same UPDATE pattern.
-- - The trigger in 002_profile_trigger.sql ensures every new
--   signup gets role='owner', status='pending' automatically.
--   This script promotes the designated account to 'admin'.
-- ============================================================
