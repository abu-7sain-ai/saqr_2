import logging
from backend.config import get_supabase_client
from backend.services.notifier import Notifier

logger = logging.getLogger("BalanceService")

class BalanceService:
    """
    نظام الأرصدة - إدارة الرصيد المحرر وتحرير مبالغ الموظفين.
    (Scenario: Balance System)
    """

    @staticmethod
    async def release_worker_funds(user_id: str, worker_id: str, amount: float):
        """
        تحرير مبلغ من الموظف ونقله للرصيد المحرر.
        (Logic: Immediate free cash + Pending from active trades)
        """
        try:
            supabase = get_supabase_client()
            
            # 1. Fetch Worker Data
            w_resp = supabase.table('workers').select('*').eq('id', worker_id).execute()
            if not w_resp.data:
                return {"success": False, "message": "الموظف غير موجود"}
            
            worker = w_resp.data[0]
            current_cap = float(worker['current_capital'] or 0)
            
            if amount > current_cap:
                return {"success": False, "message": "المبلغ المطلوب أكبر من رصيد الموظف"}

            # 2. Calculate Free Cash
            # Free Cash = current_capital - Sum(active_trades_value)
            active_trades = supabase.table('trades').select('entry_price, amount_actual').eq('worker_id', worker_id).is_('exit_at', 'null').execute().data
            locked_value = sum(float(t['entry_price']) * float(t['amount_actual']) for t in active_trades)
            free_cash = max(0.0, current_cap - locked_value)

            # 3. Process Immediate Release
            immediate_release = min(free_cash, amount)
            remaining_to_release = amount - immediate_release

            # 4. Update Worker Stats
            new_capital = current_cap - amount # Reduce total allocation immediately
            new_pending = float(worker.get('pending_release', 0) or 0) + remaining_to_release
            
            supabase.table('workers').update({
                "current_capital": new_capital,
                "pending_release": new_pending
            }).eq('id', worker_id).execute()

            # 5. Update Profile (Released Balance)
            if immediate_release > 0:
                p_resp = supabase.table('profiles').select('balance').eq('id', user_id).execute()
                current_p_balance = float(p_resp.data[0]['balance'] or 0)
                supabase.table('profiles').update({
                    "balance": current_p_balance + immediate_release
                }).eq('id', user_id).execute()

            # 6. Notify
            msg = f"💰 تم طلب تحرير {amount}$\n✅ تم تحرير {immediate_release}$ فوراً من السيولة النقدية.\n⏳ المتبقي {remaining_to_release}$ سيتم تحويله للرصيد المحرر عند إغلاق الصفقات القادمة."
            await Notifier.send_telegram(msg)
            
            return {"success": True, "immediate": immediate_release, "pending": remaining_to_release}

        except Exception as e:
            logger.error(f"Release funds failed: {e}")
            return {"success": False, "message": str(e)}
