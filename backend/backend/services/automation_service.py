import logging
from datetime import datetime
from ..config import get_supabase_admin_client
from ..database import Database
from ..utils.market_state import set_market_status

logger = logging.getLogger("AutomationService")

async def execute_global_switch(target_type):
    """
    Executes a global environment switch.
    The workers will adapt automatically in their next run cycle.
    """
    logger.info(f"🔄 Executing global system switch to: {target_type}...")
    supabase = get_supabase_admin_client()
    
    # 1. Update Market State Record
    supabase.table('market_state').update({
        "current_type": target_type,
        "pending_switch": False,
        "target_type": None,
        "requested_at": None,
        "last_switch_at": datetime.now().isoformat()
    }).eq('id', 1).execute()

    # 2. Log activity
    Database.log_activity(
        user_id='00000000-0000-0000-0000-000000000000',
        log_type='market_switch',
        message=f"🛡️ System environment successfully switched to: {target_type}",
        metadata={"target_type": target_type}
    )
    
    # ✅ FIX 1: مزامنة الـ in-memory state مع الـ DB بعد التحديث
    set_market_status(target_type)
    logger.info(f"✅ Global switch completed. In-memory + DB both set to: {target_type}")
    return True

async def cancel_pending_switch():
    supabase = get_supabase_admin_client()
    supabase.table('market_state').update({
        "pending_switch": False,
        "target_type": None,
        "requested_at": None
    }).eq('id', 1).execute()
    return True

async def emergency_stop_all():
    supabase = get_supabase_admin_client()
    supabase.table('workers').update({"status": "stopped"}).execute()
    return True