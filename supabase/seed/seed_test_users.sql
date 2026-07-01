-- ============================================================
-- Saqr (الصقر) — Seed Test Users
-- File: supabase/seed/seed_test_users.sql
-- Description: Inserts fixed UUID users into auth.users to 
--              satisfy foreign key constraints during Phase 1 tests.
-- ============================================================

-- Note: We use the 'authenticated' role and 'authenticated' aud
-- to match Supabase Auth defaults.

INSERT INTO auth.users (
    id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    role, 
    aud, 
    instance_id
)
VALUES 
    (
        '00000000-0000-0000-0000-000000000001', 
        'test_crud@example.com', 
        crypt('testpassword', gen_salt('bf')), 
        now(), 
        'authenticated', 
        'authenticated', 
        '00000000-0000-0000-0000-000000000000'
    ),
    (
        '00000000-0000-0000-0000-00000000000A', 
        'user_a@example.com', 
        crypt('testpassword', gen_salt('bf')), 
        now(), 
        'authenticated', 
        'authenticated', 
        '00000000-0000-0000-0000-000000000000'
    ),
    (
        '00000000-0000-0000-0000-00000000000B', 
        'user_b@example.com', 
        crypt('testpassword', gen_salt('bf')), 
        now(), 
        'authenticated', 
        'authenticated', 
        '00000000-0000-0000-0000-000000000000'
    )
ON CONFLICT (id) DO NOTHING;

-- Ensure profiles are also created (though the trigger should handle it)
-- We manually insert/update status to 'active' for testing convenience.
INSERT INTO public.profiles (id, name, email, role, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'CRUD Tester', 'test_crud@example.com', 'owner', 'active'),
    ('00000000-0000-0000-0000-00000000000A', 'User A', 'user_a@example.com', 'owner', 'active'),
    ('00000000-0000-0000-0000-00000000000B', 'User B', 'user_b@example.com', 'owner', 'active')
ON CONFLICT (id) DO UPDATE 
SET status = 'active';
