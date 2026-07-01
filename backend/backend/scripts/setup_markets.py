import asyncio
from backend.config import get_supabase_admin_client

async def setup_markets_schema():
    supabase = get_supabase_admin_client()
    
    print("Step 1: Creating Default Markets...")
    markets = [
        {"name": "بينانس (Binance)", "description": "سوق العملات الرقمية العالمي"},
        {"name": "السوق الأمريكي (US Stocks)", "description": "سوق الأسهم الأمريكي والسلع"}
    ]
    
    # ملاحظة: سنحاول جلب السوق أولاً لتجنب التكرار
    for m in markets:
        try:
            supabase.table('markets').upsert(m, on_conflict='name').execute()
        except Exception as e:
            print(f"Note: Markets table might not exist yet. Please ensure it's created in Supabase SQL Editor.")
            print(f"Required Schema:\nCREATE TABLE markets (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  name TEXT UNIQUE NOT NULL,\n  description TEXT,\n  active BOOLEAN DEFAULT TRUE,\n  created_at TIMESTAMPTZ DEFAULT NOW()\n);")
            return

    print("Step 2: Fetching Market IDs...")
    resp = supabase.table('markets').select('id, name').execute()
    market_map = {m['name']: m['id'] for m in resp.data}
    binance_id = market_map.get("بينانس (Binance)")

    print(f"Step 3: Linking existing coins to Binance (ID: {binance_id})...")
    # سنقوم بتحديث كل العملات التي ليس لها market_id
    try:
        supabase.table('halal_coins').update({"market_id": binance_id}).is_("market_id", "null").execute()
        print("Success: Database linked and seeded.")
    except Exception as e:
        print(f"Error linking coins: {e}")
        print("Required Modification:\nALTER TABLE halal_coins ADD COLUMN market_id UUID REFERENCES markets(id);")

if __name__ == "__main__":
    asyncio.run(setup_markets_schema())
