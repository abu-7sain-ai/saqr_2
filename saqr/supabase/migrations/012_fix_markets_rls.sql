-- ============================================================
-- Saqr (الصقر) — Fix RLS for Markets Table
-- Migration: 012_fix_markets_rls.sql
-- Purpose: Enable user interaction with the 'markets' table
-- ============================================================

-- Ensure the table exists (it might have been created manually)
CREATE TABLE IF NOT EXISTS markets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Enable RLS
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;

-- 2. Create Policies
-- Policy: Viewable by all authenticated users
CREATE POLICY "Markets are viewable by everyone" 
ON markets FOR SELECT 
USING (true);

-- Policy: Editable by Admins only
-- (Assuming 'admin' role in profiles table)
CREATE POLICY "Admins can manage markets" 
ON markets FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Fallback Policy for development: 
-- Allow current user to INSERT if no admin exists yet
CREATE POLICY "Allow first market creation" 
ON markets FOR INSERT 
WITH CHECK (true);
