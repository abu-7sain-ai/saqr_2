-- إضافة حقل metadata لجداول القوائم
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE market_leaders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- إضافة حقول API جلب العملات لجدول market_apis
ALTER TABLE market_apis ADD COLUMN IF NOT EXISTS fetch_api_key TEXT;
ALTER TABLE market_apis ADD COLUMN IF NOT EXISTS fetch_api_secret TEXT;
ALTER TABLE market_apis ADD COLUMN IF NOT EXISTS fetch_connected BOOLEAN DEFAULT FALSE;
