"""
Saqr (الصقر) — FastAPI Entry Point
Phase 3: Production Core (Reload Triggered)
"""
import logging
import os
import asyncio
import uuid
try:
    import psutil
except ImportError:
    psutil = None
from datetime import datetime, timedelta, timezone
from typing import Optional, Literal, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

# Services
from backend.config import get_supabase_client, get_supabase_admin_client, OPENROUTER_API_KEY
from backend.services.market_watcher import MarketWatcher
from backend.services.worker_engine import WorkerEngine
from backend.services.factory import StrategyFactory
from backend.services.historical_data import historical_engine
from backend.services.data_connector import DataConnector
from backend.services.advisor_service import advisor
from backend.services.analytics_service import AnalyticsService
from backend.services.exchange_service import test_connection
from backend.services.notifier import Notifier
from backend.telegram_bot import run_bot
from backend.database import Database
from backend.models.schemas import KitchenSessionCreate
from backend.services.whitelist_groups import get_group_list, get_symbols_for_groups

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Saqr Trading Platform",
    description="منظومة تداول ذكية مبنية على مبدأ الحذر أولاً",
    version="0.2.0",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Models ---
class ConnectionTestRequest(BaseModel):
    exchange: str
    api_key: str
    api_secret: str
    passphrase: str | None = None
    is_paper: bool = True

class SyncMarketRequest(BaseModel):
    market_id: str

class AdvisorChatRequest(BaseModel):
    message: str
    history: list[dict] = []
    agent_id: str | None = None
    context_type: str | None = None
    context_id: str | None = None

class AdvisorChatResponse(BaseModel):
    reply: str
    agent_id: str
    agent_name: str
    tokens_used: int
    execution_time_ms: float

class AdvisorChatError(BaseModel):
    error_code: str
    message: str
    request_id: str

class SessionTriggerRequest(BaseModel):
    session_id: str

class CloneWorkerRequest(BaseModel):
    name: str
    settings: dict
    session_id: str | None = None
    expert_signal: dict | None = None

class CreateStandaloneWorkerRequest(BaseModel):
    name: str
    strategy_source: Literal["webhook", "ai_prompt", "nocode", "chart"] = "chart"
    type: Literal["paper", "live"] = "paper"
    market_type: Literal["stable", "volatile"] = "stable"
    owner: Literal["prince", "king", "sniper"] = "prince"
    starting_capital: float = 1000.0
    pair: Optional[str] = "BTC/USDT"
    pairs: Optional[List[str]] = None
    settings: Optional[dict] = None
    strategy_config: Optional[dict] = None
    buddy_id: Optional[str] = None

class ParsePromptRequest(BaseModel):
    prompt: str

class WebhookSignalRequest(BaseModel):
    action: str  # "buy", "sell", "close", "long", "short"
    symbol: Optional[str] = None
    price: Optional[float] = None
    secret_token: Optional[str] = None
    comment: Optional[str] = None

# --- Health Endpoints ---
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": "0.2.0"}

@app.get("/", tags=["Health"])
async def root_check():
    return {"status": "running", "message": "Saqr Backend API is active", "version": "0.2.0"}

@app.get("/health/db", tags=["Health"])
async def db_health_check():
    try:
        client = get_supabase_client()
        client.table("halal_coins").select("id").limit(1).execute()
        return {"status": "ok", "supabase": "connected"}
    except Exception as e:
        logger.error(f"DB health check failed: {e}")
        raise HTTPException(status_code=503, detail="Supabase unreachable")

@app.post("/api/v1/market/test-connection", tags=["Market"])
async def api_test_connection(req: ConnectionTestRequest):
    try:
        return await test_connection(req.exchange, req.key, req.secret, req.is_paper)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/historical/sync-market", tags=["Historical"])
async def api_sync_market(req: SyncMarketRequest):
    async def run_sync():
        supabase = get_supabase_admin_client()
        wl = supabase.table('whitelist').select('symbol').eq('market_id', req.market_id).eq('is_active', True).execute().data
        ld = supabase.table('market_leaders').select('symbol').eq('market_id', req.market_id).eq('is_active', True).execute().data
        symbols = list(set([s['symbol'] for s in wl] + [s['symbol'] for s in ld]))
        logger.info(f"📊 Global Sync Started for Market {req.market_id}: {len(symbols)} symbols")
        await historical_engine.update_fear_greed_to_latest()
        for symbol in symbols:
            try:
                await historical_engine.seed_all(symbol, "4h", years=8)
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Sync failed for {symbol}: {e}")
        logger.info(f"✅ Global Sync Finished for Market {req.market_id}")

    asyncio.create_task(run_sync())
    return {"status": "started", "message": "Global sync running in background"}

@app.get("/api/v1/historical/status", tags=["Historical"])
async def get_historical_status():
    status = await historical_engine.get_sync_status()
    return {"data": status}

@app.get("/api/v1/historical/coverage", tags=["Historical"])
async def get_historical_coverage(symbol: str, timeframe: str = "4h", years: int = 10):
    result = await DataConnector.check_ohlc_coverage(symbol=symbol, timeframe=timeframe, years=years)
    return {"data": result}

@app.post("/api/kitchen/run", tags=["Kitchen"])
async def trigger_factory(req: SessionTriggerRequest):
    global active_background_tasks
    factory = StrategyFactory()
    if req.session_id in active_background_tasks and not active_background_tasks[req.session_id].done():
        return {"status": "already_running"}
    session = factory.db.get_session(req.session_id)
    if session and (session.get('status') in ['completed', 'failed']):
        return {"status": "finished", "session_id": req.session_id}
    factory.db.update_session_status(req.session_id, "running_session")
    task = asyncio.create_task(run_and_track_session(factory, req.session_id))
    active_background_tasks[req.session_id] = task
    return {"status": "triggered"}

