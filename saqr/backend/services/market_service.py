import logging
import requests
import pandas as pd
from ta.volatility import AverageTrueRange, BollingerBands
from ta.momentum import RSIIndicator

logger = logging.getLogger(__name__)

# Fallback fake data if Binance is blocked (useful for local testing)
USE_MOCK_DATA = False

def fetch_klines(symbol: str, interval: str = "15m", limit: int = 100) -> pd.DataFrame:
    """
    Fetches OHLCV data from Binance API and returns a pandas DataFrame.
    """
    if USE_MOCK_DATA:
        # Mock logic just in case
        return pd.DataFrame()
        
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}"
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        data = r.json()
        
        # Binance kline output format:
        # [Open time, Open, High, Low, Close, Volume, Close time, Quote asset volume, Number of trades, ...]
        df = pd.DataFrame(data, columns=[
            "timestamp", "open", "high", "low", "close", "volume",
            "close_time", "quote_asset_volume", "trades", 
            "taker_buy_base", "taker_buy_quote", "ignore"
        ])
        
        # Convert types
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)
            
        df["timestamp"] = pd.to_datetime(df["timestamp"], unit='ms')
        return df
    except Exception as e:
        logger.error(f"Failed to fetch {symbol} from Binance: {e}")
        return pd.DataFrame()

def fetch_fear_greed() -> int:
    """
    Fetches the Fear & Greed index from alternative.me
    """
    try:
        r = requests.get("https://api.alternative.me/fng/?limit=1", timeout=5)
        r.raise_for_status()
        data = r.json()
        fng_value = int(data["data"][0]["value"])
        return fng_value
    except Exception as e:
        logger.error(f"Failed to fetch Fear & Greed: {e}")
        return 50 # Default to neutral

def calculate_indicators(df_15m: pd.DataFrame, df_daily: pd.DataFrame) -> dict:
    """
    Calculates current metrics vs long-term averages.
    Using 14-period window for SMAs as per 008 spec.
    """
    if df_15m.empty or len(df_15m) < 14:
        return {"atr": 0.0, "avg_atr": 0.0, "volume": 0.0, "avg_volume": 0.0}
        
    # 1. ATR Logic (14-period on 15m)
    atr_ind = AverageTrueRange(high=df_15m['high'], low=df_15m['low'], close=df_15m['close'], window=14)
    atr_series = atr_ind.average_true_range()
    current_atr = atr_series.iloc[-1]
    # SMA of ATR over 14 periods
    avg_atr_14 = atr_series.iloc[-14:].mean()
    
    # 2. Volume Logic (14-period on 15m)
    current_vol = df_15m['volume'].iloc[-1]
    avg_vol_14 = df_15m['volume'].iloc[-14:].mean()
    
    import math
    return {
        "atr": 0.0 if math.isnan(current_atr) else current_atr,
        "avg_atr": 0.0 if math.isnan(avg_atr_14) else avg_atr_14,
        "volume": current_vol,
        "avg_volume": 0.0 if math.isnan(avg_vol_14) else avg_vol_14,
        "close": df_15m['close'].iloc[-1],
        "atr_mult": current_atr / avg_atr_14 if avg_atr_14 > 0 else 1.0,
        "vol_mult": current_vol / avg_vol_14 if avg_vol_14 > 0 else 1.0
    }

def classify_market_v23(metrics: dict) -> str:
    """
    Strict Classification:
    ATR Current > ATR Avg * 1.5  OR  Volume Current > Volume Avg * 2
    """
    atr = metrics.get("atr", 0)
    avg_atr = metrics.get("avg_atr", 0)
    vol = metrics.get("volume", 0)
    avg_vol = metrics.get("avg_volume", 0)
    
    if (avg_atr > 0 and atr > avg_atr * 1.5) or (avg_vol > 0 and vol > avg_vol * 2):
        return "volatile"
    return "stable"

def check_market() -> dict:
    """
    Main checking logic. 
    Fetches 15m (current) and 1d (historical 20d) for ATR/Volume comparison.
    """
    from ..config import get_supabase_admin_client
    try:
        supabase = get_supabase_admin_client()
        resp = supabase.table('halal_coins').select('symbol').eq('is_indicator', True).eq('active', True).execute()
        indicators = [item['symbol'] for item in resp.data]
        
        if not indicators:
            indicators = ["BTCUSDT"]
            
        all_metrics = {}
        is_volatile = False
        
        for symbol in indicators:
            # Current 15m data
            df_15m = fetch_klines(symbol, interval="15m", limit=50)
            # Historical 20d data
            df_daily = fetch_klines(symbol, interval="1d", limit=30)
            
            if df_15m.empty or df_daily.empty: continue
            
            metrics = calculate_indicators(df_15m, df_daily)
            metrics["fear_greed"] = fetch_fear_greed()
            all_metrics[symbol] = metrics
            
            if classify_market_v23(metrics) == "volatile":
                is_volatile = True
                
        return {
            "status": "volatile" if is_volatile else "stable",
            "metrics": all_metrics
        }
    except Exception as e:
        logger.error(f"Error in check_market: {e}")
        return {"status": "stable", "metrics": {}}
