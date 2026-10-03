import logging
import gc
import asyncio
from typing import Dict
from backend.config import get_supabase_client, get_supabase_admin_client
from backend.services.worker_executor import WorkerExecutor
from backend.utils.market_state import get_market_status

logger = logging.getLogger(__name__)

# ✅ FIX: Maximum workers to process per cycle to prevent OOM
MAX_WORKERS_PER_CYCLE = 20
BATCH_SIZE = 5  # Process in small batches with GC between them
MAX_POOL_SIZE = 30  # Don't cache more than 30 executors


class WorkerEngine:
    """
    محرك الموظفين (Orchestrator).
    المسؤول عن جلب الموظفين المشغلين والتأكد من مطابقتهم لوضع السوق.
    ✅ FIXED: Memory management — batch execution + GC + pool cleanup.
    """
    _executor_pool: Dict[str, WorkerExecutor] = {}

    @classmethod
    async def get_or_create_executor(cls, worker_id: str):
        """جلب أو تجهيز الـ executor لموظف معين (مفيد لمعالجة Webhook فورية)"""
        worker_id_str = str(worker_id)
        if worker_id_str in cls._executor_pool:
            return cls._executor_pool[worker_id_str]
        try:
            supabase = get_supabase_admin_client()
            response = supabase.table('workers').select('*').eq('id', worker_id).execute()
            if response.data:
                worker_data = response.data[0]
                executor = WorkerExecutor(worker_data)
                await executor._initialize_market()
                cls._executor_pool[worker_id_str] = executor
                return executor
        except Exception as e:
            logger.error(f"Failed to get_or_create_executor for {worker_id}: {e}")
        return None

    @classmethod
    def _cleanup_pool(cls, active_worker_ids: set):
        """✅ FIX: Remove stale executors from pool to free memory"""
        stale_ids = [wid for wid in cls._executor_pool if wid not in active_worker_ids]
        for wid in stale_ids:
            del cls._executor_pool[wid]
        if stale_ids:
            logger.info(f"🧹 Cleaned {len(stale_ids)} stale executors from pool")

        # ✅ FIX: If pool is still too large, remove oldest entries
        if len(cls._executor_pool) > MAX_POOL_SIZE:
            excess = len(cls._executor_pool) - MAX_POOL_SIZE
            keys_to_remove = list(cls._executor_pool.keys())[:excess]
            for k in keys_to_remove:
                del cls._executor_pool[k]
            logger.info(f"🧹 Trimmed pool by {excess} entries (max pool size: {MAX_POOL_SIZE})")

    @staticmethod
    async def run_all_workers():
        """
        جلب كافة الموظفين النشطين وتشغيلهم.
        ✅ FIXED: Batched execution with memory cleanup between batches.
        """

        current_market = get_market_status()
        logger.info(f"WorkerEngine: Checking all workers (Current Market: {current_market})")

        try:
            supabase = get_supabase_admin_client()
            response = supabase.table('workers')\
                .select('*')\
                .eq('status', 'running')\
                .execute()

            workers = response.data
            if not workers:
                logger.info("No active running workers found in DB.")
                return

            # ✅ FIX: Cleanup stale executors
            active_ids = {str(w['id']) for w in workers}
            WorkerEngine._cleanup_pool(active_ids)

            # ✅ FIX: Limit workers per cycle to prevent OOM
            eligible_workers = []
            for worker in workers:
                has_active_trades = False
                if worker['market_type'] != current_market:
                    try:
                        trades_resp = supabase.table('trades').select('id').eq('worker_id', worker['id']).is_('exit_at', 'null').execute()
                        has_active_trades = len(trades_resp.data) > 0 if trades_resp.data else False
                    except Exception as e:
                        logger.error(f"Error checking active trades for worker {worker['name']}: {e}")

                if worker['market_type'] == current_market or has_active_trades:
                    eligible_workers.append((worker, has_active_trades))
                else:
                    worker_id = str(worker['id'])
                    if worker_id in WorkerEngine._executor_pool:
                        del WorkerEngine._executor_pool[worker_id]

            if len(eligible_workers) > MAX_WORKERS_PER_CYCLE:
                logger.warning(f"⚠️ {len(eligible_workers)} eligible workers exceed limit of {MAX_WORKERS_PER_CYCLE}. Processing first {MAX_WORKERS_PER_CYCLE} only.")
                eligible_workers = eligible_workers[:MAX_WORKERS_PER_CYCLE]

            logger.info(f"📋 Processing {len(eligible_workers)} workers in batches of {BATCH_SIZE}")

            # ✅ FIX: Process in batches with GC between each batch
            for batch_idx in range(0, len(eligible_workers), BATCH_SIZE):
                batch = eligible_workers[batch_idx:batch_idx + BATCH_SIZE]

                for worker, has_mismatch_trades in batch:
                    worker_id = str(worker['id'])

                    if worker_id not in WorkerEngine._executor_pool:
                        logger.info(f"🆕 Creating new executor for worker: {worker['name']}")
                        WorkerEngine._executor_pool[worker_id] = WorkerExecutor(worker)
                    else:
                        WorkerEngine._executor_pool[worker_id].worker = worker

                    executor = WorkerEngine._executor_pool[worker_id]
                    if has_mismatch_trades:
                        logger.info(f"Running executor in Safe Mode (Exits only) for worker: {worker['name']} ({worker['type']})")
                    else:
                        logger.info(f"Running executor for worker: {worker['name']} ({worker['type']})")

                    try:
                        await executor.run()
                    except Exception as e:
                        logger.error(f"❌ Worker {worker['name']} failed: {e}")

                # ✅ FIX: Force garbage collection between batches to free RAM
                gc.collect()
                await asyncio.sleep(0.5)  # Small delay between batches

            logger.info(f"✅ WorkerEngine: Finished processing {len(eligible_workers)} workers")

        except Exception as e:
            logger.exception("Error in WorkerEngine:")
        finally:
            # ✅ FIX: Always GC at the end
            gc.collect()