@app.post("/api/v1/kitchen/clone-worker", tags=["Kitchen"])
async def api_clone_worker(req: CloneWorkerRequest):
    try:
        db = Database()
        supabase_admin = get_supabase_admin_client()

        # ✅ FIX: كنا بنستخدم db.clone_worker() اللي مش موجودة
        # الحل: نبني الـ worker data هنا ونستخدم clone_worker_direct
        user_id = os.environ.get("SUPER_OWNER_ID")
        if not user_id:
            settings = db.get_telegram_settings()
            user_id = settings['user_id'] if settings else None
        if not user_id:
            raise HTTPException(status_code=403, detail="User not identified")

        worker_data = {
            "user_id":          user_id,
            "session_id":       req.session_id,
            "name":             req.name,
            "status":           "running",
            "owner":            "prince",
            "market_type":      req.settings.get('marketType', 'stable'),
            "symbol":           req.settings.get('symbol', 'BTC/USDT'),
            # ✅ FIX: type يجب أن يكون "paper" أو "live" فقط (check constraint في DB)
            # الـ frontend بيبعت Paper/Live كـ toggle — نحوله للـ lowercase
            "type":             req.settings.get('type', 'paper').lower()
                                if req.settings.get('type', '').lower() in ('paper', 'live')
                                else 'paper',
            "user_settings":    {**req.settings, "expert_signal": req.expert_signal},
            "starting_capital": float(req.settings.get('capital', 1000)),
            "current_capital":  float(req.settings.get('capital', 1000)),
        }
        worker = db.clone_worker_direct(worker_data)
        if not worker:
            raise HTTPException(status_code=500, detail="فشل حفظ الموظف في قاعدة البيانات")
        return worker
    except Exception as e:
        logger.error(f"api_clone_worker failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/kitchen/advisor-report", tags=["Kitchen"])
async def get_advisor_report():
    return await advisor.get_executive_report()

@app.post("/api/advisor/chat", tags=["Advisor"])
async def advisor_chat(req: AdvisorChatRequest):
    from backend.utils.advisor_context import get_system_snapshot
    from backend.services.advisor_service import AdvisorProviderError, AdvisorTimeoutError

    request_id = str(uuid.uuid4())[:8]
    user_id = os.environ.get("SUPER_OWNER_ID")
    if not user_id or user_id == "default_user":
        try:
            client = get_supabase_client()
            resp = client.table("profiles").select("id").limit(1).execute()
            user_id = resp.data[0]['id'] if resp.data else None
        except:
            user_id = None

    try:
        snapshot = await get_system_snapshot(user_id=user_id)
    except Exception as e:
        logger.error(f"[{request_id}] Snapshot error: {e}")
        raise HTTPException(status_code=500, detail=AdvisorChatError(
            error_code="internal_error", message="فشل في تجميع سياق النظام", request_id=request_id,
        ).model_dump())

    try:
        reply, usage = await advisor.generate_advice(req.message, snapshot, user_id=user_id)
        return {"reply": reply, "usage": usage}
    except AdvisorTimeoutError:
        raise HTTPException(status_code=504, detail=AdvisorChatError(
            error_code="provider_timeout", message="انتهت مهلة الاستجابة من مزود الذكاء الاصطناعي", request_id=request_id,
        ).model_dump())
    except AdvisorProviderError as e:
        error_code = str(e)
        status_map = {
            "provider_auth": ("مفتاح المزود غير صالح أو مفقود", 503),
            "provider_error": ("فشل في الحصول على رد من المستشار", 502),
            "all_providers_failed": ("فشل المزود الرئيسي والبديل في الاستجابة", 502),
        }
        msg, status = status_map.get(error_code, ("خطأ داخلي في المستشار", 500))
        raise HTTPException(status_code=status, detail=AdvisorChatError(
            error_code=error_code, message=msg, request_id=request_id,
        ).model_dump())
    except Exception as e:
        logger.error(f"[{request_id}] Unexpected advisor error: {e}")
        raise HTTPException(status_code=500, detail=AdvisorChatError(
            error_code="internal_error", message="خطأ غير متوقع في معالجة الطلب", request_id=request_id,
        ).model_dump())

@app.get("/api/v1/advisor/balance", tags=["Advisor"])
async def get_advisor_balance():
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/auth/key",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"}
            )
            if resp.status_code == 200:
                data = resp.json()
                limit = data.get("data", {}).get("limit")
                usage = data.get("data", {}).get("usage", 0)
                total_credits = (limit - usage) if limit is not None else 0
                return {"total_credits": max(0, total_credits)}
            return {"total_credits": 0}
    except Exception as e:
        logger.error(f"Failed to fetch Advisor balance: {e}")
        return {"total_credits": 0}

_workers_cache = {"data": None, "ts": 0}

@app.get("/api/v1/workers", tags=["Workers"])
async def get_all_workers():
    """Fetch all workers with in-memory cache for fast repeated loads."""
    import time as _time
    now = _time.time()
    # Cache for 5 seconds to avoid hammering Supabase on page refreshes
    if _workers_cache["data"] is not None and (now - _workers_cache["ts"]) < 5:
        return _workers_cache["data"]
    try:
        supabase = get_supabase_admin_client()
        res = await asyncio.to_thread(
            lambda: supabase.table('workers')
                .select('id,number,name,type,status,owner,market_type,pair,strategy_name,user_settings,starting_capital,current_capital,created_at,paired_with,kitchen_session_id,pending_withdrawal_amount')
                .order('created_at', desc=True)
                .execute()
        )
        result = res.data or []
        _workers_cache["data"] = result
        _workers_cache["ts"] = now
        return result
    except Exception as e:
        logger.error(f"Failed to fetch workers: {e}")
        return _workers_cache["data"] or []


