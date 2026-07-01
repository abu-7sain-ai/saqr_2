-- ============================================================
-- Saqr (الصقر) — Authentication Flow & System Settings
-- Migration: 004_auth_flow.sql
-- ============================================================

-- 1. Update Profiles Table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_number TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Update status constraint to include 'needs_verification'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check 
    CHECK (status IN ('pending', 'needs_verification', 'active', 'rejected'));

-- 2. Create System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    twilio_api_url TEXT DEFAULT '',
    twilio_auth_token TEXT DEFAULT '',
    twilio_phone_number TEXT DEFAULT '',
    telegram_bot_token TEXT DEFAULT '',
    require_email BOOLEAN DEFAULT true,
    require_sms BOOLEAN DEFAULT false,
    require_telegram BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Insert default row if table is empty
INSERT INTO system_settings (twilio_api_url) 
SELECT '' 
WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- 3. RLS Policies for system_settings
-- Only 'owner' or 'admin' can view or update settings

DROP POLICY IF EXISTS "Admins can view system settings" ON system_settings;
CREATE POLICY "Admins can view system settings" 
    ON system_settings FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

DROP POLICY IF EXISTS "Admins can update system settings" ON system_settings;
CREATE POLICY "Admins can update system settings" 
    ON system_settings FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );

DROP POLICY IF EXISTS "Admins can insert system settings" ON system_settings;
CREATE POLICY "Admins can insert system settings" 
    ON system_settings FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND role IN ('admin', 'owner')
        )
    );
