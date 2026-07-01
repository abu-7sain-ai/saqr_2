"""
Saqr (الصقر) — Historical Data Seeder
سكربت الجلب الأولي لـ 10 سنوات من البيانات التاريخية.

الاستخدام:
    python -m backend.scripts.seed_historical_data
    python -m backend.scripts.seed_historical_data --symbol ETH/USDT --years 5
"""

import asyncio
import argparse
import sys
import os
import time
import sys
import os

# Set encoding to UTF-8 for Windows compatibility
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Ensure project root is in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from dotenv import load_dotenv
load_dotenv()


async def main(symbol: str, timeframe: str, years: int, skip_fg: bool):
    from backend.services.historical_data import HistoricalDataEngine
    
    engine = HistoricalDataEngine()
    
    start_time = time.time()
    
    print("=" * 60)
    print(f"Saqr - Historical Data Fetcher")
    print(f"   Symbol:    {symbol}")
    print(f"   Timeframe: {timeframe}")
    print(f"   Duration:  {years} years")
    print("=" * 60)
    
    # 1. OHLCV
    print(f"\n[1/2] Fetching OHLCV from Binance...")
    
    def on_progress(fetched, total):
        pct = min(100, int(fetched / max(total, 1) * 100))
        bar = "█" * (pct // 2) + "░" * (50 - pct // 2)
        print(f"\r  [{bar}] {pct}% ({fetched:,}/{total:,})", end="", flush=True)
    
    df_ohlcv = await engine.fetch_full_ohlcv(
        symbol=symbol, timeframe=timeframe, years=years,
        on_progress=on_progress
    )
    print()  # newline after progress bar
    
    if df_ohlcv.empty:
        print("X Failed to fetch data. Check internet connection.")
        return
    
    print(f"  OK: Fetched {len(df_ohlcv):,} candles")
    print(f"  From: {df_ohlcv['timestamp'].min()}")
    print(f"  To:   {df_ohlcv['timestamp'].max()}")
    
    # Save to Supabase
    print(f"\nSaving to Supabase...")
    saved_ohlcv = await engine.save_ohlcv_to_supabase(df_ohlcv, symbol, timeframe)
    print(f"  OK: Saved {saved_ohlcv:,} OHLCV records")
    
    # 2. Fear & Greed
    if not skip_fg:
        print(f"\n[2/2] Fetching Fear & Greed...")
        df_fg = await engine.fetch_fear_greed_history(days=int(years * 365.25))
        
        if not df_fg.empty:
            print(f"  OK: Fetched {len(df_fg):,} days")
            saved_fg = await engine.save_fear_greed_to_supabase(df_fg)
            print(f"  OK: Saved {saved_fg:,} Fear & Greed records")
        else:
            print("  W: No Fear & Greed data fetched")
    
    elapsed = time.time() - start_time
    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)
    
    print("\n" + "=" * 60)
    print(f"Seed complete in {minutes}m {seconds}s")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Saqr Historical Data Seeder")
    parser.add_argument("--symbol", default="BTC/USDT", help="Trading pair (default: BTC/USDT)")
    parser.add_argument("--timeframe", default="4h", help="Candle timeframe (default: 4h)")
    parser.add_argument("--years", type=int, default=10, help="Years of history (default: 10)")
    parser.add_argument("--skip-fg", action="store_true", help="Skip Fear & Greed fetch")
    
    args = parser.parse_args()
    asyncio.run(main(args.symbol, args.timeframe, args.years, args.skip_fg))
