-- Migration: Add execution_settings to workers table
-- Purpose: Support complex worker cloning options (compounding, custom limits)

ALTER TABLE public.workers
ADD COLUMN IF NOT EXISTS execution_settings JSONB DEFAULT '{}'::jsonb;

-- Example of expected JSON structure inside this new column:
/*
{
  "portfolio_share_type": "fixed",         // 'fixed', 'percentage', 'percentage_compounding'
  "portfolio_share_value": 500,            // e.g., $500 or 15%
  "trade_size_type": "fixed",              // 'fixed', 'percentage_of_allocation'
  "trade_size_value": 100,
  "max_open_trades": 0,                    // 0 = unlimited
  "take_profit_type": "recommended",       // 'recommended', 'custom'
  "take_profit_value": null,               // populated if custom
  "stop_loss_type": "trailing_recommended",// 'trailing_recommended', 'trailing_custom', 'fixed'
  "stop_loss_value": 0.005,                // e.g., 0.5%
  "expiration_type": "end_of_day",         // 'recommended', 'minutes', 'end_of_day'
  "expiration_minutes": null,
  "paired_buddy_id": "uuid-here"           // null if not paired
}
*/
