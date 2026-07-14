import logging
from typing import Dict
from backend.config import get_supabase_client, get_supabase_admin_client
from backend.services.worker_executor import WorkerExecutor
from backend.utils.market_state import get_market_status

logger = logging.getLogger(__name__)

class WorkerEngine:
    """
    محرك الموظفين (Orchestrator).
    المسؤول عن جلب الموظفين المشغلين والتأكد من مطابقتهم لوضع السوق.
    """
    # ✅ FIX 3: Worker Pool — نعيد استخدام نفس الـ executor بدل إنشاء object جديد كل مرة
    _executor_pool: Dict[str, WorkerExecutor] = {}

    @staticmethod
    async def run_all_workers():
        """
        جلب كافة الموظفين النشطين وتشغيلهم.
        """

        current_market = get_market_status()
        logger.info(f"WorkerEngine: Checking all workers (Current Market: {current_market})")
        
        try:
            # ✅ FIX: نستخدم service client عشان يتخطى RLS ويشوف كل الـ workers
            supabase = get_supabase_admin_client()
            # جلب الموظفين الذين حالتهم 'running'
            response = supabase.table('workers')\
                .select('*')\
                .eq('status', 'running')\
                .execute()
            
            workers = response.data
            if not workers:
                logger.info("No active running workers found in DB.")
                return

            for worker in workers:
                worker_id = str(worker['id'])
                
                # Check if mismatching worker has open active trades
                has_active_trades = False
                if worker['market_type'] != current_market:
                    try:
                        trades_resp = supabase.table('trades').select('id').eq('worker_id', worker['id']).is_('exit_at', 'null').execute()
                        has_active_trades = len(trades_resp.data) > 0 if trades_resp.data else False
                    except Exception as e:
                        logger.error(f"Error checking active trades for worker {worker['name']}: {e}")

                # التأكد من أن الموظف مناسب لهذا السوق أو لديه صفقات معلقة بحاجة للمتابعة والإغلاق
                if worker['market_type'] == current_market or has_active_trades:
                    # ✅ FIX 3: استخدم executor موجود أو أنشئ واحد جديد فقط لأول مرة
                    if worker_id not in WorkerEngine._executor_pool:
                        logger.info(f"🆕 Creating new executor for worker: {worker['name']}")
                        WorkerEngine._executor_pool[worker_id] = WorkerExecutor(worker)
                    else:
                        # حدّث بيانات الموظف بس — لا تعيد بناء الـ market instance
                        WorkerEngine._executor_pool[worker_id].worker = worker
                    
                    executor = WorkerEngine._executor_pool[worker_id]
                    if worker['market_type'] != current_market:
                        logger.info(f"Running executor in Safe Mode (Exits only) for worker: {worker['name']} ({worker['type']})")
                    else:
                        logger.info(f"Running executor for worker: {worker['name']} ({worker['type']})")
                    await executor.run()
                else:
                    # لو الموظف اتوقف أو اتغير نوعه، امسحه من الـ pool
                    if worker_id in WorkerEngine._executor_pool:
                        del WorkerEngine._executor_pool[worker_id]
                    logger.info(f"Skipping worker {worker['name']}: Market mismatch ({worker['market_type']} vs {current_market}) and no active trades.")

        except Exception as e:
            logger.exception("Error in WorkerEngine:")