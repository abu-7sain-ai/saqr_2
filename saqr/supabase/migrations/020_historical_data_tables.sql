-- ============================================================
-- Saqr (الصقر) — Historical Data Tables for Quantitative Trading
-- Migration: 020_historical_data_tables.sql
--
-- Purpose:
--   Store 10 years of OHLCV candles and Fear & Greed index
--   for quantitative pattern matching in the Expert Meeting.
-- ============================================================

-- ============================================================
-- 1. OHLCV Historical Data (شموع تاريخية)
-- ============================================================
CREATE TABLE IF NOT EXISTS historical_ohlcv (
    id          BIGSERIAL PRIMARY KEY,
    symbol      TEXT        NOT NULL,             -- e.g. 'BTC/USDT'
    timeframe   TEXT        NOT NULL DEFAULT '4h', -- e.g. '4h', '1d'
    timestamp   TIMESTAMPTZ NOT NULL,             -- candle open time (UTC)
    open        DOUBLE PRECISION NOT NULL,
    high        DOUBLE PRECISION NOT NULL,
    low         DOUBLE PRECISION NOT NULL,
    close       DOUBLE PRECISION NOT NULL,
    volume      DOUBLE PRECISION NOT NULL DEFAULT 0,

    -- Pre-computed indicators (calculated on insert/update)
    rsi_14      DOUBLE PRECISION,  -- RSI(14)
    ema_20      DOUBLE PRECISION,  -- EMA(20)
    ema_50      DOUBLE PRECISION,  -- EMA(50)
    ema_200     DOUBLE PRECISION,  -- EMA(200)
    atr_14      DOUBLE PRECISION,  -- ATR(14)
    volume_sma_20 DOUBLE PRECISION, -- 20-period Volume SMA

    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Prevent duplicate candles
    CONSTRAINT uq_ohlcv_symbol_tf_ts UNIQUE (symbol, timeframe, timestamp)
);

-- Indexes for fast quantitative queries
CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_tf
    ON historical_ohlcv (symbol, timeframe);

CREATE INDEX IF NOT EXISTS idx_ohlcv_ts
    ON historical_ohlcv (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ohlcv_rsi
    ON historical_ohlcv (rsi_14)
    WHERE rsi_14 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ohlcv_symbol_tf_ts_desc
    ON historical_ohlcv (symbol, timeframe, timestamp DESC);


-- ============================================================
-- 2. Fear & Greed Historical Data (مؤشر الخوف والطمع)
-- ============================================================
CREATE TABLE IF NOT EXISTS historical_fear_greed (
    id          BIGSERIAL PRIMARY KEY,
    date        DATE        NOT NULL UNIQUE,       -- one value per day
    value       INTEGER     NOT NULL,              -- 0-100
    label       TEXT        NOT NULL,              -- 'Extreme Fear', 'Fear', etc.
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fg_date
    ON historical_fear_greed (date DESC);

CREATE INDEX IF NOT EXISTS idx_fg_value
    ON historical_fear_greed (value);


-- ============================================================
-- 3. Data Sync Metadata (حالة المزامنة)
-- ============================================================
CREATE TABLE IF NOT EXISTS historical_sync_status (
    id              BIGSERIAL PRIMARY KEY,
    data_type       TEXT        NOT NULL,           -- 'ohlcv' or 'fear_greed'
    symbol          TEXT,                            -- only for ohlcv
    timeframe       TEXT,                            -- only for ohlcv
    last_synced_at  TIMESTAMPTZ,                     -- last successful sync
    oldest_record   TIMESTAMPTZ,                     -- earliest data point
    newest_record   TIMESTAMPTZ,                     -- latest data point
    total_records   BIGINT      DEFAULT 0,
    status          TEXT        NOT NULL DEFAULT 'pending', -- pending/syncing/done/error
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_sync_type UNIQUE (data_type, symbol, timeframe)
);


-- ============================================================
-- 4. RLS Policies (بيانات نظام — قراءة للجميع، كتابة للأدمن)
-- ============================================================
ALTER TABLE historical_ohlcv ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_fear_greed ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_sync_status ENABLE ROW LEVEL SECURITY;

-- Read access for all authenticated users
CREATE POLICY "historical_ohlcv_read" ON historical_ohlcv
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "historical_fear_greed_read" ON historical_fear_greed
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "historical_sync_status_read" ON historical_sync_status
    FOR SELECT TO authenticated
    USING (true);

-- Write access via service key only (backend admin)
-- No INSERT/UPDATE/DELETE policies for anon/authenticated
-- The backend uses service_role key which bypasses RLS

-- ============================================================
-- 5. Comments for documentation
-- ============================================================
COMMENT ON TABLE historical_ohlcv IS 'بيانات الشموع التاريخية (10 سنوات) لمطابقة الأنماط الكمية';
COMMENT ON TABLE historical_fear_greed IS 'مؤشر الخوف والطمع التاريخي للتحليل الكمي';
COMMENT ON TABLE historical_sync_status IS 'حالة مزامنة البيانات التاريخية';
