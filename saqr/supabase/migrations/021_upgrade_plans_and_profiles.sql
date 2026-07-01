-- Migration: 021_upgrade_plans_and_profiles.sql
-- Purpose: Align plans and profiles with Section 19 specifications

-- 1. Upgrade PLANS table
ALTER TABLE plans ADD COLUMN IF NOT EXISTS min_recharge DECIMAL(18, 8) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS alert_threshold DECIMAL(18, 8) DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stop_threshold DECIMAL(18, 8) DEFAULT 0;

-- Update existing plans with Section 19 specs
-- Package 1: Basic
UPDATE plans SET 
    monthly_cost = 20,
    token_margin_pct = 15,
    profit_share_pct = 5,
    min_recharge = 30,
    alert_threshold = 15,
    stop_threshold = 3
WHERE id = 'package_1';

-- Package 2: Professional
UPDATE plans SET 
    monthly_cost = 50,
    token_margin_pct = 10,
    profit_share_pct = 3,
    min_recharge = 50,
    alert_threshold = 25,
    stop_threshold = 5
WHERE id = 'package_2';

-- Add Package 3 if it doesn't exist (Enterprise/Elite)
INSERT INTO plans (id, name, monthly_cost, token_margin_pct, profit_share_pct, min_recharge, alert_threshold, stop_threshold)
VALUES ('package_3', 'باقة الصقر 3 - احترافية+', 99, 5, 2, 100, 50, 10)
ON CONFLICT (id) DO UPDATE SET
    monthly_cost = EXCLUDED.monthly_cost,
    token_margin_pct = EXCLUDED.token_margin_pct,
    profit_share_pct = EXCLUDED.profit_share_pct,
    min_recharge = EXCLUDED.min_recharge,
    alert_threshold = EXCLUDED.alert_threshold,
    stop_threshold = EXCLUDED.stop_threshold;

-- 2. Upgrade PROFILES table
-- Ensure default status is 'pending' for new users
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'pending';

-- Add mobile field if missing (already exists but just in case)
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mobile TEXT;
