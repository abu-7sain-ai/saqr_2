import logging
import asyncio
from datetime import datetime
from backend.services.notifier import Notifier
from backend.services.data_connector import DataConnector
from backend.config import get_supabase_client

logger = logging.getLogger("EmergencyProtocol")

class EmergencyProtocol:
    """
    بروتوكول الطوارئ - إدارة السيناريوهات الافتراضية كما في القسم الأول.
    """

    @staticmethod
    async def handle_grok_timeout(context_msg: str):
        """
        Scenario 3 & 4: Grok Timeout Handling.
        """
        from backend.services.notifier import TelegramTemplates
        logger.warning(f"⚠️ Grok Timeout detected: {context_msg}")
        
        # Use template
        text = TelegramTemplates.GROK_TIMEOUT_SESSION if "اجتماع" in context_msg else TelegramTemplates.GROK_TIMEOUT_TRADE
        if "{pair}" in text: text = text.format(pair=context_msg.split()[-1])
        
        buttons = [
            {"text": "نعم - استمر", "callback_data": "grok_continue"},
            {"text": "لا - توقف", "callback_data": "grok_stop"}
        ]
        
        await Notifier.send_telegram(text, buttons=buttons)
        return False

    @staticmethod
    async def check_critical_news():
        """
        Scenario 5: Critical News Watcher.
        """
        try:
            from backend.services.notifier import TelegramTemplates
            news_data = await DataConnector.fetch_cryptopanic_news("ALL")
            critical_keywords = ["crash", "hack", "ban", "collapse", "emergency"]
            if any(k in news_data.lower() for k in critical_keywords):
                await EmergencyProtocol.stop_all_workers(TelegramTemplates.CRITICAL_NEWS)
                return True
            return False
        except Exception as e:
            logger.error(f"Error checking critical news: {e}")
            return False

    @staticmethod
    async def stop_all_workers(reason: str):
        """Emergency stop for all active workers."""
        try:
            supabase = get_supabase_client()
            supabase.table('workers').update({"status": "paused"}).eq('status', 'running').execute()
            await Notifier.send_telegram(reason)
            logger.info(f"All workers paused: {reason}")
        except Exception as e:
            logger.error(f"Failed to stop all workers: {e}")

    @staticmethod
    def log_trade_local(trade_data: dict):
        """Scenario 6: Local Backup."""
        # ... existing ...
        pass

    @staticmethod
    async def handle_external_deposit(amount: float, user_id: str):
        """Scenario 9: External Deposit."""
        try:
            from backend.services.notifier import TelegramTemplates
            supabase = get_supabase_client()
            profile_data = supabase.table('profiles').select('balance').eq('id', user_id).execute().data
            if not profile_data: return
            
            new_balance = float(profile_data[0]['balance'] or 0) + amount
            supabase.table('profiles').update({"balance": new_balance}).eq('id', user_id).execute()
            
            text = TelegramTemplates.DEPOSIT_DETECTED.format(amount=amount)
            await Notifier.send_telegram(text)
        except Exception as e:
            logger.error(f"Deposit failed: {e}")

    @staticmethod
    async def handle_external_withdrawal(amount: float, user_id: str, free_usdt: float):
        """Scenario 9: External Withdrawal."""
        from backend.services.notifier import TelegramTemplates
        text = TelegramTemplates.WITHDRAWAL_DETECTED.format(amount=amount, free=free_usdt)
        buttons = [
            {"text": "الرصيد المحرر", "callback_data": "deduct_released"},
            {"text": "موظف محدد", "callback_data": "deduct_worker"},
            {"text": "وزّع على الكل", "callback_data": "deduct_spread"}
        ]
        await Notifier.send_telegram(text, buttons=buttons)
