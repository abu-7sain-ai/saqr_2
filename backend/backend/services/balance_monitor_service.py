import logging
import asyncio
import ccxt
from backend.config import get_supabase_client
from backend.services.emergency_protocol import EmergencyProtocol

logger = logging.getLogger("BalanceMonitor")

class BalanceMonitorService:
    """
    مراقب الرصيد - يتأكد من تطابق رصيد المنصة الحقيقي مع سجلات صقر.
    (Scenario 9)
    """

    @staticmethod
    async def monitor_all_users():
        """دورة مراقبة لكافة المستخدمين النشطين"""
        try:
            supabase = get_supabase_client()
            # جلب كافة الملفات الشخصية التي تملك API مربوط
            profiles = supabase.table('profiles').select('id, balance').execute().data
            
            for profile in profiles:
                user_id = profile['id']
                # جلب كافة الـ APIs المربوطة لهذا المستخدم
                apis = supabase.table('market_apis').select('*').eq('user_id', user_id).execute().data
                
                for api in apis:
                    await BalanceMonitorService.sync_user_balance(user_id, api, profile['balance'])
        except Exception as e:
            logger.error(f"Balance monitoring loop failed: {e}")

    @staticmethod
    async def sync_user_balance(user_id: str, api_config: dict, released_balance: float):
        """مزامنة رصيد مستخدم واحد على منصة محددة"""
        try:
            # 1. Fetch Real Balance from Exchange
            exchange_id = api_config.get('exchange', 'binance').lower()
            key = api_config.get('control_api_key')
            secret = api_config.get('control_api_secret')
            is_paper = not api_config.get('control_connected', False)

            if not key or not secret: return

            client = getattr(ccxt, exchange_id)({
                'apiKey': key,
                'secret': secret,
                'enableRateLimit': True
            })
            if is_paper: client.set_sandbox_mode(True)
            
            # Fetch USDT balance
            balance_resp = await asyncio.to_thread(client.fetch_balance)
            exchange_usdt = float(balance_resp['total'].get('USDT', 0))

            # 2. Calculate Saqr Total for this user
            supabase = get_supabase_client()
            workers = supabase.table('workers').select('current_capital').eq('user_id', user_id).execute().data
            saqr_workers_total = sum(float(w['current_capital'] or 0) for w in workers)
            
            saqr_total = saqr_workers_total + float(released_balance or 0)
            
            diff = exchange_usdt - saqr_total
            
            # --- Scenario 9 Detection ---
            if abs(diff) < 1.0: # Ignore tiny differences (dust)
                return

            if diff > 0:
                # Deposit Detected
                await EmergencyProtocol.handle_external_deposit(diff, user_id)
            else:
                # Withdrawal Detected
                # Calculate Free USDT across all workers
                # (Simple estimation: workers current capital minus estimated active trades value)
                # In a more advanced version, we'd sum the actual 'available_capital' from workers
                await EmergencyProtocol.handle_external_withdrawal(abs(diff), user_id, saqr_workers_total)

        except Exception as e:
            logger.error(f"Sync failed for user {user_id}: {e}")

if __name__ == "__main__":
    # Test
    async def test():
        await BalanceMonitorService.monitor_all_users()
    asyncio.run(test())
