import logging

logger = logging.getLogger(__name__)

# Global market state
# This would eventually be persisted in DB settings
state = {
    "current_status": "stable" 
}

def get_market_status():
    return state["current_status"]

def set_market_status(status: str):
    state["current_status"] = status
    logger.info(f"Market status globally updated to: {status}")
