-- ============================================================
-- Saqr (الصقر) — RLS Status Check Function
-- Migration: 003_check_rls_status.sql
-- Description: Helper function for the test suite to verify 
--              that Row Level Security (RLS) is enabled on tables.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE (
    tablename TEXT,
    rowsecurity BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::TEXT, 
        t.rowsecurity 
    FROM 
        pg_tables t
    WHERE 
        t.schemaname = 'public';
END;
$$;

-- Helper to check specific policies on a table
CREATE OR REPLACE FUNCTION public.check_table_policies(p_table_name TEXT)
RETURNS TABLE (policyname TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.policyname::TEXT
    FROM 
        pg_policies p
    WHERE 
        p.schemaname = 'public' 
        AND p.tablename = p_table_name;
END;
$$;

-- Grant execution permission to authenticated and anon roles for testing purposes
GRANT EXECUTE ON FUNCTION public.check_rls_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rls_status() TO anon;
GRANT EXECUTE ON FUNCTION public.check_rls_status() TO service_role;

GRANT EXECUTE ON FUNCTION public.check_table_policies(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_table_policies(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_table_policies(TEXT) TO service_role;
