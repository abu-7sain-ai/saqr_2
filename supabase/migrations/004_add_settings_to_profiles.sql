-- Migration: 004_add_settings_to_profiles.sql
-- Description: Add JSONB settings column to profiles table for storing flexible preferences

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Update existing profiles to have an empty object if they don't
UPDATE profiles 
SET settings = '{}'::jsonb 
WHERE settings IS NULL;
