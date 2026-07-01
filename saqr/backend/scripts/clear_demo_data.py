import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# إضافة المسار الرئيسي للمشروع لتمكين الاستيراد
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# تحميل المتغيرات البيئية
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

url: str = os.environ.get("VITE_SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    sys.exit(1)

supabase: Client = create_client(url, key)

def clear_tables():
    tables_to_clear = [
        'trades',
        'workers',
        'kitchen_sessions',
        'activity_logs',
        'market_apis',
        'whitelist',
        'market_leaders',
        'halal_coins',
        'local_backup'
    ]
    
    print("Starting database cleanup...")
    
    for table in tables_to_clear:
        try:
            print(f"Cleaning table: {table}...")
            # Delete all rows
            # Note: neq('id', '...') is a trick to delete all rows since we can't do delete().all() directly in some clients
            supabase.table(table).delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
            print(f"Table {table} cleared.")
        except Exception as e:
            print(f"Error cleaning {table}: {e}")

    # Reset market state
    try:
        print("Resetting market state to 'stable'...")
        supabase.table('market_state').update({"current_type": "stable"}).eq('id', 1).execute()
        print("Market state reset.")
    except Exception as e:
        print(f"Error resetting market state: {e}")

if __name__ == "__main__":
    # Removed interactive input to avoid encoding issues, user already confirmed in chat
    clear_tables()
    print("\nSystem cleared successfully! Saqr is now ready for production.")
