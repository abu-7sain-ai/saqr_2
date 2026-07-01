"""
Saqr (الصقر) — Pydantic Models
Phase 1: Database Foundation

Mirrors the Supabase database schema exactly.
Used for validation in both input (Create) and output (full model) shapes.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# -----------------------------------------------------------------------
# Shared / Enums
# -----------------------------------------------------------------------

WorkerType       = Literal["paper", "live"]
MarketType       = Literal["stable", "volatile"]
OwnerType        = Literal["prince", "king", "sniper"]
WorkerStatus     = Literal["running", "stopped", "paused"]
WorkerColor      = Literal["green", "red", "gray"]
TradeColor       = Literal["green", "red", "gray"]
ExitType         = Literal["target", "stop_loss", "expired", "manual"]
UserRole         = Literal["admin", "owner", "viewer"]
UserStatus       = Literal["pending", "active", "rejected"]
ExchangeType     = Literal["binance", "alpaca", "both"]


# -----------------------------------------------------------------------
# plans
# -----------------------------------------------------------------------

class Plan(BaseModel):
    id:               str
    name:             str
    monthly_cost:     float
    token_margin_pct: float
    profit_share_pct: float
    min_recharge:     float
    alert_threshold:  float
    stop_threshold:   float
    features:         dict[str, Any] | None = None
    created_at:       datetime | None = None


# -----------------------------------------------------------------------
# profiles
# -----------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    name:   str | None = None
    mobile: str | None = None
    # Admin-only fields (enforced at service layer)
    role:    UserRole   | None = None
    package: str        | None = None
    status:  UserStatus | None = None
    balance: float      | None = None


class Profile(BaseModel):
    id:         str
    name:       str
    email:      str
    mobile:     str | None = None
    role:       UserRole
    package:    str | None = None  # Link to plan.id
    balance:    float = 0
    status:     UserStatus
    created_at: datetime
    settings:   dict[str, Any] | None = None


# -----------------------------------------------------------------------
# halal_coins
# -----------------------------------------------------------------------

class HalalCoinCreate(BaseModel):
    symbol:   str
    name:     str
    exchange: ExchangeType = "binance"
    active:   bool         = True
    notes:    str | None   = None


class HalalCoin(HalalCoinCreate):
    id:       str
    added_by: str | None = None
    added_at: datetime


# -----------------------------------------------------------------------
# workers
# -----------------------------------------------------------------------

class WorkerCreate(BaseModel):
    name:             str
    type:             WorkerType
    market_type:      MarketType
    owner:            OwnerType
    paired_with:      str | None   = None
    status:           WorkerStatus = "stopped"
    strategy_name:    str | None   = None
    strategy_details: dict[str, Any] | None = None
    user_settings:    dict[str, Any] | None = None
    starting_capital: float = Field(default=0, ge=0)
    tag:              str | None = None
    project_tag:      str | None = None
    kitchen_session_id: str | None = None


class WorkerUpdate(BaseModel):
    status:           WorkerStatus | None = None
    current_capital:  float        | None = None
    total_profit_loss: float       | None = None
    released_amount:  float        | None = None
    last_run_at:      datetime     | None = None
    color:            WorkerColor  | None = None
    tag:              str          | None = None


class Worker(WorkerCreate):
    id:                str
    user_id:           str
    number:            int
    current_capital:   float = 0
    total_profit_loss: float = 0
    released_amount:   float = 0
    color:             WorkerColor | None = None
    created_at:        datetime
    last_run_at:       datetime | None = None


# -----------------------------------------------------------------------
# kitchen_sessions
# -----------------------------------------------------------------------

class KitchenSessionCreate(BaseModel):
    symbol:          str                         # required — e.g. "BTC/USDT"
    timeframe:       str             = "4h"      # default 4h
    market_type:     MarketType | None  = None
    risk_level:      float | None       = None
    angle:           str | None         = None
    capital_target:  float | None       = None
    expert_opinions: list[dict[str, Any]] | None = None
    final_decision:  dict[str, Any] | None       = None
    workers_created: list[str] | None            = None
    tag:             str | None = None
    project_tag:     str | None = None
    # ✅ إعدادات الموظف القادمة من MeetingModal (capital, workerType, marketType, etc.)
    worker_settings: dict[str, Any] | None = None


class KitchenSession(KitchenSessionCreate):
    id:         str
    user_id:    str
    date:       datetime
    created_at: datetime


# -----------------------------------------------------------------------
# trades
# -----------------------------------------------------------------------

class TradeCreate(BaseModel):
    worker_id:         str
    worker_number:     int | None  = None
    pair:              str
    entry_price:       float | None = None
    exit_price:        float | None = None
    amount_planned:    float | None = None
    amount_actual:     float | None = None
    is_trimmed:        bool = False
    trim_reason:       str | None = None
    slippage:          float = 0.001
    commission:        float | None = None
    spread:            float | None = None
    result:            float | None = None
    result_percentage: float | None = None
    color_base:        TradeColor | None = None
    is_trimmed_flag:   bool = False
    entry_reason:      str | None = None
    exit_reason:       str | None = None
    exit_type:         ExitType | None = None
    manual_exit_reason: str | None = None
    ai_summary:        str | None = None
    duration_minutes:  int | None = None
    entry_at:          datetime | None = None
    exit_at:           datetime | None = None
    tag:               str | None = None
    project_tag:       str | None = None


class Trade(TradeCreate):
    id:      str
    user_id: str


# -----------------------------------------------------------------------
# local_backup
# -----------------------------------------------------------------------

class LocalBackupCreate(BaseModel):
    trade_data: dict[str, Any]


class LocalBackup(LocalBackupCreate):
    id:         str
    user_id:    str
    synced:     bool
    created_at: datetime
