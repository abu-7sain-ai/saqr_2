"""
Saqr (الصقر) — Historical Data Engine
محرك البيانات التاريخية للتداول الكمي
"""

import logging
import asyncio
import ccxt
import httpx
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator
from ta.volatility import AverageTrueRange

logger = logging.getLogger("HistoricalDataEngine")

BINANCE_MAX_LIMIT = 1000

TIMEFRAME_MS = {
    "1m": 60_000,
    "5m": 300_000,
    "15m": 900_000,
    "1h": 3_600_000,
    "4h": 14_400_000,
    "1d": 86_400_000,
}


class HistoricalDataEngine:

    def __init__(self):
        from backend.config import get_supabase_admin_client
        self.supabase = get_supabase_admin_client()

    # ================================================================
    # 1. OHLCV — جلب من Binance
    # ================================================================

    async def fetch_full_ohlcv(self, symbol="BTC/USDT", timeframe="4h", years=10, on_progress=None):
        logger.info("Starting %d-year OHLCV fetch for %s (%s)", years, symbol, timeframe)

        exchange = ccxt.binance({"enableRateLimit": True})
        tf_ms = TIMEFRAME_MS.get(timeframe, 14_400_000)

        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        start_ms = now_ms - int(years * 365.25 * 24 * 3600 * 1000)
        total_candles_estimate = int((now_ms - start_ms) / tf_ms)

        all_candles = []
        since = int(start_ms)
        batch_num = 0

        consecutive_errors = 0
        while since < now_ms:
            batch_num += 1
            try:
                candles = await asyncio.to_thread(
                    exchange.fetch_ohlcv,
                    symbol, timeframe,
                    since=since, limit=BINANCE_MAX_LIMIT
                )
                if not candles:
                    break
                all_candles.extend(candles)
                since = candles[-1][0] + tf_ms
                if on_progress:
                    on_progress(len(all_candles), total_candles_estimate)
                if batch_num % 5 == 0:
                    logger.info("  Batch %d: %d/%d candles", batch_num, len(all_candles), total_candles_estimate)
                consecutive_errors = 0
                await asyncio.sleep(0.1)
            except ccxt.BadSymbol as e:
                logger.error("  Symbol %s is not supported by Binance: %s", symbol, e)
                break
            except Exception as e:
                consecutive_errors += 1
                logger.error("  Error at batch %d: %s", batch_num, e)
                if consecutive_errors >= 3:
                    logger.error("  Too many consecutive errors (%d) for %s. Stopping fetch.", consecutive_errors, symbol)
                    break
                await asyncio.sleep(2)
                continue

        if not all_candles:
            logger.warning("No candles fetched for %s", symbol)
            return pd.DataFrame()

        df = pd.DataFrame(all_candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
        df = df.drop_duplicates(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
        df = self._compute_indicators(df)

        logger.info("Fetched %d candles for %s (%s → %s)", len(df), symbol, df["timestamp"].min(), df["timestamp"].max())
        return df

    def _compute_indicators(self, df):
        if len(df) < 200:
            return df
        df["rsi_14"] = RSIIndicator(close=df["close"], window=14).rsi()
        df["ema_20"] = EMAIndicator(close=df["close"], window=20).ema_indicator()
        df["ema_50"] = EMAIndicator(close=df["close"], window=50).ema_indicator()
        df["ema_200"] = EMAIndicator(close=df["close"], window=200).ema_indicator()
        df["atr_14"] = AverageTrueRange(high=df["high"], low=df["low"], close=df["close"], window=14).average_true_range()
        df["volume_sma_20"] = df["volume"].rolling(window=20).mean()
        return df

    # ================================================================
    # 2. Fear & Greed — جلب من Alternative.me
    # ================================================================

    async def fetch_fear_greed_history(self, days=3650):
        logger.info("Fetching %d days of Fear & Greed history...", days)
        url = f"https://api.alternative.me/fng/?limit={days}&format=json"
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
            records = data.get("data", [])
            if not records:
                logger.warning("No Fear & Greed data returned")
                return pd.DataFrame()
            rows = [
                {
                    "date": datetime.fromtimestamp(int(r["timestamp"]), tz=timezone.utc).date(),
                    "value": int(r["value"]),
                    "label": r["value_classification"],
                }
                for r in records
            ]
            df = pd.DataFrame(rows)
            df = df.drop_duplicates(subset=["date"]).sort_values("date").reset_index(drop=True)
            logger.info("Fetched %d days of Fear & Greed (%s → %s)", len(df), df["date"].min(), df["date"].max())
            return df
        except Exception as e:
            logger.error("Error fetching Fear & Greed: %s", e)
            return pd.DataFrame()

    # ================================================================
    # 3. Supabase — تخزين
    # ================================================================

    async def save_ohlcv_to_supabase(self, df, symbol, timeframe="4h"):
        if df.empty:
            return 0

        logger.info("Saving %d OHLCV records for %s...", len(df), symbol)

        BATCH_SIZE = 500
        saved = 0

        for start in range(0, len(df), BATCH_SIZE):
            batch = df.iloc[start:start + BATCH_SIZE]
            rows = []
            for _, row in batch.iterrows():
                record = {
                    "symbol": symbol,
                    "timeframe": timeframe,
                    "timestamp": row["timestamp"].isoformat(),
                    "open": float(row["open"]),
                    "high": float(row["high"]),
                    "low": float(row["low"]),
                    "close": float(row["close"]),
                    "volume": float(row["volume"]),
                }
                # ── دايماً نبعت كل الـ columns بنفس الـ keys (حتى لو None)
                for col in ["rsi_14", "ema_20", "ema_50", "ema_200", "atr_14", "volume_sma_20"]:
                    val = row.get(col)
                    if val is not None and not (isinstance(val, float) and np.isnan(val)):
                        record[col] = float(val)
                    else:
                        record[col] = None
                rows.append(record)

            try:
                # ── upsert بدلاً من insert لتجنب 409 Conflict
                self.supabase.table("historical_ohlcv").upsert(
                    rows, on_conflict="symbol,timeframe,timestamp"
                ).execute()
                saved += len(rows)
            except Exception as e:
                logger.error("Batch save error: %s", e)

            if start % 2000 == 0 and start > 0:
                logger.info("  Saved %d/%d records...", saved, len(df))

        await self._update_sync_status(
            "ohlcv", symbol, timeframe,
            oldest=df["timestamp"].min().isoformat(),
            newest=df["timestamp"].max().isoformat(),
            total=saved,
        )

        logger.info("Saved %d OHLCV records for %s", saved, symbol)
        return saved

    async def save_fear_greed_to_supabase(self, df):
        if df.empty:
            return 0

        logger.info("Saving %d Fear & Greed records...", len(df))

        BATCH_SIZE = 500
        saved = 0

        for start in range(0, len(df), BATCH_SIZE):
            batch = df.iloc[start:start + BATCH_SIZE]
            rows = [
                {
                    "date": str(row["date"]),
                    "value": int(row["value"]),
                    "label": row["label"],
                }
                for _, row in batch.iterrows()
            ]
            try:
                # ── upsert بدلاً من insert لتجنب 409 Conflict
                self.supabase.table("historical_fear_greed").upsert(
                    rows, on_conflict="date"
                ).execute()
                saved += len(rows)
            except Exception as e:
                logger.error("Batch FG save error: %s", e)

        await self._update_sync_status(
            "fear_greed", None, None,
            oldest=str(df["date"].min()),
            newest=str(df["date"].max()),
            total=saved,
        )

        logger.info("Saved %d Fear & Greed records", saved)
        return saved

    # ================================================================
    # 4. Supabase — تحميل
    # ================================================================

    async def load_ohlcv(self, symbol="BTC/USDT", timeframe="4h", years=10):
        import time
        t0 = time.time()
        logger.info("Loading OHLCV for %s (%s) from Supabase...", symbol, timeframe)

        try:
            all_rows = []
            page_size = 1000
            max_pages = 25
            last_ts = None

            for page in range(max_pages):
                query = (
                    self.supabase.table("historical_ohlcv")
                    .select("timestamp,open,high,low,close,volume,rsi_14,ema_20,ema_50,ema_200,atr_14,volume_sma_20")
                    .eq("symbol", symbol)
                    .eq("timeframe", timeframe)
                    .order("timestamp", desc=False)
                    .limit(page_size)
                )
                if last_ts:
                    query = query.gt("timestamp", last_ts)

                resp = await asyncio.to_thread(query.execute)
                if not resp.data:
                    break
                all_rows.extend(resp.data)
                if len(resp.data) < page_size:
                    break
                last_ts = resp.data[-1]["timestamp"]

            if not all_rows:
                logger.warning("No OHLCV data in Supabase for %s", symbol)
                return pd.DataFrame()

            df = pd.DataFrame(all_rows)
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
            df = df.sort_values("timestamp").reset_index(drop=True)

            logger.info("📥 Loaded %d OHLCV records in %.1fs", len(df), time.time() - t0)
            return df

        except Exception as e:
            logger.error("Error loading OHLCV from Supabase: %s", e)
            return pd.DataFrame()

    async def load_fear_greed(self, years=10):
        logger.info("Loading Fear & Greed from Supabase...")
        try:
            resp = (
                self.supabase.table("historical_fear_greed")
                .select("date,value,label")
                .order("date", desc=False)
                .limit(4000)
                .execute()
            )
            if not resp.data:
                return pd.DataFrame()
            df = pd.DataFrame(resp.data)
            df["date"] = pd.to_datetime(df["date"]).dt.date
            logger.info("📥 Loaded %d Fear & Greed records", len(df))
            return df
        except Exception as e:
            logger.error("Error loading Fear & Greed: %s", e)
            return pd.DataFrame()

    # ================================================================
    # 5. تحديث تزايدي (يومي)
    # ================================================================

    async def update_to_latest(self, symbol="BTC/USDT", timeframe="4h"):
        logger.info("Incremental update for %s (%s)...", symbol, timeframe)

        try:
            resp = (
                self.supabase.table("historical_ohlcv")
                .select("timestamp")
                .eq("symbol", symbol)
                .eq("timeframe", timeframe)
                .order("timestamp", desc=True)
                .limit(1)
                .execute()
            )
            if resp.data:
                last_ts = pd.to_datetime(resp.data[0]["timestamp"], utc=True)
                since_ms = int(last_ts.timestamp() * 1000)
                logger.info("  Last candle: %s", last_ts)
            else:
                logger.info("  No existing data — running full fetch")
                df = await self.fetch_full_ohlcv(symbol, timeframe)
                return await self.save_ohlcv_to_supabase(df, symbol, timeframe)
        except Exception as e:
            logger.error("Error checking last candle: %s", e)
            return 0

        exchange = ccxt.binance({"enableRateLimit": True})
        tf_ms = TIMEFRAME_MS.get(timeframe, 14_400_000)
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

        new_candles = []
        fetch_since = since_ms + tf_ms

        while fetch_since < now_ms:
            try:
                candles = await asyncio.to_thread(
                    exchange.fetch_ohlcv, symbol, timeframe,
                    since=fetch_since, limit=BINANCE_MAX_LIMIT
                )
                if not candles:
                    break
                new_candles.extend(candles)
                fetch_since = candles[-1][0] + tf_ms
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.error("Error fetching new candles: %s", e)
                break

        if not new_candles:
            logger.info("  Already up to date")
            return 0

        df_new = pd.DataFrame(new_candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df_new["timestamp"] = pd.to_datetime(df_new["timestamp"], unit="ms", utc=True)
        df_new = df_new.drop_duplicates(subset=["timestamp"])

        try:
            context_resp = (
                self.supabase.table("historical_ohlcv")
                .select("timestamp,open,high,low,close,volume")
                .eq("symbol", symbol)
                .eq("timeframe", timeframe)
                .order("timestamp", desc=True)
                .limit(200)
                .execute()
            )
            if context_resp.data:
                df_context = pd.DataFrame(context_resp.data)
                df_context["timestamp"] = pd.to_datetime(df_context["timestamp"], utc=True)
                df_combined = pd.concat([df_context, df_new]).drop_duplicates(
                    subset=["timestamp"]
                ).sort_values("timestamp").reset_index(drop=True)
                df_combined = self._compute_indicators(df_combined)
                df_new = df_combined.tail(len(df_new))
        except Exception:
            pass

        saved = await self.save_ohlcv_to_supabase(df_new, symbol, timeframe)
        logger.info("Updated %d new candles for %s", saved, symbol)
        return saved

    async def update_fear_greed_to_latest(self):
        logger.info("Updating Fear & Greed...")
        try:
            resp = (
                self.supabase.table("historical_fear_greed")
                .select("date")
                .order("date", desc=True)
                .limit(1)
                .execute()
            )
            if resp.data:
                last_date = pd.to_datetime(resp.data[0]["date"]).date()
                days_diff = (datetime.now(timezone.utc).date() - last_date).days
                if days_diff <= 1:
                    logger.info("  Fear & Greed already up to date")
                    return 0
                fetch_days = days_diff + 1
            else:
                fetch_days = 3650
        except Exception:
            fetch_days = 3650

        df = await self.fetch_fear_greed_history(days=fetch_days)
        if df.empty:
            return 0
        return await self.save_fear_greed_to_supabase(df)

    # ================================================================
    # 6. حالة المزامنة
    # ================================================================

    async def _update_sync_status(self, data_type, symbol, timeframe, oldest, newest, total):
        try:
            record = {
                "data_type": data_type,
                "symbol": symbol,
                "timeframe": timeframe,
                "last_synced_at": datetime.now(timezone.utc).isoformat(),
                "oldest_record": oldest,
                "newest_record": newest,
                "total_records": total,
                "status": "done",
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            try:
                self.supabase.table("historical_sync_status").upsert(
                    record, on_conflict="data_type,symbol,timeframe"
                ).execute()
            except Exception:
                self.supabase.table("historical_sync_status").insert(record).execute()
        except Exception as e:
            logger.error("Error updating sync status: %s", e)

    async def get_sync_status(self):
        try:
            resp = self.supabase.table("historical_sync_status").select("*").execute()
            return resp.data or []
        except Exception as e:
            logger.error("Error fetching sync status: %s", e)
            return []

    # ================================================================
    # 7. Full Seed
    # ================================================================

    async def seed_all(self, symbol="BTC/USDT", timeframe="4h", years=10):
        logger.info("=" * 60)
        logger.info("FULL SEED: %s (%s) - %d years", symbol, timeframe, years)
        logger.info("=" * 60)

        results = {}

        df_ohlcv = await self.fetch_full_ohlcv(symbol, timeframe, years)
        results["ohlcv_fetched"] = len(df_ohlcv)
        results["ohlcv_saved"] = await self.save_ohlcv_to_supabase(df_ohlcv, symbol, timeframe)

        df_fg = await self.fetch_fear_greed_history(days=int(years * 365.25))
        results["fear_greed_fetched"] = len(df_fg)
        results["fear_greed_saved"] = await self.save_fear_greed_to_supabase(df_fg)

        logger.info("🏁 SEED COMPLETE: %s", results)
        return results


# Singleton
historical_engine = HistoricalDataEngine()



















