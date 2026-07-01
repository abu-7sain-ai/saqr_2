-- Migration: 008_comprehensive_schema_alignment.sql
-- Description: Creates system_settings, api_keys, plans, and activity_logs tables with RLS.

-- 1. Plans Table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- 'alpaca', 'binance', etc.
    api_key TEXT NOT NULL,
    api_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Policies for Plans (Public Read)
CREATE POLICY "Public plans are viewable by everyone" ON public.plans
    FOR SELECT USING (true);

-- Policies for System Settings (Public Read, Admin Write - simplified for now)
CREATE POLICY "System settings are viewable by everyone" ON public.system_settings
    FOR SELECT USING (true);

-- Policies for API Keys (Owner Only)
CREATE POLICY "Users can manage their own API keys" ON public.api_keys
    FOR ALL USING (auth.uid() = user_id);

-- Policies for Activity Logs (Owner Only)
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true); -- Allow system-level inserts
