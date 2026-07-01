-- ============================================================
-- Migration: 016_fix_worker_numbering_persistence.sql
-- Purpose: Ensure worker numbers never repeat even if deleted.
--          Introduces worker_sequences table.
-- ============================================================

CREATE TABLE IF NOT EXISTS worker_sequences (
    user_id      UUID NOT NULL,
    owner        TEXT NOT NULL,
    market_type  TEXT NOT NULL,
    last_number  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, owner, market_type)
);

-- Seed existing sequences from current workers table to prevent overlaps
INSERT INTO worker_sequences (user_id, owner, market_type, last_number)
SELECT user_id, owner, market_type, MAX(number)
FROM workers
GROUP BY user_id, owner, market_type
ON CONFLICT (user_id, owner, market_type) DO UPDATE 
SET last_number = EXCLUDED.last_number;

-- Redefine next_worker_number to use the sequences table
CREATE OR REPLACE FUNCTION next_worker_number(
    p_user_id     UUID,
    p_owner       TEXT,
    p_market_type TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_next INTEGER;
BEGIN
    -- Atomic update and return
    INSERT INTO worker_sequences (user_id, owner, market_type, last_number)
    VALUES (p_user_id, p_owner, p_market_type, 1)
    ON CONFLICT (user_id, owner, market_type) 
    DO UPDATE SET last_number = worker_sequences.last_number + 1
    RETURNING last_number INTO v_next;

    RETURN v_next;
END;
$$ LANGUAGE plpgsql;
