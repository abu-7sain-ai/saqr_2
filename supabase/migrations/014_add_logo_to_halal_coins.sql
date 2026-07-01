-- Add logo_url to halal_coins
ALTER TABLE halal_coins ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Index for faster symbol lookups
CREATE INDEX IF NOT EXISTS idx_halal_coins_symbol ON halal_coins(symbol);
