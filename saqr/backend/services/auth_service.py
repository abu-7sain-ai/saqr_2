import logging
from backend.database import Database
from backend.services.notifier import Notifier

logger = logging.getLogger(__name__)

class AuthService:
    """
    Handles user authentication events and registration flow.
    """

    @staticmethod
    async def on_new_registration(user_id: str):
        """
        Triggered when a new user signs up. 
        Sends a notification to the Admin for approval.
        """
        try:
            # 1. Fetch user profile
            profile_resp = Database.get_profile(user_id)
            if not profile_resp:
                logger.error(f"Profile not found for new user {user_id}")
                return
            
            user = profile_resp
            
            # 2. Prepare Telegram Message
            msg = (
                "🆕 *مستخدم جديد ينتظر الموافقة*\n\n"
                f"👤 الاسم: {user.name}\n"
                f"📧 الإيميل: {user.email}\n"
                f"📱 الموبايل: {user.mobile or 'غير متوفر'}\n\n"
                "🛡️ الرجاء الدخول للمنصة لقبول أو رفض الطلب."
            )
            
            # 3. Notify Admin
            # We fetch the admin chat ID from settings
            admin_settings = Database.get_telegram_settings() # Fallback to super owner
            if admin_settings:
                await Notifier.send_telegram(msg)
                logger.info(f"Admin notified about new registration: {user.email}")
            else:
                logger.warning("No admin telegram settings found to notify registration.")

        except Exception as e:
            logger.error(f"Error in on_new_registration: {e}")

    @staticmethod
    async def approve_user(admin_id: str, target_user_id: str, plan_id: str = "free"):
        """
        Admin approves a pending user and assigns a plan.
        """
        try:
            # 1. Verify admin role
            admin_profile = Database.get_profile(admin_id)
            if not admin_profile or admin_profile.role != "admin":
                return {"success": False, "message": "Only admins can approve users."}

            # 2. Update user status
            from backend.database import supabase
            resp = supabase.table('profiles').update({
                "status": "active",
                "package": plan_id
            }).eq('id', target_user_id).execute()

            if resp.data:
                logger.info(f"User {target_user_id} approved by admin {admin_id}")
                return {"success": True, "message": f"User approved and assigned to {plan_id}."}
            
            return {"success": False, "message": "Failed to update user profile."}

        except Exception as e:
            logger.error(f"Error approving user: {e}")
            return {"success": False, "message": str(e)}
