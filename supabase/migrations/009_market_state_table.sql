-- Migration: 009_market_state_table.sql
-- Description: Tracks global market state and pending switches for Saqr.

CREATE TABLE IF NOT EXISTS public.market_state (
    id INTEGER PRIMARY KEY DEFAULT 1, -- Single row for global state
    current_type TEXT NOT NULL DEFAULT 'stable' CHECK (current_type IN ('stable', 'volatile')),
    pending_type TEXT CHECK (pending_type IN ('stable', 'volatile')),
    pending_since TIMESTAMP WITH TIME ZONE,
    last_switch_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    atr_sma_14 DECIMAL(18, 8),
    volume_sma_14 DECIMAL(18, 8),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one row exists
    CONSTRAINT market_state_singleton CHECK (id = 1)
);

-- Initialize global state
INSERT INTO public.market_state (id, current_type, last_switch_at)
VALUES (1, 'stable', NOW())
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.market_state ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Market state is viewable by everyone" ON public.market_state
    FOR SELECT USING (true);

CREATE POLICY "System can update market state" ON public.market_state
    FOR UPDATE USING (true); -- Simplified for system-level updates
