-- ============================================================
-- Saqr (الصقر) — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Tables: workers, trades, kitchen_sessions, profiles,
--         local_backup, halal_coins
-- Run via Supabase SQL Editor or: npx supabase db push
-- ============================================================

-- ============================================================
-- 1. PROFILES (ملفات المستخدمين)
-- Linked to Supabase Auth — created automatically via trigger
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    mobile      TEXT,
    role        TEXT NOT NULL DEFAULT 'owner'
                    CHECK (role IN ('admin', 'owner', 'viewer')),
    package     TEXT NOT NULL DEFAULT 'free',
    balance     DECIMAL(18, 8) NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'active', 'rejected')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. HALAL_COINS (العملات الحلال)
-- Whitelist of approved assets — admin-managed only
-- ALL system operations MUST filter against this table
-- ============================================================
CREATE TABLE IF NOT EXISTS halal_coins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol      TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    exchange    TEXT NOT NULL DEFAULT 'binance'
                    CHECK (exchange IN ('binance', 'alpaca', 'both')),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT
);

-- ============================================================
-- 3. KITCHEN_SESSIONS (جلسات الاجتماع)
-- Expert meeting records — must exist before workers it produces
-- ============================================================
CREATE TABLE IF NOT EXISTS kitchen_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    market_type     TEXT CHECK (market_type IN ('stable', 'volatile')),
    risk_level      DECIMAL(5, 2),
    angle           TEXT,
    capital_target  DECIMAL(18, 8),
    expert_opinions JSONB,
    final_decision  JSONB,
    workers_created JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tag             TEXT,
    project_tag     TEXT
);

-- ============================================================
-- 4. WORKERS (الموظفون)
-- Trading bot instances — self-referencing FK for buddy system
-- ============================================================
CREATE TABLE IF NOT EXISTS workers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    number              INTEGER NOT NULL,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL CHECK (type IN ('paper', 'live')),
    market_type         TEXT NOT NULL CHECK (market_type IN ('stable', 'volatile')),
    owner               TEXT NOT NULL CHECK (owner IN ('prince', 'king', 'sniper')),
    paired_with         UUID REFERENCES workers(id) ON DELETE SET NULL,
    status              TEXT NOT NULL DEFAULT 'stopped'
                            CHECK (status IN ('running', 'stopped', 'paused')),
    strategy_name       TEXT,
    strategy_details    JSONB,
    user_settings       JSONB,
    starting_capital    DECIMAL(18, 8) NOT NULL DEFAULT 0,
    current_capital     DECIMAL(18, 8) NOT NULL DEFAULT 0,
    total_profit_loss   DECIMAL(18, 8) NOT NULL DEFAULT 0,
    released_amount     DECIMAL(18, 8) NOT NULL DEFAULT 0,
    color               TEXT CHECK (color IN ('green', 'red', 'gray')),
    kitchen_session_id  UUID REFERENCES kitchen_sessions(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_run_at         TIMESTAMPTZ,
    tag                 TEXT,
    project_tag         TEXT,

    -- Composite uniqueness: same number can exist across different users or categories
    CONSTRAINT workers_unique_number
        UNIQUE (user_id, owner, market_type, number)
);

-- ============================================================
-- 5. TRADES (الصفقات)
-- Individual trade records linked to a worker
-- ============================================================
CREATE TABLE IF NOT EXISTS trades (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    worker_id           UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    worker_number       INTEGER,
    pair                TEXT NOT NULL,
    entry_price         DECIMAL(18, 8),
    exit_price          DECIMAL(18, 8),
    amount_planned      DECIMAL(18, 8),
    amount_actual       DECIMAL(18, 8),
    is_trimmed          BOOLEAN NOT NULL DEFAULT FALSE,
    trim_reason         TEXT,
    slippage            DECIMAL(10, 6) NOT NULL DEFAULT 0.001,
    commission          DECIMAL(18, 8),
    spread              DECIMAL(18, 8),
    result              DECIMAL(18, 8),
    result_percentage   DECIMAL(10, 6),
    color_base          TEXT CHECK (color_base IN ('green', 'red', 'gray')),
    is_trimmed_flag     BOOLEAN NOT NULL DEFAULT FALSE,
    entry_reason        TEXT,
    exit_reason         TEXT,
    exit_type           TEXT CHECK (exit_type IN ('target', 'stop_loss', 'expired', 'manual')),
    manual_exit_reason  TEXT,
    ai_summary          TEXT,
    duration_minutes    INTEGER,
    entry_at            TIMESTAMPTZ,
    exit_at             TIMESTAMPTZ,
    tag                 TEXT,
    project_tag         TEXT
);

-- ============================================================
-- 6. LOCAL_BACKUP (النسخ الاحتياطية)
-- Offline-first trade storage — synced tracks upload status
-- ============================================================
CREATE TABLE IF NOT EXISTS local_backup (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trade_data  JSONB NOT NULL,
    synced      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- workers
CREATE INDEX IF NOT EXISTS idx_workers_user_id
    ON workers (user_id);
CREATE INDEX IF NOT EXISTS idx_workers_category
    ON workers (user_id, owner, market_type);

-- trades
CREATE INDEX IF NOT EXISTS idx_trades_worker_id
    ON trades (worker_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id
    ON trades (user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_at
    ON trades (entry_at);

-- kitchen_sessions
CREATE INDEX IF NOT EXISTS idx_kitchen_sessions_user_id
    ON kitchen_sessions (user_id);

-- local_backup
CREATE INDEX IF NOT EXISTS idx_local_backup_synced
    ON local_backup (synced);

-- halal_coins
CREATE INDEX IF NOT EXISTS idx_halal_coins_symbol
    ON halal_coins (symbol);
CREATE INDEX IF NOT EXISTS idx_halal_coins_active
    ON halal_coins (active);

-- ============================================================
-- WORKER NUMBER SEQUENCE FUNCTION
-- Returns MAX(number)+1 per category, never reuses deleted numbers
-- Uses advisory lock to prevent race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION next_worker_number(
    p_user_id     UUID,
    p_owner       TEXT,
    p_market_type TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_next INTEGER;
    v_lock_key BIGINT;
BEGIN
    -- Create a deterministic advisory lock key from the category
    v_lock_key := hashtext(p_user_id::TEXT || p_owner || p_market_type);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(MAX(number), 0) + 1
    INTO v_next
    FROM workers
    WHERE user_id = p_user_id
      AND owner = p_owner
      AND market_type = p_market_type;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql;
