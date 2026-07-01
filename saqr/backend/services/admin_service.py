import logging
from backend.database import Database
from backend.models.schemas import UserRole, UserStatus

logger = logging.getLogger(__name__)

class AdminService:
    """
    Administrative operations for Saqr platform.
    """

    @staticmethod
    def list_pending_users():
        """List all users waiting for approval."""
        try:
            from backend.database import supabase
            resp = supabase.table('profiles').select('*').eq('status', 'pending').execute()
            return resp.data or []
        except Exception as e:
            logger.error(f"Error listing pending users: {e}")
            return []

    @staticmethod
    def approve_user(admin_id: str, target_user_id: str, plan_id: str):
        """
        Approve a user and assign them to a specific plan.
        """
        try:
            # 1. Verify admin
            admin = Database.get_profile(admin_id)
            if not admin or admin.role != UserRole.ADMIN:
                return {"success": False, "message": "Unauthorized. Admin role required."}

            # 2. Assign plan and activate
            from backend.database import supabase
            payload = {
                "status": UserStatus.ACTIVE,
                "package": plan_id,
                "role": UserRole.OWNER
            }
            
            # If free, activate immediately. If paid, we might wait for payment setup?
            # Spec says: Paid plans = wait for Payment Method later.
            
            resp = supabase.table('profiles').update(payload).eq('id', target_user_id).execute()
            if resp.data:
                logger.info(f"Admin {admin_id} approved user {target_user_id} with plan {plan_id}")
                return {"success": True, "message": f"User approved with plan {plan_id}"}
            
            return {"success": False, "message": "Failed to update profile."}
        except Exception as e:
            logger.error(f"Error approving user: {e}")
            return {"success": False, "message": str(e)}

    @staticmethod
    def get_token_usage_stats():
        """
        Admin view of token usage across all models.
        (Mock implementation for now)
        """
        return {
            "OpenRouter": {"cost": 45.30, "days_left": 18},
            "Grok API": {"cost": 12.50, "days_left": 8, "warning": True},
            "Claude API": {"cost": 88.00, "days_left": 35},
            "DeepSeek": {"cost": 30.00, "days_left": 22}
        }
