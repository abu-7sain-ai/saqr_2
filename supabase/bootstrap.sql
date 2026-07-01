-- ============================================================
-- Saqr (الصقر) — Bootstrap: Remote SQL Execution
-- Description: Creates the exec_sql function required by the
--              migration runner script.
-- IMPORTANT: Run this MANUALLY in the Supabase SQL Editor first.
-- ============================================================

CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Secure it to service_role only (safe for local scripts)
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
