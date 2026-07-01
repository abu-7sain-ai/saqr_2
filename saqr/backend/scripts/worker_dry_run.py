import asyncio
import logging
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from backend.services.worker_engine import WorkerEngine
from backend.utils.market_state import set_market_status

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("DryRun")

async def test_run():
    logger.info("Starting Dry Run of WorkerEngine...")
    
    # Simulate a stable market
    set_market_status("stable")
    
    # Run all workers
    await WorkerEngine.run_all_workers()
    
    logger.info("Dry Run Complete.")

if __name__ == "__main__":
    asyncio.run(test_run())
