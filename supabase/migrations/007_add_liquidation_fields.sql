-- Migration: 007_add_liquidation_fields.sql
-- Description: Adds fields to workers table for gradual liquidation tracking.

-- 1. Add columns to workers table
ALTER TABLE public.workers 
ADD COLUMN IF NOT EXISTS pending_withdrawal_amount DECIMAL(18, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS withdrawn_amount DECIMAL(18, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS withdrawal_mode TEXT DEFAULT 'aggressive' CHECK (withdrawal_mode IN ('aggressive', 'profit_only'));

-- 2. Add comment for documentation
COMMENT ON COLUMN public.workers.pending_withdrawal_amount IS 'Target amount to extract from the worker.';
COMMENT ON COLUMN public.workers.withdrawn_amount IS 'Cash successfully swept into the freed pool so far.';
COMMENT ON COLUMN public.workers.withdrawal_mode IS 'The liquidation strategy: aggressive (all returns) or profit_only.';
