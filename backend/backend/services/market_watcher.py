import asyncio
import logging
from datetime import datetime, timedelta
from ..config import get_supabase_admin_client
from .market_service import check_market
from .telegram_service import send_interactive_market_alert
from ..utils.market_state import set_market_status

logger = logging.getLogger(__name__)

class MarketWatcher:
    def __init__(self):
        self.supabase = get_supabase_admin_client()
        self.is_running = False
        self.interval_minutes = 15
        self.timeout_minutes = 5

    async def start(self):
        self.is_running = True
        logger.info("Market Watcher started.")
        while self.is_running:
            try:
                await self.check_and_process()
            except Exception as e:
                logger.error(f"Error in MarketWatcher loop: {e}")
            await asyncio.sleep(self.interval_minutes * 60)

    def stop(self):
        self.is_running = False
        logger.info("Market Watcher stopped.")

    async def check_and_process(self):
        # 1. Fetch current market state
        state_resp = self.supabase.table('market_state').select('*').eq('id', 1).single().execute()
        current_state = state_resp.data

        # 2. Run market analysis
        analysis = check_market()
        detected_type = analysis['status']
        metrics = analysis['metrics']

        # Update metrics in DB for transparency
        btc_metrics = metrics.get('BTCUSDT', {})
        self.supabase.table('market_state').update({
            'atr_sma_14': btc_metrics.get('atr', 0),
            'volume_sma_14': btc_metrics.get('volume', 0),
            'updated_at': datetime.now().isoformat()
        }).eq('id', 1).execute()

        # 3. Decision Logic for Market Switching
        if detected_type != current_state['current_type']:
            if not current_state['pending_type'] or current_state['pending_type'] != detected_type:
                logger.info(f"Regime shift detected: {current_state['current_type']} -> {detected_type}")
                self.supabase.table('market_state').update({
                    'pending_type': detected_type,
                    'pending_since': datetime.now().isoformat()
                }).eq('id', 1).execute()
                
                profile_resp = self.supabase.table('profiles').select('telegram_chat_id').eq('role', 'owner').limit(1).execute()
                chat_id = profile_resp.data[0].get('telegram_chat_id') if profile_resp.data else None
                
                if chat_id:
                    await send_interactive_market_alert(chat_id=chat_id, status=detected_type, metrics=metrics)
            else:
                pending_since = datetime.fromisoformat(current_state['pending_since'].replace('Z', '+00:00'))
                if datetime.now(pending_since.tzinfo) - pending_since > timedelta(minutes=self.timeout_minutes):
                    logger.info(f"Implicit approval for shift to {detected_type}")
                    await self.apply_market_switch(detected_type)
        else:
            if current_state['pending_type']:
                self.supabase.table('market_state').update({'pending_type': None, 'pending_since': None}).eq('id', 1).execute()

        # 4. FR-011-09: Worker Inactivity Check
        await self.check_worker_inactivity()

    async def check_worker_inactivity(self):
        """Alert if an active worker hasn't traded in 24h."""
        try:
            # Fetch running workers
            workers_resp = self.supabase.table('workers').select('id, name, last_run_at, user_id').eq('status', 'running').execute()
            for worker in (workers_resp.data or []):
                # Check if it hasn't run or traded in 24h
                # We check the last trade exit
                last_trade = self.supabase.table('trades')\
                    .select('exit_at')\
                    .eq('worker_id', worker['id'])\
                    .order('exit_at', desc=True)\
                    .limit(1).execute()
                
                idle = False
                if not last_trade.data:
                    # No trades ever, check created_at?
                    # For simplicity, if no trades and created > 24h ago
                    pass
                else:
                    last_exit = last_trade.data[0]['exit_at']
                    if last_exit:
                        last_exit_dt = datetime.fromisoformat(last_exit.replace('Z', '+00:00'))
                        if datetime.now(last_exit_dt.tzinfo) - last_exit_dt > timedelta(hours=24):
                            idle = True
                
                if idle:
                    msg = f"⚠️ الموظف `{worker['name']}` لم ينفذ أي صفقات منذ أكثر من 24 ساعة. هل الوضع طبيعي؟ 🦅"
                    
                    # 1. Telegram
                    from .notifier import Notifier
                    await Notifier.send_telegram(msg)
                    
                    # 2. Activity Log (Fallback/Persistence)
                    from ..database import Database
                    Database.log_activity(
                        user_id=worker['user_id'],
                        log_type="worker_idle",
                        message=msg,
                        metadata={"worker_id": worker['id'], "idle_hours": 24}
                    )
        except Exception as e:
            logger.error(f"Error in check_worker_inactivity: {e}")

    async def apply_market_switch(self, new_type: str):
        # Update global state
        self.supabase.table('market_state').update({
            'current_type': new_type,
            'pending_type': None,
            'pending_since': None,
            'last_switch_at': datetime.now().isoformat()
        }).eq('id', 1).execute()

        # ✅ FIX 1: مزامنة الـ in-memory state فوراً
        set_market_status(new_type)
        logger.info(f"✅ Market switched to {new_type} — DB + Memory synced.")

        # Orchestrate workers
        await self.orchestrate_workers(new_type)

    async def orchestrate_workers(self, market_type: str):
        # Fetch all running workers
        workers_resp = self.supabase.table('workers').select('*').eq('status', 'running').execute()
        workers = workers_resp.data

        from .notifier import Notifier

        for worker in workers:
            # If the worker does NOT match the new market type
            if worker['market_type'] != market_type:
                buddy_id = worker.get('paired_with')
                
                # 1. Buddy Toggle Logic
                if buddy_id:
                    # Find and activate buddy
                    buddy_resp = self.supabase.table('workers').select('*').eq('id', buddy_id).execute()
                    if buddy_resp.data:
                        buddy = buddy_resp.data[0]
                        if buddy.get('status') != 'running':
                            # Activate the buddy
                            self.supabase.table('workers').update({'status': 'running'}).eq('id', buddy_id).execute()
                            logger.info(f"🔄 Buddy System Toggle: Activated paired worker '{buddy['name']}' ({buddy['market_type']})")
                            await Notifier.send_telegram(f"🔄 تم تفعيل الموظف الصديق <b>{buddy['name']}</b> لمجابهة السوق الجديد ({market_type}) 🦅")
                
                # 2. Check if current worker has active open trades
                trades_resp = self.supabase.table('trades').select('id').eq('worker_id', worker['id']).is_('exit_at', 'null').execute()
                has_active_trades = len(trades_resp.data) > 0 if trades_resp.data else False
                
                if not has_active_trades:
                    logger.info(f"Stopping worker {worker['name']} (no active trades & market mismatch)")
                    self.supabase.table('workers').update({'status': 'stopped'}).eq('id', worker['id']).execute()
                    await Notifier.send_telegram(f"⏹️ تم إيقاف الموظف <b>{worker['name']}</b> لعدم تطابق السوق الحالي مع استراتيجيته وعدم وجود صفقات مفتوحة.")
                else:
                    logger.info(f"Worker {worker['name']} has active trades. Keeping status 'running' in safe mode to manage exits.")
