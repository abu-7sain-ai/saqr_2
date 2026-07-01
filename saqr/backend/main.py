"""
Saqr (الصقر) — FastAPI Entry Point
Phase 3: Production Core
"""
import logging
import os
import asyncio
import uuid
import psutil
from datetime import datetime, timedelta, timezone
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Saqr Trading Platform",
    description="منظومة تداول ذكية مبنية على مبدأ الحذر أولاً",
    version="0.2.0",
)

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
    key: str
    secret: str
    is_paper: bool = False

class SyncMarketRequest(BaseModel):
    market_id: str

class AdvisorChatRequest(BaseModel):
    message: str = Field(..., min_length=1)

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

# --- Health Endpoints ---
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "version": "0.2.0"}

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
    if req.session_id in active_background_tasks:
        return {"status": "already_running"}
    session = factory.db.get_session(req.session_id)
    if session and (session.get('status') in ['completed', 'failed']):
        return {"status": "finished", "session_id": req.session_id}
    factory.db.update_session_status(req.session_id, "running_session")
    active_background_tasks.add(req.session_id)
    asyncio.create_task(run_and_track_session(factory, req.session_id))
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
        valid = supabase.table('whitelist').select('symbol, is_active').eq('symbol', req.symbol).execute().data
        logger.info(f"🔍 Whitelist check for '{req.symbol}': {valid}")
        if not valid:
            raise HTTPException(status_code=400, detail=f"العملة '{req.symbol}' غير موجودة في القائمة المعتمدة")
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
        if session_id not in active_background_tasks:
            active_background_tasks.add(session_id)
            asyncio.create_task(run_and_track_session(StrategyFactory(), session_id))
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
        # ✅ FIX: استخدم admin client عشان RLS مش يبلوك الحذف من الـ backend
        supabase = get_supabase_admin_client()
        active_background_tasks.discard(session_id)
        supabase.table('kitchen_sessions').delete().eq('id', session_id).execute()
        return {"status": "deleted"}
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
        cpu = psutil.cpu_percent()
        ram = psutil.virtual_memory().percent
        if cpu > 80: await Notifier.send_telegram(f"⚠️ CPU High: {cpu}%")
    except Exception as e: logger.error(f"Health check error: {e}")

async def scheduled_market_check():
    try: await AnalyticsService.update_market_state()
    except Exception as e: logger.error(f"Market check error: {e}")

async def scheduled_worker_run():
    try: await WorkerEngine.run_all_workers()
    except Exception as e: logger.error(f"Worker engine error: {e}")

active_background_tasks = set()

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
            if sid in active_background_tasks:
                continue
            logger.info(f"🕵️ KitchenWatcher: Starting pending session {sid}")
            # ✅ FIX: نتأكد إن الـ update نجح قبل ما نشغل الـ task
            update_resp = supabase.table('kitchen_sessions')\
                .update({"status": "running_session"})\
                .eq('id', sid).eq('status', 'pending').execute()
            if not update_resp.data:
                # شخص تاني خد الـ session قبلنا
                continue
            active_background_tasks.add(sid)
            asyncio.create_task(run_and_track_session(StrategyFactory(), sid))

        # ========================================================
        # 2. RESCUE STUCK — مش اتحدثت من 10 دقايق ومش في active set
        #    ✅ FIX: بنستخدم updated_at مش created_at
        #    السبب: لما الـ server بيعيد التشغيل، active_background_tasks بيتمسح
        #    فالجلسة اللي خلصت بتبقى status=completed لكن created_at قديمة
        #    لو كنا بنشيك على created_at هنعمل rescue لجلسات خلصت!
        #    updated_at بيتغير مع كل round → لو مش اتحدث من 10 دقايق فهي فعلاً عالقة
        # ========================================================
        limit = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        stuck = supabase.table('kitchen_sessions').select('id, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .neq('status', 'pending')\
            .lt('updated_at', limit).execute().data

        for s in (stuck or []):
            sid = s['id']
            if sid in active_background_tasks:
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
            active_background_tasks.add(sid)
            asyncio.create_task(run_and_track_session(StrategyFactory(), sid))

        # ========================================================
        # 3. HEARTBEAT WATCHDOG — مفيش update من 8 دقايق
        #    ✅ FIX: بنشيل من active_tasks قبل الـ fail
        # ========================================================
        heartbeat_limit = (datetime.now(timezone.utc) - timedelta(minutes=25)).isoformat()
        hanging = supabase.table('kitchen_sessions').select('id, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .lt('updated_at', heartbeat_limit).execute().data

        for s in (hanging or []):
            sid = s['id']
            # ✅ FIX: لو هي في active_tasks معناها لسه شغالة — متلمسهاش
            if sid in active_background_tasks:
                continue
            logger.warning(f"🚨 KitchenWatcher: Session {sid} hanging (no heartbeat 8m). Auto-failing.")
            # ✅ FIX: نشيل من active أولاً عشان الـ rescue مش يلاقيها
            active_background_tasks.discard(sid)
            reason = "توقف النظام عن الاستجابة (Heartbeat Timeout)"
            db.update_session_data(sid, {"status": "failed", "expert_opinions": {"error": reason}})
            await Notifier.send_telegram(f"🚨 [KITCHEN] تم إيقاف الجلسة {sid[:8]} بسبب عدم الاستجابة.")

        # ========================================================
        # 4. GLOBAL TIMEOUT — أقدم من 45 دقيقة
        #    ✅ FIX: رفعنا لـ 45 دقيقة + بنشيل من active قبل الـ fail
        #    ✅ FIX: لو هي في active_tasks معناها لسه شغالة — بنوقفها بشكل نظيف
        # ========================================================
        global_limit = (datetime.now(timezone.utc) - timedelta(minutes=45)).isoformat()
        too_long = supabase.table('kitchen_sessions').select('id, created_at, status')\
            .neq('status', 'completed')\
            .neq('status', 'failed')\
            .lt('created_at', global_limit).execute().data

        for s in (too_long or []):
            sid = s['id']
            logger.warning(f"🚨 KitchenWatcher: Session {sid} exceeded 45m global limit. Auto-failing.")
            # ✅ FIX: نشيل من active أولاً — هيخلي run_and_track_session يلاقيها failed ويوقف
            active_background_tasks.discard(sid)
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
        active_background_tasks.discard(session_id)


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