@app.patch("/api/v1/workers/{worker_id}/status", tags=["Workers"])
async def update_worker_status(worker_id: str, payload: dict):
    try:
        status = payload.get('status')
        if not status:
            raise HTTPException(status_code=400, detail="Missing status")
        supabase = get_supabase_admin_client()
        res = supabase.table('workers').update({"status": status}).eq('id', worker_id).execute()
        return {"success": True, "data": res.data}
    except Exception as e:
        logger.error(f"Failed to update worker status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/v1/workers/{worker_id}/promote", tags=["Workers"])
async def promote_worker(worker_id: str):
    """تحويل الموظف من حساب وهمي إلى حساب حقيقي يتداول بأموال حقيقية"""
    try:
        supabase = get_supabase_admin_client()

        # 1. Fetch current worker details
        res_current = supabase.table('workers').select('*').eq('id', worker_id).execute()
        if not res_current.data:
            raise HTTPException(status_code=404, detail="الموظف غير موجود")

        worker_data = res_current.data[0]
        current_settings = worker_data.get('user_settings') or {}
        current_settings['workerType'] = 'live'

        update_payload = {
            "type": "live",
            "user_settings": current_settings
        }

        # التأكد من ربط الموظف بالسوق الحقيقي إذا لم يكن مربوطاً
        if not worker_data.get('market_id'):
            m_res = supabase.table('markets').select('id').execute()
            if m_res.data:
                update_payload['market_id'] = m_res.data[0]['id']

        res = supabase.table('workers').update(update_payload).eq('id', worker_id).execute()

        # 2. Update in-memory WorkerEngine executor if running
        from backend.services.worker_engine import WorkerEngine
        worker_id_str = str(worker_id)
        if worker_id_str in WorkerEngine._executor_pool:
            executor = WorkerEngine._executor_pool[worker_id_str]
            executor.worker['type'] = 'live'
            executor.worker['user_settings'] = current_settings
            if update_payload.get('market_id'):
                executor.worker['market_id'] = update_payload['market_id']
                executor.market_id = update_payload['market_id']
            executor.is_paper = False
            await executor._initialize_market()
            logger.info(f"🚀 In-memory executor promoted to LIVE for worker {worker_data.get('name')}")

        # 3. Invalidate workers cache so UI reloads fast
        global _workers_cache
        _workers_cache["data"] = None
        _workers_cache["ts"] = 0

        return {"success": True, "message": "تم ترقية الموظف لحساب حقيقي بنجاح", "data": res.data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to promote worker: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/workers/stopped", tags=["Workers"])
async def delete_all_stopped_workers():
    try:
        supabase = get_supabase_admin_client()
        res = supabase.table('workers').delete().eq('status', 'stopped').execute()
        return {"success": True, "data": res.data}
    except Exception as e:
        logger.error(f"Failed to delete stopped workers: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/workers/{worker_id}", tags=["Workers"])
async def delete_single_worker(worker_id: str):
    try:
        supabase = get_supabase_admin_client()
        res = supabase.table('workers').delete().eq('id', worker_id).execute()
        return {"success": True, "data": res.data}
    except Exception as e:
        logger.error(f"Failed to delete worker {worker_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/workers/balance", tags=["Workers"])
async def get_workers_balance():
    from backend.services.exchange_service import get_total_cash
    try:
        db = Database()
        settings = db.get_telegram_settings()
        if not settings:
            return {"available_cash": 0, "message": "No settings found"}
        user_id = settings['user_id']
        # ✅ FIX: market_id=1 كان hardcoded وبيكسر الـ UUID query
        # بنبعت None عشان يجيب أي API key للـ user بدون filter على market_id
        api = db.get_market_api(user_id, None)
        if not api:
            return {"available_cash": 0, "message": "No API keys found"}
        balance = await get_total_cash('alpaca', api['api_key'], api['api_secret'], is_paper=True)
        return {"available_cash": balance}
    except Exception as e:
        logger.error(f"Failed to fetch worker balance: {e}")
        return {"available_cash": 0, "error": str(e)}

@app.post("/api/v1/workers/clone", tags=["Workers"])
async def clone_worker(req: CloneWorkerRequest):
    """Clone a strategy into a new worker — called from workerService.cloneWorker()"""
    try:
        db = Database()
        settings = db.get_telegram_settings()
        user_id = settings['user_id'] if settings else None
        if not user_id:
            raise HTTPException(status_code=403, detail="User not identified")

        # اسم الموظف من الـ strategy name اللي جاي من الاجتماع
        worker_name = req.name or f"موظف {req.expert_signal.get('name', 'جديد')}"

        # ✅ الـ fields الصح بالظبط زي ما هي في DB schema
        worker_data = {
            "user_id":          user_id,
            "name":             worker_name,
            # type: يجب أن يكون "paper" أو "live" فقط (check constraint)
            "type":             req.settings.get('workerType', 'paper').lower()
                                if req.settings.get('workerType', '').lower() in ('paper', 'live')
                                else 'paper',
            "status":           "running",
            "owner":            "prince",
            "market_type":      req.settings.get('marketType', 'stable'),
            # symbol → pair في DB
            "pair": req.settings.get('symbol', (req.expert_signal or {}).get('symbol', 'BTC/USDT')),
            # session_id → kitchen_session_id في DB
            "kitchen_session_id": req.session_id,
            "user_settings":    {**req.settings, "expert_signal": req.expert_signal},
            "starting_capital": float(req.settings.get('portfolioValue', req.settings.get('capital', 1000))),
            "current_capital":  float(req.settings.get('portfolioValue', req.settings.get('capital', 1000))),
            "paired_with":      req.settings.get('buddyId') or None,
        }

        new_worker = db.clone_worker_direct(worker_data)
        if not new_worker:
            raise HTTPException(status_code=500, detail="فشل حفظ الموظف في قاعدة البيانات")

        return {"worker_id": new_worker['id'], "name": worker_name, "status": "running"}
    except Exception as e:
        logger.error(f"Worker cloning failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/workers/create", tags=["Workers"])
async def create_standalone_worker(req: CreateStandaloneWorkerRequest, request: Request):
    """Create a standalone worker using Webhook, AI Prompt, or No-Code Strategy"""
    try:
        user_id = os.environ.get("SUPER_OWNER_ID")
        if not user_id:
            global _cached_owner_user_id
            if '_cached_owner_user_id' in globals() and _cached_owner_user_id:
                user_id = _cached_owner_user_id
            else:
                try:
                    db = Database()
                    settings = db.get_telegram_settings()
                    user_id = settings['user_id'] if settings else None
                    if user_id:
                        _cached_owner_user_id = user_id
                except Exception:
                    user_id = None

        if not user_id:
            user_id = "00000000-0000-0000-0000-000000000001"

        db = Database()

        # Determine target symbols list and display pair
        symbols_list = []
        if req.pairs and isinstance(req.pairs, list):
            symbols_list = [p.strip() for p in req.pairs if p and p.strip()]
        elif req.pair:
            symbols_list = [p.strip() for p in req.pair.split(',') if p and p.strip()]
        
        if not symbols_list:
            symbols_list = ["BTC/USDT"]

        display_pair = symbols_list[0] if len(symbols_list) == 1 else ", ".join(symbols_list)

        merged_settings = dict(req.settings or {})
        merged_settings['strategy_source'] = req.strategy_source
        merged_settings['workerType'] = req.type
        merged_settings['marketType'] = req.market_type
        merged_settings['symbol'] = symbols_list[0] if len(symbols_list) == 1 else "MULTI"
        merged_settings['symbols'] = symbols_list
        merged_settings['target_symbols'] = symbols_list
        merged_settings['portfolioValue'] = req.starting_capital

        strat_config = req.strategy_config or {}
        secret_token = None

        if req.strategy_source == "webhook":
            import secrets
            secret_token = strat_config.get('secret_token') or secrets.token_hex(16)
            merged_settings['secret_token'] = secret_token
            strategy_name = "TradingView Webhook"

        elif req.strategy_source == "ai_prompt":
            prompt_text = strat_config.get('prompt', '')
            merged_settings['ai_prompt'] = prompt_text
            from backend.strategies.ai_prompt_strategy import AIPromptStrategy
            parsed_rules = await AIPromptStrategy.parse_prompt_async(prompt_text)
            merged_settings['parsed_rules'] = parsed_rules
            coin_tag = f"({len(symbols_list)} عملات)" if len(symbols_list) > 1 else f"({symbols_list[0]})"
            strategy_name = f"AI {coin_tag}: {prompt_text[:25]}..." if len(prompt_text) > 25 else f"AI {coin_tag}: {prompt_text}"

        elif req.strategy_source == "nocode":
            nocode_rules = strat_config.get('rules', {})
            merged_settings['nocode_rules'] = nocode_rules
            coin_tag = f"({len(symbols_list)} عملات)" if len(symbols_list) > 1 else f"({symbols_list[0]})"
            strategy_name = f"No-Code Builder {coin_tag}"

        elif req.strategy_source == "chart":
            chart_mode = strat_config.get('chart_mode', 'dip_rebound')
            merged_settings['chart_mode'] = chart_mode
            merged_settings['timeframe'] = strat_config.get('timeframe', '60')
            if chart_mode == 'dip_rebound':
                merged_settings['nocode_rules'] = {
                    "entry_rules": {"rsi_condition": "below", "rsi_value": 35, "macd_condition": "cross_up"},
                    "exit_rules": {"rsi_condition": "above", "rsi_value": 70, "tp_pct": merged_settings.get('tpValue', 3.0), "sl_pct": merged_settings.get('slValue', 1.5)}
                }
                strategy_name = f"شارت مباشر: {display_pair} (ارتداد القاع)"
            elif chart_mode == 'breakout':
                merged_settings['nocode_rules'] = {
                    "entry_rules": {"ema_condition": "above", "ema_period": 50, "macd_condition": "above_signal"},
                    "exit_rules": {"macd_condition": "cross_down", "tp_pct": merged_settings.get('tpValue', 4.0), "sl_pct": merged_settings.get('slValue', 2.0)}
                }
                strategy_name = f"شارت مباشر: {display_pair} (اختراق وترند)"
            else:
                merged_settings['nocode_rules'] = {
                    "entry_rules": {"rsi_condition": "below", "rsi_value": 40, "bb_condition": "touch_lower"},
                    "exit_rules": {"bb_condition": "touch_upper", "tp_pct": merged_settings.get('tpValue', 1.5), "sl_pct": merged_settings.get('slValue', 0.8)}
                }
                strategy_name = f"شارت مباشر: {display_pair} (اسكالبينج سريع)"

        else:
            strategy_name = "مخصص"

        # الربط بالسوق النشط في النظام (مثل باينانس) لتمكين التداول الحقيقي المباشر
        active_market_id = None
        try:
            supabase = get_supabase_admin_client()
            m_res = supabase.table('markets').select('id').execute()
            if m_res.data:
                active_market_id = m_res.data[0]['id']
        except Exception as me:
            logger.warning(f"Could not link active market to worker: {me}")

        worker_data = {
            "user_id":          user_id,
            "name":             req.name,
            "type":             req.type.lower() if req.type.lower() in ('paper', 'live') else 'paper',
            "status":           "running",
            "owner":            req.owner.lower() if req.owner.lower() in ('prince', 'king', 'sniper') else 'prince',
            "market_type":      req.market_type.lower() if req.market_type.lower() in ('stable', 'volatile') else 'stable',
            "pair":             display_pair,
            "strategy_name":    strategy_name,
            "user_settings":    merged_settings,
            "starting_capital": float(req.starting_capital),
            "current_capital":  float(req.starting_capital),
            "paired_with":      req.buddy_id or None,
            "market_id":        active_market_id,
        }

        new_worker = None
        try:
            new_worker = await asyncio.to_thread(db.clone_worker_direct, worker_data)
        except Exception as dbe:
            logger.warning(f"DB persistence error (falling back to memory): {dbe}")

        if not new_worker:
            worker_id = str(uuid.uuid4())
            new_worker = {
                **worker_data,
                "id": worker_id,
                "number": 1,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        else:
            worker_id = new_worker['id']
        base_url = str(request.base_url).rstrip('/')
        webhook_url = f"{base_url}/api/v1/workers/{worker_id}/webhook"

        return {
            "status": "success",
            "worker": new_worker,
            "webhook_url": webhook_url if req.strategy_source == "webhook" else None,
            "secret_token": secret_token
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"create_standalone_worker failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/workers/parse-prompt", tags=["Workers"])
async def api_parse_prompt(req: ParsePromptRequest):
    """تحليل وصف الاستراتيجية النصي واستخراج القواعد الفنية عبر الذكاء الاصطناعي"""
    try:
        from backend.strategies.ai_prompt_strategy import AIPromptStrategy
        rules = await AIPromptStrategy.parse_prompt_async(req.prompt)
        return {"status": "success", "rules": rules}
    except Exception as e:
        logger.error(f"api_parse_prompt failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/workers/{worker_id}/webhook", tags=["Workers"])
async def receive_webhook_signal(worker_id: str, req: WebhookSignalRequest):
    """استقبال إشارات TradingView أو إشارات خارجية فورية"""
    try:
        worker = None
        try:
            supabase = get_supabase_admin_client()
            w_resp = supabase.table('workers').select('*').eq('id', worker_id).execute()
            if w_resp.data:
                worker = w_resp.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch worker from DB: {e}")
        
        if not worker:
            # افتراضي للموظف إذا تعذر الاتصال بـ Supabase
            worker = {
                'id': worker_id,
                'name': 'موظف Webhook',
                'user_settings': {'strategy_source': 'webhook', 'workerType': 'paper'},
                'type': 'paper',
                'market_type': 'stable',
                'user_id': '00000000-0000-0000-0000-000000000001',
                'current_capital': 1000.0,
                'starting_capital': 1000.0
            }
        
        user_settings = worker.get('user_settings', {})
        
        # تحقق من secret_token لو محدد ومفعل
        configured_token = user_settings.get('secret_token')
        if configured_token and req.secret_token and configured_token != req.secret_token:
            raise HTTPException(status_code=401, detail="Invalid webhook secret token")

        executor = await WorkerEngine.get_or_create_executor(worker_id)
        if not executor:
            # Fallback executor directly initialized
            from backend.services.worker_executor import WorkerExecutor
            executor = WorkerExecutor(worker)
            WorkerEngine._executor_pool[str(worker_id)] = executor

        payload = req.model_dump()
        result = await executor.handle_webhook_signal(payload)
        
        try:
            db = Database()
            db.log_activity(
                worker['user_id'],
                "webhook_signal_received",
                f"إشارة Webhook للموظف {worker['name']}: {req.action} {req.symbol or ''}",
                {"result": result, "payload": payload}
            )
        except Exception as le:
            logger.warning(f"Could not log webhook activity: {le}")
        
        return {"status": "success", "execution": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling webhook signal for {worker_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/workers/{worker_id}/webhook-url", tags=["Workers"])
async def get_worker_webhook_url(worker_id: str, request: Request):
    """جلب رابط Webhook للموظف مع نموذج إعداد تنبيه TradingView"""
    try:
        worker = None
        try:
            supabase = get_supabase_admin_client()
            w_resp = supabase.table('workers').select('*').eq('id', worker_id).execute()
            if w_resp.data:
                worker = w_resp.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch worker from DB: {e}")

        if not worker:
            worker = {'id': worker_id, 'name': 'موظف Webhook', 'user_settings': {}}
        
        user_settings = worker.get('user_settings', {})
        secret_token = user_settings.get('secret_token', '')

        base_url = str(request.base_url).rstrip('/')
        webhook_url = f"{base_url}/api/v1/workers/{worker_id}/webhook"

        sample_alert_json = {
            "action": "buy",
            "symbol": "{{ticker}}",
            "price": 12345.67,
            "comment": "TradingView Alert: {{strategy.order.comment}}"
        }
        if secret_token:
            sample_alert_json["secret_token"] = secret_token

        return {
            "worker_id": worker_id,
            "worker_name": worker['name'],
            "webhook_url": webhook_url,
            "secret_token": secret_token,
            "sample_payload": sample_alert_json,
            "tradingview_instructions": "انسخ رابط الـ Webhook وضعه في خانة Webhook URL في تنبيه TradingView. وفي خانة الرسالة (Message) ضع صيغة الـ JSON أعلاه."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_worker_webhook_url failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/workers/{worker_id}/trades", tags=["Workers"])
async def get_worker_trades(worker_id: str):
    """Fetch detailed trade history & calculated performance statistics for a specific worker."""
    try:
        supabase = get_supabase_admin_client()
        w_resp = supabase.table('workers').select('*').eq('id', worker_id).execute()
        if not w_resp.data:
            raise HTTPException(status_code=404, detail="Worker not found")
        worker = w_resp.data[0]

        trades_resp = supabase.table('trades').select('*').eq('worker_id', worker_id).order('entry_at', desc=True).execute()
        trades = trades_resp.data or []

        total_trades = len(trades)
        closed_trades = [t for t in trades if t.get('exit_at')]
        winning_trades = [t for t in closed_trades if float(t.get('result', 0) or 0) > 0]
        losing_trades = [t for t in closed_trades if float(t.get('result', 0) or 0) < 0]
        
        total_pnl = sum(float(t.get('result', 0) or 0) for t in closed_trades)
        win_rate = (len(winning_trades) / len(closed_trades) * 100) if closed_trades else 0.0
        
        traded_symbols = list(set([t.get('pair') for t in trades if t.get('pair')]))

        return {
            "worker_id": worker_id,
            "worker_name": worker.get('name'),
            "strategy_name": worker.get('strategy_name') or (worker.get('user_settings') or {}).get('expert_signal', {}).get('name', 'تلقائي'),
            "starting_capital": float(worker.get('starting_capital', 0) or 0),
            "current_capital": float(worker.get('current_capital', 0) or 0),
            "summary": {
                "total_trades": total_trades,
                "closed_trades": len(closed_trades),
                "open_trades": total_trades - len(closed_trades),
                "winning_trades": len(winning_trades),
                "losing_trades": len(losing_trades),
                "win_rate": round(win_rate, 2),
                "net_pnl": round(total_pnl, 2),
                "traded_symbols": traded_symbols
            },
            "trades": trades
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching worker trades for {worker_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/whitelist/groups", tags=["Whitelist"])
async def get_whitelist_groups():
    """إرجاع تعريف مجموعات القائمة البيضاء للاختيار في واجهة إنشاء الاجتماع."""
    try:
        return {"groups": get_group_list()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/kitchen/sessions", tags=["Kitchen"])
async def get_kitchen_sessions(market_type: str = None):
    try:
        supabase = get_supabase_client()
        query = supabase.table('kitchen_sessions').select('*').order('created_at', desc=True)
        if market_type:
            query = query.eq('market_type', market_type)
        res = query.execute()
        return res.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/kitchen/sessions", tags=["Kitchen"])
async def create_kitchen_session(req: KitchenSessionCreate):
    try:
        supabase = get_supabase_admin_client()
        # ✅ FIX: لو symbol = 'ALL' يعني دراسة السوق العام — لا نفحص عملة محددة
        if req.symbol and req.symbol.upper() != 'ALL':
            valid = supabase.table('whitelist').select('symbol, is_active').eq('symbol', req.symbol).execute().data
            logger.info(f"🔍 Whitelist check for '{req.symbol}': {valid}")
            if not valid:
                raise HTTPException(status_code=400, detail=f"العملة '{req.symbol}' غير موجودة في القائمة المعتمدة")
        else:
            logger.info("🌐 General Market Study (ALL whitelist) — skipping individual symbol check")
        # ✅ FIX: استخرج market_id من worker_settings عشان factory._spawn_worker تلاقيها
        ws = req.worker_settings or {}
        market_id_from_ws = ws.get('marketId') or ws.get('market_id')

        new_session = {
            "symbol": req.symbol,
            "timeframe": req.timeframe,
            "status": "pending",
            "market_type": req.market_type or "stable",
            # ✅ FIX: حفظ market_id كـ field مستقل عشان factory.run_session تقدر تجيبه بـ session.get('market_id')
            "market_id": market_id_from_ws,
            "worker_settings": ws
        }
        res = supabase.table('kitchen_sessions').insert(new_session).execute()
        logger.info(f"📝 Insert result: data={res.data}")
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create session")
        session_id = res.data[0]['id']
        if session_id not in active_background_tasks or active_background_tasks[session_id].done():
            task = asyncio.create_task(run_and_track_session(StrategyFactory(), session_id))
            active_background_tasks[session_id] = task
        return {"session_id": session_id, "status": "pending"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/kitchen/sessions/{session_id}", tags=["Kitchen"])
async def get_kitchen_session_detail(session_id: str):
    try:
        supabase = get_supabase_client()
        session = supabase.table('kitchen_sessions').select('*').eq('id', session_id).single().execute().data
        if not session:
            raise HTTPException(status_code=404, detail="الجلسة غير موجودة")
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/kitchen/sessions/{session_id}", tags=["Kitchen"])
async def delete_kitchen_session(session_id: str):
    try:
        # 1. إلغاء المهمة في الخلفية فوراً
        task = active_background_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()
            logger.info(f"🛑 Cancelled active background task for session {session_id}")

        supabase = get_supabase_admin_client()

        # 2. حذف الجلسة وتفكيك ارتباط الموظفين بسرعة في الخلفية
        def _do_delete():
            try:
                supabase.table('workers').update({"kitchen_session_id": None, "session_id": None}).eq('kitchen_session_id', session_id).execute()
            except Exception:
                pass
            try:
                supabase.table('kitchen_sessions').delete().eq('id', session_id).execute()
            except Exception as e:
                logger.warning(f"Background delete failed: {e}")

        asyncio.create_task(asyncio.to_thread(_do_delete))
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"delete_kitchen_session error: {e}")
        return {"status": "deleted", "note": str(e)}

@app.post("/api/v1/kitchen/sessions/{session_id}/stop", tags=["Kitchen"])
async def stop_kitchen_session(session_id: str):
    try:
        task = active_background_tasks.pop(session_id, None)
        if task and not task.done():
            task.cancel()
            logger.info(f"🛑 Stopped task for session {session_id}")
        supabase = get_supabase_admin_client()
        await asyncio.to_thread(
            lambda: supabase.table('kitchen_sessions').update({
                "status": "failed",
                "expert_opinions": {"error": "تم إيقاف الجلسة بناءً على طلب المستخدم"}
            }).eq('id', session_id).execute()
        )
        return {"status": "stopped"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analytics/performance", tags=["Analytics"])
async def get_performance_analytics(user_id: str):
    db = Database()
    return {
        "summary": AnalyticsService.get_performance_summary(user_id),
        "monthly_matrix": AnalyticsService.get_monthly_matrix(user_id),
        "system_health": AnalyticsService.get_system_health(),
        "token_usage": AnalyticsService.get_token_dashboard(user_id),
        "workers_detailed": db.get_workers_by_user(user_id),
        "recent_trades": db.get_recent_trades_summary(user_id)
    }

# --- Background Tasks ---
async def scheduled_health_check():
    try:
        if psutil is None:
            return
        cpu = psutil.cpu_percent()
        ram = psutil.virtual_memory().percent
        if cpu > 80: await Notifier.send_telegram(f"⚠️ CPU High: {cpu}%")
    except Exception as e: logger.error(f"Health check error: {e}")

async def scheduled_market_check():
    try:
        from backend.services.market_watcher import MarketWatcher
        watcher = MarketWatcher()
        await watcher.check_and_process()
    except Exception as e:
        logger.error(f"Market check error: {e}")

async def scheduled_worker_run():
    try: await WorkerEngine.run_all_workers()
    except Exception as e: logger.error(f"Worker engine error: {e}")

active_background_tasks = {}

async def scheduled_kitchen_check():
    global active_background_tasks
    try:
        supabase = get_supabase_admin_client()
        db = Database()

        # ========================================================
        # 1. NEW PENDING — أقدم من دقيقتين ومش شغالة
        # ========================================================
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
        pending = supabase.table('kitchen_sessions').select('id,created_at,status')\
            .eq('status', 'pending').lt('created_at', cutoff).execute().data

        for s in (pending or []):
            sid = s['id']
            if sid in active_background_tasks and not active_background_tasks[sid].done():
                continue
            logger.info(f"🕵️ KitchenWatcher: Starting pending session {sid}")
            # ✅ FIX: نتأكد إن الـ update نجح قبل ما نشغل الـ task
            update_resp = supabase.table('kitchen_sessions')\
                .update({"status": "running_session"})\
                .eq('id', sid).eq('status', 'pending').execute()
            if not update_resp.data:
                # شخص تاني خد الـ session قبلنا
                continue
            task = asyncio.create_task(run_and_track_session(StrategyFactory(), sid))
            active_background_tasks[sid] = task

        # ========================================================
        # 2. RESCUE STUCK — مش اتحدثت من 10 دقايق ومش في active set
        # ========================================================
        limit = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        stuck = supabase.table('kitchen_sessions').select('id, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .neq('status', 'pending')\
            .lt('updated_at', limit).execute().data

        for s in (stuck or []):
            sid = s['id']
            if sid in active_background_tasks and not active_background_tasks[sid].done():
                # لسه شغالة عندنا — مش محتاجين نعمل rescue
                continue
            # ✅ FIX: نجيب الـ session من DB ونتأكد إنها فعلاً مش completed/failed
            fresh = supabase.table('kitchen_sessions').select('id, status')\
                .eq('id', sid).limit(1).execute().data
            if not fresh:
                continue
            fresh_status = fresh[0].get('status', '')
            if fresh_status in ('completed', 'failed', 'pending'):
                continue
            logger.info(f"🕵️ KitchenWatcher: Rescuing stuck session {sid} (status: {fresh_status})")
            task = asyncio.create_task(run_and_track_session(StrategyFactory(), sid))
            active_background_tasks[sid] = task

        # ========================================================
        # 3. HEARTBEAT WATCHDOG — مفيش update من 25 دقيقة
        # ========================================================
        heartbeat_limit = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
        hanging = supabase.table('kitchen_sessions').select('id, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .lt('updated_at', heartbeat_limit).execute().data

        for s in (hanging or []):
            sid = s['id']
            if sid in active_background_tasks and not active_background_tasks[sid].done():
                continue
            logger.warning(f"🚨 KitchenWatcher: Session {sid} hanging (no heartbeat). Auto-failing.")
            task = active_background_tasks.pop(sid, None)
            if task and not task.done():
                task.cancel()
            reason = "توقف النظام عن الاستجابة (Heartbeat Timeout)"
            db.update_session_data(sid, {"status": "failed", "expert_opinions": {"error": reason}})
            await Notifier.send_telegram(f"🚨 [KITCHEN] تم إيقاف الجلسة {sid[:8]} بسبب عدم الاستجابة.")

        # ========================================================
        # 4. GLOBAL TIMEOUT — أقدم من 45 دقيقة
        # ========================================================
        global_limit = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
        too_long = supabase.table('kitchen_sessions').select('id, created_at, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .lt('created_at', global_limit).execute().data

        for s in (too_long or []):
            sid = s['id']
            logger.warning(f"🚨 KitchenWatcher: Session {sid} exceeded 45m global limit. Auto-failing.")
            task = active_background_tasks.pop(sid, None)
            if task and not task.done():
                task.cancel()
            db.update_session_data(sid, {
                "status": "failed",
                "expert_opinions": {"error": "تجاوزت الجلسة الحد الأقصى للمدة (45 دقيقة)"}
            })
            await Notifier.send_telegram(f"🚨 [KITCHEN] تم إيقاف الجلسة {sid[:8]} لتجاوزها 45 دقيقة.")

    except Exception as e:
        logger.error(f"Kitchen watcher error: {e}")


async def run_and_track_session(factory, session_id):
    """
    ✅ FIX: تحقق إن الـ session مش failed/completed قبل التشغيل.
    وبعد كل جولة بتتأكد إن الـ session لسه شغالة (لم يتم إيقافها من الخارج).
    """
    global active_background_tasks
    try:
        # ✅ FIX: تحقق من الـ status قبل بدء التشغيل
        db = factory.db
        session = db.get_session(session_id)
        if not session:
            logger.warning(f"run_and_track_session: Session {session_id} not found. Aborting.")
            return
        if session.get('status') in ('completed', 'failed'):
            logger.info(f"run_and_track_session: Session {session_id} already {session['status']}. Skipping.")
            return

        await factory.run_session(session_id)

    except asyncio.CancelledError:
        logger.info(f"🛑 Session {session_id} task was cancelled gracefully.")
        try:
            factory.db.update_session_data(session_id, {
                "status": "failed",
                "expert_opinions": {"error": "تم إيقاف الجلسة بناءً على طلب المستخدم"}
            })
        except Exception:
            pass
    except Exception as e:
        logger.error(f"[CRITICAL] Session {session_id} crashed: {e}", exc_info=True)
        try:
            factory.db.update_session_data(session_id, {
                "status": "failed",
                "expert_opinions": {"error": f"خطأ غير متوقع: {str(e)}"}
            })
        except Exception as db_err:
            logger.error(f"Failed to update session {session_id} after crash: {db_err}")
    finally:
        # ✅ FIX: دايماً بنشيل من active في النهاية
        active_background_tasks.pop(session_id, None)


async def scheduled_historical_update():
    try:
        supabase = get_supabase_admin_client()
        symbols = supabase.table('whitelist').select('symbol').eq('is_active', True).execute().data
        for s in (symbols or []):
            await historical_engine.update_to_latest(s['symbol'], "4h")
            await asyncio.sleep(1)
        await historical_engine.update_fear_greed_to_latest()
    except Exception as e:
        logger.error(f"Historical update error: {e}")


# ─── Admin: Create User ───────────────────────────────────────
class CreateUserRequest(BaseModel):
    email: str
    password: str
    username: str = ""

@app.post("/api/v1/admin/create-user", tags=["Admin"])
async def admin_create_user(req: CreateUserRequest):
    """Creates a new user via Supabase Auth Admin REST API using service role key."""
    import httpx as _httpx
    from backend.config import SUPABASE_URL, SUPABASE_SERVICE_KEY
    try:
        auth_url = f"{SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "email": req.email,
            "password": req.password,
            "email_confirm": True,
            "user_metadata": {"full_name": req.username}
        }
        async with _httpx.AsyncClient(timeout=15) as client:
            r = await client.post(auth_url, headers=headers, json=payload)
        
        if r.status_code >= 400:
            raise Exception(r.json().get("msg", r.text[:200]))
        
        user_data = r.json()
        user_id = user_data.get("id")
        
        # Update profile
        from backend.config import get_supabase_admin_client
        admin_sb = get_supabase_admin_client()
        import time; time.sleep(1)  # wait for trigger to create profile
        admin_sb.table('profiles').update({
            "name": req.username or req.email.split("@")[0],
            "status": "active"
        }).eq("id", user_id).execute()
        
        logger.info(f"Admin created new user: {req.email}")
        return {"success": True, "user_id": user_id, "email": req.email}
    except Exception as e:
        logger.error(f"Admin create user error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.on_event("startup")
async def startup_event():
    # ✅ FIX 2: مزامنة الـ in-memory market state من DB عند كل restart
    try:
        from backend.config import get_supabase_admin_client
        from backend.utils.market_state import set_market_status
        _supabase = get_supabase_admin_client()
        res = _supabase.table('market_state').select('current_type').eq('id', 1).execute()
        if res.data:
            loaded_type = res.data[0]['current_type']
            set_market_status(loaded_type)
            logger.info(f"✅ Market state loaded from DB on startup: {loaded_type}")
        else:
            logger.warning("⚠️ No market_state record found in DB. Defaulting to 'stable'.")
    except Exception as e:
        logger.error(f"❌ Failed to load market state on startup: {e}")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(scheduled_health_check, 'interval', minutes=5)
    scheduler.add_job(scheduled_market_check, 'interval', minutes=15)
    scheduler.add_job(scheduled_worker_run, 'interval', minutes=2)
    scheduler.add_job(scheduled_kitchen_check, 'interval', seconds=30)
    scheduler.add_job(scheduled_historical_update, 'interval', hours=6)
    scheduler.start()
    import threading
    threading.Thread(target=run_bot, daemon=True).start()
    logger.info("🚀 Saqr Backend Initialized.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)