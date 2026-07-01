import asyncio
from backend.config import get_supabase_admin_client

async def verify_schema():
    supabase = get_supabase_admin_client()
    print("Verifying 'markets' table...")
    try:
        resp = supabase.table('markets').select('*').limit(1).execute()
        print(f"Success! Found {len(resp.data)} markets.")
        
        print("\nVerifying 'halal_coins' market_id column...")
        resp = supabase.table('halal_coins').select('market_id').limit(1).execute()
        print("Success! 'market_id' column is accessible.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(verify_schema())
