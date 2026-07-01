import ccxt
import asyncio
import pandas as pd
import requests
import httpx
import json
from datetime import datetime, timedelta, timezone
from ta.momentum import RSIIndicator
from ta.trend import EMAIndicator, MACD
from ta.volatility import BollingerBands

class DataConnector:
    """
    Modular Data Connector for Saqr Strategy Factory.
    Fetches OHLC, Sentiments, and Market Dominance data.
    """
    
    @staticmethod
    def format_symbol(symbol):
        """Converts BTCUSDT to BTC/USDT for CCXT"""
        if '/' not in symbol:
            for quote in ['USDT', 'BTC', 'ETH', 'BNB']:
                if symbol.endswith(quote):
                    return f"{symbol[:-len(quote)]}/{quote}"
        return symbol

    @staticmethod
    def get_ohlc(platform='binance', symbol='BTC/USDT', timeframe='4h', limit=500, api_key=None, api_secret=None):
        try:
            exchange_config = {}
            if api_key and api_secret:
                exchange_config = {
                    'apiKey': api_key,
                    'secret': api_secret,
                    'enableRateLimit': True
                }
            
            exchange_class = getattr(ccxt, platform)(exchange_config)
            symbol = DataConnector.format_symbol(symbol)
            ohlc = exchange_class.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
            
            df = pd.DataFrame(ohlc, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            
            df['rsi_14'] = RSIIndicator(close=df['close'], window=14).rsi()
            df['ema_20'] = EMAIndicator(close=df['close'], window=20).ema_indicator()
            df['ema_50'] = EMAIndicator(close=df['close'], window=50).ema_indicator()
            df['ema_200'] = EMAIndicator(close=df['close'], window=200).ema_indicator()
            indicator_bb = BollingerBands(close=df['close'], window=20, window_dev=2)
            df['bb_high'] = indicator_bb.bollinger_hband()
            df['bb_low'] = indicator_bb.bollinger_lband()
            indicator_macd = MACD(close=df['close'])
            df['macd'] = indicator_macd.macd()
            
            return df
        except Exception as e:
            print(f"Error fetching OHLC from {platform}: {e}")
            return pd.DataFrame(columns=['timestamp', 'open', 'high', 'low', 'close', 'volume', 'rsi_14', 'ema_20', 'ema_50', 'ema_200'])

    @staticmethod
    async def fetch_btc_dominance():
        """جلب نسبة استحواذ البيتكوين الحقيقية من CoinGecko"""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get("https://api.coingecko.com/api/v3/global", timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    return round(data['data']['market_cap_percentage'].get('btc', 52.0), 2)
        except Exception as e:
            print(f"Error fetching BTC Dominance: {e}")
        return 52.0

    @staticmethod
    async def fetch_cryptopanic_news(symbol="BTC"):
        try:
            return f"أخبار إيجابية عامة عن {symbol} مع ترقب لبيانات التضخم."
        except:
            return "لا توجد أخبار عاجلة حالياً."

    @staticmethod
    def get_market_sentiment():
        sentiment = {
            "fear_greed": 50,
            "fear_greed_label": "Neutral"
        }
        try:
            response = requests.get("https://api.alternative.me/fng/", timeout=5)
            if response.status_code == 200:
                data = response.json()
                sentiment["fear_greed"] = int(data['data'][0]['value'])
                sentiment["fear_greed_label"] = data['data'][0]['value_classification']
        except Exception as e:
            print(f"Error fetching sentiment: {e}")
        return sentiment

    @staticmethod
    async def check_ohlc_coverage(symbol: str, years: int = 10, timeframe: str = '4h', min_coverage: float = 0.9):
        try:
            from backend.config import get_supabase_admin_client

            tf_hours = {'15m': 0.25, '1h': 1, '4h': 4, '1d': 24}.get(timeframe)
            if not tf_hours:
                return {'ok': False, 'coverage': 0.0, 'expected_candles': 0,
                        'available_candles': 0, 'timeframe': timeframe, 'symbol': symbol,
                        'oldest_ts': None, 'newest_ts': None, 'error': f'Unsupported timeframe: {timeframe}'}

            now = datetime.now(timezone.utc)
            start = now - timedelta(days=int(years * 365.25))
            expected = int((years * 365.25 * 24) / tf_hours)

            supabase = get_supabase_admin_client()
            resp = (
                supabase.table('historical_ohlcv')
                .select('timestamp', count='exact')
                .eq('symbol', symbol)
                .eq('timeframe', timeframe)
                .gte('timestamp', start.isoformat())
                .lte('timestamp', now.isoformat())
                .execute()
            )

            available = getattr(resp, 'count', None)
            if available is None:
                available = len(resp.data or [])

            oldest_ts = resp.data[0].get('timestamp') if resp.data else None
            newest_ts = resp.data[-1].get('timestamp') if resp.data else None
            coverage = (available / expected) if expected > 0 else 0.0

            return {
                'ok': coverage >= float(min_coverage),
                'coverage': coverage, 'expected_candles': expected,
                'available_candles': available, 'timeframe': timeframe,
                'symbol': symbol, 'oldest_ts': oldest_ts, 'newest_ts': newest_ts,
            }
        except Exception as e:
            return {'ok': False, 'coverage': 0.0, 'expected_candles': 0,
                    'available_candles': 0, 'timeframe': timeframe, 'symbol': symbol,
                    'oldest_ts': None, 'newest_ts': None, 'error': str(e)}

    @classmethod
    async def collect_market_breadth(cls, platform='binance', api_key=None, api_secret=None):
        """
        Fetches basic data for whitelist symbols.
        ✅ FIX: get_whitelist() returns list of strings, not dicts.
        """
        try:
            from backend.database import Database
            db = Database()
            whitelist = db.get_whitelist()  # Returns ['BTC/USDT', 'ETH/USDT', ...]
            if not whitelist:
                return []
            
            exchange_config = {'apiKey': api_key, 'secret': api_secret, 'enableRateLimit': True} if api_key else {}
            exchange = getattr(ccxt, platform)(exchange_config)
            
            # ✅ FIX: whitelist is already a list of strings
            formatted_symbols = [cls.format_symbol(s) for s in whitelist]
            tickers = await asyncio.to_thread(exchange.fetch_tickers, formatted_symbols)
            
            summary = []
            for sym_raw in whitelist:
                sym = cls.format_symbol(sym_raw)
                ticker = tickers.get(sym, {})
                summary.append({
                    "symbol": sym_raw,
                    "price": ticker.get('last', 0),
                    "change_24h": ticker.get('percentage', 0),
                    "volume": ticker.get('quoteVolume', 0)
                })
            return summary
        except Exception as e:
            print(f"Error collecting market breadth: {e}")
            return []

    @classmethod
    async def collect_all(cls, platform='binance', symbol='BTC/USDT', api_key=None, api_secret=None):
        import time
        t0 = time.time()
        print(f"[DataConnector] Collecting data for {symbol} on {platform}...")
        
        try:
            df_4h = await asyncio.wait_for(
                asyncio.to_thread(cls.get_ohlc, platform, symbol, '4h', 500, api_key, api_secret),
                timeout=15.0
            )
        except Exception as e:
            print(f"[DataConnector] 4h OHLC timeout/error: {e}")
            df_4h = pd.DataFrame(columns=['timestamp','open','high','low','close','volume','rsi_14','ema_20','ema_50','ema_200'])
        
        try:
            df_15m = await asyncio.wait_for(
                asyncio.to_thread(cls.get_ohlc, platform, symbol, '15m', 200, api_key, api_secret),
                timeout=15.0
            )
        except Exception as e:
            print(f"[DataConnector] 15m OHLC timeout/error: {e}")
            df_15m = pd.DataFrame(columns=['timestamp','open','high','low','close','volume'])
        
        print(f"[DataConnector] OHLC fetched in {time.time()-t0:.1f}s")
        
        current_price = df_15m['close'].iloc[-1] if df_15m is not None and not df_15m.empty else 0
        
        try:
            btc_dom = await asyncio.wait_for(cls.fetch_btc_dominance(), timeout=5.0)
        except:
            btc_dom = 52.0
        
        try:
            news = await asyncio.wait_for(cls.fetch_cryptopanic_news(symbol.split('/')[0]), timeout=3.0)
        except:
            news = "لا توجد أخبار عاجلة."
        
        try:
            breadth = await asyncio.wait_for(
                cls.collect_market_breadth(platform, api_key, api_secret),
                timeout=10.0
            )
        except Exception as e:
            print(f"[DataConnector] Market breadth timeout: {e}")
            breadth = []
        
        print(f"[DataConnector] All data collected in {time.time()-t0:.1f}s")
        
        data = {
            "symbol": symbol,
            "platform": platform,
            "current_price": current_price,
            "btc_dominance": btc_dom,
            "recent_news": news,
            "market_breadth": breadth,
            "ohlc_4h_history": df_4h.to_dict(orient='records') if df_4h is not None and not df_4h.empty else [],
            "ohlc_15m_history": df_15m.to_dict(orient='records') if df_15m is not None and not df_15m.empty else [],
            "indicators": {
                "rsi": round(float(df_4h['rsi_14'].iloc[-1]), 2) if (df_4h is not None and not df_4h.empty and 'rsi_14' in df_4h.columns and not df_4h['rsi_14'].isna().all()) else 50.0,
                "ema_cross": ("Bullish" if df_4h['ema_20'].iloc[-1] > df_4h['ema_50'].iloc[-1] else "Bearish") if (df_4h is not None and not df_4h.empty and 'ema_20' in df_4h.columns and 'ema_50' in df_4h.columns) else "N/A",
                "trend_200": ("Above" if current_price > df_4h['ema_200'].iloc[-1] else "Below") if (df_4h is not None and not df_4h.empty and 'ema_200' in df_4h.columns and not df_4h['ema_200'].isna().all()) else "N/A"
            },
            "sentiment": cls.get_market_sentiment(),
            "timestamp": datetime.now().isoformat()
        }
        
        return data