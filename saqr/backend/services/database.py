import os
from datetime import datetime, timezone
from dotenv import load_dotenv
from backend.config import get_supabase_admin_client

# Use SimpleSupabaseClient
supabase = get_supabase_admin_client()

class Database:
    @staticmethod
    def get_profile(user_id):
        """Fetch full profile using Pydantic model."""
        from backend.models.schemas import Profile
        try:
            response = supabase.table('profiles').select('*').eq('id', user_id).limit(1).execute()
            if response.data:
                return Profile(**response.data[0])
            return None
        except Exception as e:
            print(f"Error fetching profile: {e}")
            return None

    @staticmethod
    def get_plan(plan_id):
        """Fetch plan details."""
        from backend.models.schemas import Plan
        try:
            response = supabase.table('plans').select('*').eq('id', plan_id).limit(1).execute()
            if response.data:
                return Plan(**response.data[0])
            return None
        except Exception as e:
            print(f"Error fetching plan: {e}")
            return None

    @staticmethod
    def get_telegram_settings():
        """Fetch Telegram settings from the first active profile."""
        try:
            user_id = os.environ.get("SUPER_OWNER_ID")
            if not user_id:
                profile_resp = supabase.table('profiles').select('id').limit(1).execute()
                if profile_resp.data:
                    user_id = profile_resp.data[0]['id']
                else:
                    return None

            response = supabase.table('profiles').select('settings').eq('id', user_id).limit(1).execute()
            
            if response.data and 'settings' in response.data[0]:
                settings = response.data[0]['settings']
                return {
                    'token': settings.get('telegram_bot_token'),
                    'chat_id': settings.get('telegram_chat_id'),
                    'user_id': user_id
                }
            return None
        except Exception as e:
            print(f"Error fetching settings: {e}")
            return None

    @staticmethod
    def save_raw_message(user_id, message_data):
        """Save raw message to local_backup for history."""
        try:
            data = {
                "user_id": user_id,
                "trade_data": message_data,
                "synced": True
            }
            supabase.table('local_backup').insert(data).execute()
        except Exception as e:
            print(f"Error saving raw message: {e}")

    @staticmethod
    def save_advisor_chat(user_id, message, reply, usage, provider):
        """Save advisor chat message and reply to history with local backup."""
        try:
            log_dir = "logs"
            if not os.path.exists(log_dir):
                os.makedirs(log_dir)
            
            timestamp = datetime.now(timezone.utc).isoformat()
            log_entry = f"[{timestamp}] User: {user_id} | Provider: {provider}\nMsg: {message}\nReply: {reply}\nUsage: {usage}\n{'-'*40}\n"
            
            with open(os.path.join(log_dir, "advisor_chat.log"), "a", encoding="utf-8") as f:
                f.write(log_entry)
        except Exception as e:
            print(f"Error saving local advisor chat log: {e}")

        try:
            data = {
                "user_id": user_id,
                "message": message,
                "reply": reply,
                "usage": usage,
                "provider": provider
            }
            supabase.table('advisor_chat_history').insert(data).execute()
        except Exception as e:
            print(f"Error saving advisor chat to Supabase: {e}")

    @staticmethod
    def create_meeting_session(user_id, message_text):
        """إنشاء جلسة اجتماع خبراء جديدة بناءً على الإشارة الواردة."""
        try:
            data = {
                "user_id": user_id,
                "angle": "إشارة تلغرام واردة",
                "expert_opinions": {"radar": f"تم رصد رسالة جديدة: {message_text[:100]}..."},
                "market_type": "stable",
                "market_id": None
            }
            response = supabase.table('kitchen_sessions').insert(data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error creating session: {e}")
            return None

    @staticmethod
    def get_session(session_id):
        """Fetch a specific kitchen session by ID."""
        try:
            response = supabase.table('kitchen_sessions').select('*').eq('id', session_id).limit(1).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error fetching session {session_id}: {e}")
            return None

    @staticmethod
    def update_session_status(session_id, status):
        """Update the status of a kitchen session (UI feedback)."""
        try:
            current_session = Database.get_session(session_id)
            if not current_session:
                print(f"Warning: Session {session_id} not found for status update to {status}")
                return

            opinions = current_session.get('expert_opinions') or {}
            opinions['status'] = status

            supabase.table('kitchen_sessions').update({
                "status": status,
                "expert_opinions": opinions,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq('id', session_id).execute()
        except Exception as e:
            print(f"Non-critical Error updating session status for {session_id}: {e}")

    @staticmethod
    def update_session_data(session_id, additional_data):
        """Intelligently updates session columns and expert_opinions metadata."""
        try:
            current_session = Database.get_session(session_id)
            if not current_session:
                return

            top_level_cols = [
                'status', 'symbol', 'final_decision', 'market_type',
                'risk_level', 'angle', 'capital_target', 'issuers', 'market_id'
            ]

            update_payload = {}
            metadata_payload = current_session.get('expert_opinions') or {}

            for key, value in additional_data.items():
                if key in top_level_cols:
                    update_payload[key] = value
                else:
                    metadata_payload[key] = value

            if 'status' in metadata_payload and 'status' not in update_payload:
                if 'status' in additional_data:
                    update_payload['status'] = additional_data['status']
                else:
                    update_payload['status'] = metadata_payload['status']

            update_payload['expert_opinions'] = metadata_payload
            update_payload['updated_at'] = datetime.now(timezone.utc).isoformat()

            from fastapi.encoders import jsonable_encoder
            update_payload = jsonable_encoder(update_payload)

            supabase.table('kitchen_sessions').update(update_payload).eq('id', session_id).execute()
        except Exception as e:
            print(f"Error updating session data: {e}")

    @staticmethod
    def get_market_api(user_id, market_id):
        """Fetch API keys for a specific market and user."""
        try:
            # Guard against None user_id
            if not user_id or str(user_id).lower() == 'none':
                print("Error fetching market API: user_id is None")
                return None

            query = supabase.table('market_apis')\
                .select('historical_api_key, historical_api_secret, watch_api_key, watch_api_secret')\
                .eq('user_id', user_id)
            
            if market_id:
                query = query.eq('market_id', market_id)
                
            response = query.limit(1).execute()
            if response.data:
                data = response.data[0]
                return {
                    "api_key": data.get("historical_api_key") or data.get("watch_api_key"),
                    "api_secret": data.get("historical_api_secret") or data.get("watch_api_secret")
                }
            return None
        except Exception as e:
            print(f"Error fetching market API: {e}")
            return None

    @staticmethod
    def get_recent_trades_summary(user_id, limit=50):
        """Fetches the last N trade results for the 'Developed' learning model."""
        # ✅ FIX: guard None user_id + removed broken .not_.is_() chain
        if not user_id or str(user_id).lower() == 'none':
            return []
        try:
            response = supabase.table('trades')\
                .select('pair, entry_price, exit_price, result, exit_type, entry_at, exit_at')\
                .eq('user_id', user_id)\
                .order('exit_at', desc=True)\
                .limit(limit)\
                .execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Error fetching recent trades: {e}")
            return []

    @staticmethod
    def get_user_settings(user_id):
        """Fetch user settings (e.g., is Advanced/Developed enabled)."""
        if not user_id or str(user_id).lower() == 'none':
            return {'is_developed_enabled': True}
        try:
            response = supabase.table('profiles').select('settings').eq('id', user_id).limit(1).execute()
            return response.data[0]['settings'] if response.data else {}
        except Exception as e:
            print(f"Error fetching user settings: {e}")
            return {}

    @staticmethod
    def get_workers_by_user(user_id):
        """Fetch all workers for a specific user."""
        try:
            response = supabase.table('workers').select('*').eq('user_id', user_id).execute()
            return response.data if response.data else []
        except Exception as e:
            print(f"Error fetching workers for user {user_id}: {e}")
            return []

    @staticmethod
    def log_activity(user_id, log_type, message, metadata=None):
        """Log a system or user activity to activity_logs table."""
        try:
            data = {
                "user_id": user_id,
                "type": log_type,
                "message": message,
                "metadata": metadata or {}
            }
            supabase.table('activity_logs').insert(data).execute()
        except Exception as e:
            print(f"Error logging activity: {e}")

    @staticmethod
    def clone_worker_direct(worker_data):
        """Directly inserts a worker dictionary into the DB."""
        _EXCLUDED = {
            'concurrency_mode', 'is_hunter', 'model_type',
            'max_concurrent_trades', 'selection_criteria',
        }
        try:
            rpc_params = {
                "p_user_id": worker_data['user_id'],
                "p_owner": worker_data.get('owner', 'prince'),
                "p_market_type": worker_data.get('market_type', 'stable')
            }
            number_resp = supabase.rpc('next_worker_number', rpc_params).execute()
            worker_data["number"] = number_resp.data if number_resp.data else 1

            # ✅ FIX: حول symbol → pair و session_id → kitchen_session_id
            if 'symbol' in worker_data and 'pair' not in worker_data:
                worker_data['pair'] = worker_data.pop('symbol')
            elif 'symbol' in worker_data:
                del worker_data['symbol']

            if 'session_id' in worker_data and 'kitchen_session_id' not in worker_data:
                worker_data['kitchen_session_id'] = worker_data.pop('session_id')
            elif 'session_id' in worker_data:
                del worker_data['session_id']

            # ✅ FIX: شيل الـ columns غير الموجودة + نظّف nan/inf
            safe_worker = {k: v for k, v in worker_data.items() if k not in _EXCLUDED}
            safe_worker = _sanitize_for_json(safe_worker)

            response = supabase.table('workers').insert(safe_worker).execute()

            Database.log_activity(
                worker_data['user_id'],
                "worker_cloned",
                f"تم استنساخ الموظف {worker_data['name']}",
                {"worker_id": response.data[0]['id']} if response.data else {}
            )
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error in clone_worker_direct: {e}")
            return None

    @staticmethod
    def get_whitelist(market_id=None, active_only=True):
        """Fetch whitelist symbols — used by DataConnector for market breadth."""
        try:
            query = supabase.table('whitelist').select('symbol, is_active')
            if active_only:
                query = query.eq('is_active', True)
            if market_id:
                query = query.eq('market_id', market_id)
            response = query.execute()
            return [row['symbol'] for row in (response.data or [])]
        except Exception as e:
            print(f"Error fetching whitelist: {e}")
            return []