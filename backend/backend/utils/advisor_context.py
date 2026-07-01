import logging
import asyncio
from ..services.market_service import check_market
from ..config import get_supabase_admin_client

logger = logging.getLogger("AdvisorContext")

async def get_system_snapshot(user_id=None):
    """
    تجميع لقطة شاملة لحالة النظام ليقرأها المستشار الذكي.
    يستخدم asyncio.gather لزيادة السرعة وتقليل وقت الانتظار.
    """
    snapshot = []
    
    async def fetch_health():
        try:
            from ..services.health_service import HealthService
            health = await HealthService.get_full_health_report()
            return [
                f"🏗️ حالة المبنى التقني: {health['overall']}",
                f"📡 استجابة API بينانس: {health['api']['latency']}ms ({health['api']['status']})",
                f"💾 قاعدة البيانات: {health['database']['status']}"
            ]
        except Exception as e:
            logger.error(f"Snapshot Error (Health): {e}")
            return []

    async def fetch_market():
        try:
            m_result = await asyncio.to_thread(check_market)
            status_ar = "مستقر" if m_result['status'] == 'stable' else "متوتر"
            return [f"🌤️ جو السوق العام: {status_ar}"]
        except Exception as e:
            logger.error(f"Snapshot Error (Market): {e}")
            return []

    async def fetch_halal_and_context():
        # FR-011-08: The halal list MUST be fetched fresh from the database on every request
        halal_symbols = []
        res = []
        try:
            supabase = get_supabase_admin_client()
            # Fetch symbols strictly from halal_coins
            halal_resp = await asyncio.to_thread(
                supabase.table('halal_coins')
                .select('symbol')
                .eq('active', True)
                .execute
            )
            
            if not halal_resp.data:
                # FR-011-08: If the halal_coins table is empty or inaccessible, notify admin
                from ..services.notifier import Notifier
                await Notifier.send_telegram("🚨 [ADVISOR] المستودع المعتمد (Halal Coins) فارغ! تم إيقاف التحليل.")
                raise ValueError("halal_coins_empty")

            halal_symbols = [row['symbol'] for row in halal_resp.data]
            res.append(f"📦 المستودع المعتمد: {len(halal_symbols)} عملة حلال جاهزة للتحليل.")
            res.append(f"⚠️ العملات المسموحة فقط: {', '.join(halal_symbols[:20])}{'...' if len(halal_symbols) > 20 else ''}")
            
            # Fetch Trades
            trades_query = supabase.table('trades').select('*')
            if user_id:
                trades_query = trades_query.eq('user_id', user_id)
            trades_query = trades_query.order('created_at', desc=True)
            
            trades_resp = await asyncio.to_thread(trades_query.limit(5).execute)
            trades = trades_resp.data
            if trades:
                res.append("📜 سجل آخر الصفقات:")
                for t in trades:
                    res_val = float(t.get('result') or 0)
                    status = "✅ ربح" if res_val > 0 else "❌ خسارة" if res_val < 0 else "⏳ مفتوحة"
                    res.append(f"- {t['pair']}: {status} ({res_val:.2f}$)")
            else:
                res.append("📜 لا توجد صفقات مؤخراً.")
        except Exception as e:
            logger.error(f"Snapshot Error (Halal/Trades): {e}")
            if str(e) == "halal_coins_empty":
                raise
        return res

    async def fetch_hr():
        try:
            supabase = get_supabase_admin_client()
            workers_query = supabase.table('workers').select('*')
            if user_id:
                workers_query = workers_query.eq('user_id', user_id)
            
            workers_resp = await asyncio.to_thread(workers_query.execute)
            workers = workers_resp.data
            running = [w for w in workers if w['status'] == 'running']
            
            top_performer = max(workers, key=lambda x: float(x.get('total_profit_loss', 0))) if workers else None
            res = [f"👥 سجل الحضور: {len(running)} موظفاً على رأس العمل."]
            if top_performer and float(top_performer.get('total_profit_loss', 0)) > 0:
                res.append(f"🏆 الموظف المثالي: {top_performer['name']} (ربح {top_performer['total_profit_loss']}$)")
            return res
        except Exception as e:
            logger.error(f"Snapshot Error (Workers): {e}")
            return []

    # Execute all in parallel
    results = await asyncio.gather(
        fetch_health(),
        fetch_market(),
        fetch_halal_and_context(),
        fetch_hr()
    )
    
    for r in results:
        snapshot.extend(r)

    return "\n".join(snapshot)
