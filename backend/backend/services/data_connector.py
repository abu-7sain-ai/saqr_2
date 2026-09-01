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
            
            if not df.empty and len(df) >= 2:
                df['rsi_14'] = RSIIndicator(close=df['close'], window=min(14, len(df)-1)).rsi().fillna(50.0)
                df['ema_20'] = df['close'].ewm(span=20, adjust=False).mean()
                df['ema_50'] = df['close'].ewm(span=50, adjust=False).mean()
                df['ema_200'] = df['close'].ewm(span=200, adjust=False).mean()
                indicator_bb = BollingerBands(close=df['close'], window=min(20, len(df)), window_dev=2)
                df['bb_high'] = indicator_bb.bollinger_hband().fillna(df['close'])
                df['bb_low'] = indicator_bb.bollinger_lband().fillna(df['close'])
                indicator_macd = MACD(close=df['close'])
                df['macd'] = indicator_macd.macd().fillna(0.0)
            
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
        """جلب أخبار حقيقية من CryptoPanic API المجاني + CoinGecko Trending كـ fallback"""
        headlines = []
        
        # المحاولة 1: CryptoPanic Public API (مجاني بدون مفتاح)
        try:
            async with httpx.AsyncClient() as client:
                # CryptoPanic public posts endpoint — لا يتطلب مفتاح
                url = f"https://cryptopanic.com/api/free/v1/posts/?currencies={symbol}&kind=news&public=true"
                resp = await client.get(url, timeout=5, follow_redirects=True)
                if resp.status_code == 200:
                    data = resp.json()
                    results = data.get('results', [])[:5]
                    for item in results:
                        title = item.get('title', '')
                        votes = item.get('votes', {})
                        sentiment = 'إيجابي' if votes.get('positive', 0) > votes.get('negative', 0) else 'سلبي' if votes.get('negative', 0) > votes.get('positive', 0) else 'محايد'
                        headlines.append(f"[{sentiment}] {title}")
        except Exception as e:
            print(f"CryptoPanic API error: {e}")
        
        # المحاولة 2: CoinGecko Trending كـ fallback
        if not headlines:
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get("https://api.coingecko.com/api/v3/search/trending", timeout=5)
                    if resp.status_code == 200:
                        coins = resp.json().get('coins', [])[:5]
                        trending_names = [c['item']['name'] for c in coins]
                        headlines.append(f"العملات الأكثر رواجاً حالياً: {', '.join(trending_names)}")
            except Exception as e:
                print(f"CoinGecko trending error: {e}")
        
        if headlines:
            return " | ".join(headlines)
        return f"لا تتوفر أخبار عاجلة عن {symbol} حالياً."

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
                .limit(1)
                .execute()
            )

            available = getattr(resp, 'count', 0) or 0
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
    async def collect_market_breadth(cls, platform='binance', api_key=None, api_secret=None, filter_symbols=None):
        """
        Fetches enriched data for whitelist symbols.
        ✅ يجلب سعر، تغيير 24 ساعة، حجم تداول، RSI، واتجاه EMA لكل عملة
        filter_symbols: لو محدد، يجلب فقط هذه العملات (مجموعات مختارة)
        """
        try:
            from backend.database import Database
            db = Database()
            whitelist = db.get_whitelist()  # Returns ['BTC/USDT', 'ETH/USDT', ...]
            if not whitelist:
                print("[DataConnector] ⚠️ Whitelist is empty — no symbols to fetch breadth for")
                return []

            # ✅ فلترة بناءً على المجموعات المختارة
            if filter_symbols:
                whitelist = [s for s in whitelist if s in filter_symbols]
                if not whitelist:
                    whitelist = filter_symbols  # fallback
                print(f"[DataConnector] 🎯 Filtered to {len(whitelist)} group symbols")

            print(f"[DataConnector] 📋 Fetching market breadth for {len(whitelist)} whitelist symbols")

            
            exchange_config = {'apiKey': api_key, 'secret': api_secret, 'enableRateLimit': True} if api_key else {}
            exchange = getattr(ccxt, platform)(exchange_config)
            
            # جلب التيكرات بطلب واحد سريع لجميع أزواج المنصة والفلترة محلياً (أسرع 100 مرة)
            formatted_symbols = [cls.format_symbol(s) for s in whitelist]
            try:
                all_tickers = await asyncio.to_thread(exchange.fetch_tickers)
                tickers = {sym: all_tickers[sym] for sym in formatted_symbols if sym in all_tickers}
            except Exception as e:
                print(f"[DataConnector] ⚠️ fetch_tickers batch failed: {e}")
                tickers = {}
            
            summary = []
            sorted_whitelist = sorted(whitelist, key=lambda s: tickers.get(cls.format_symbol(s), {}).get('quoteVolume', 0), reverse=True)
            
            for sym_raw in sorted_whitelist:
                sym = cls.format_symbol(sym_raw)
                ticker = tickers.get(sym, {})
                summary.append({
                    "symbol": sym_raw,
                    "price": ticker.get('last', 0),
                    "change_24h": round(ticker.get('percentage', 0) or 0, 2),
                    "volume": round(ticker.get('quoteVolume', 0) or 0, 0),
                    "high_24h": ticker.get('high', 0),
                    "low_24h": ticker.get('low', 0),
                    "rsi": None,
                    "ema_trend": None
                })

            # جلب RSI و EMA لأعلى 12 عملة نشطة بالتوازي فائق السرعة
            async def _fetch_indicator_fast(entry):
                try:
                    s_sym = cls.format_symbol(entry['symbol'])
                    df = await asyncio.to_thread(cls.get_ohlc, platform, s_sym, '4h', 30, api_key, api_secret)
                    if df is not None and not df.empty:
                        if 'rsi_14' in df.columns and not df['rsi_14'].isna().all():
                            entry["rsi"] = round(float(df['rsi_14'].iloc[-1]), 1)
                        if 'ema_20' in df.columns and 'ema_50' in df.columns:
                            entry["ema_trend"] = "صاعد" if df['ema_20'].iloc[-1] > df['ema_50'].iloc[-1] else "هابط"
                except Exception:
                    pass

            top_entries = summary[:12]
            if top_entries:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*[_fetch_indicator_fast(e) for e in top_entries]),
                        timeout=12.0
                    )
                except Exception as gather_err:
                    print(f"[DataConnector] Parallel indicators fetch timeout/err: {gather_err}")
            
            # العملات التي سيتم التركيز عليها في التحليل والتداول هي العملات الأعلى نشاطاً
            selected_summary = top_entries if len(top_entries) >= 3 else summary
            print(f"[DataConnector] ✅ Market breadth collected: {len(selected_summary)} top active symbols ({len([s for s in selected_summary if s.get('rsi')])} with RSI)")
            return selected_summary
        except Exception as e:
            print(f"Error collecting market breadth: {e}")
            return []

    @classmethod
    async def collect_all(cls, platform='binance', symbol='BTC/USDT', api_key=None, api_secret=None, filter_symbols=None):
        import time
        t0 = time.time()
        print(f"[DataConnector] Collecting data for {symbol} on {platform}...")
        
        async def _fetch_4h():
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(cls.get_ohlc, platform, symbol, '4h', 300, api_key, api_secret),
                    timeout=8.0
                )
            except Exception as e:
                print(f"[DataConnector] 4h OHLC timeout/error: {e}")
                return pd.DataFrame(columns=['timestamp','open','high','low','close','volume','rsi_14','ema_20','ema_50','ema_200'])

        async def _fetch_15m():
            try:
                return await asyncio.wait_for(
                    asyncio.to_thread(cls.get_ohlc, platform, symbol, '15m', 100, api_key, api_secret),
                    timeout=8.0
                )
            except Exception as e:
                print(f"[DataConnector] 15m OHLC timeout/error: {e}")
                return pd.DataFrame(columns=['timestamp','open','high','low','close','volume'])

        async def _fetch_dom():
            try:
                return await asyncio.wait_for(cls.fetch_btc_dominance(), timeout=3.0)
            except:
                return 52.0

        async def _fetch_news_item():
            try:
                return await asyncio.wait_for(cls.fetch_cryptopanic_news(symbol.split('/')[0]), timeout=3.0)
            except:
                return "لا توجد أخبار عاجلة."

        async def _fetch_breadth():
            try:
                return await asyncio.wait_for(
                    cls.collect_market_breadth(platform, api_key, api_secret, filter_symbols=filter_symbols),
                    timeout=10.0
                )
            except Exception as e:
                print(f"[DataConnector] Market breadth timeout: {e}")
                return []

        # ⚡ تشغيل جميع مصادر البيانات بالتوازي فائق السرعة
        df_4h, df_15m, btc_dom, news, breadth = await asyncio.gather(
            _fetch_4h(), _fetch_15m(), _fetch_dom(), _fetch_news_item(), _fetch_breadth()
        )
        
        print(f"[DataConnector] ⚡ All parallel data collected in {time.time()-t0:.2f}s")
        current_price = df_15m['close'].iloc[-1] if df_15m is not None and not df_15m.empty else 0
        
        # مؤشرات فنية مضمونة الحساب
        rsi_val = 50.0
        ema_cross_val = "Bullish"
        trend_200_val = "Above"
        
        if df_4h is not None and not df_4h.empty:
            if 'rsi_14' in df_4h.columns and not df_4h['rsi_14'].isna().all():
                rsi_val = round(float(df_4h['rsi_14'].dropna().iloc[-1]), 2)
            if 'ema_20' in df_4h.columns and 'ema_50' in df_4h.columns:
                ema20 = df_4h['ema_20'].dropna()
                ema50 = df_4h['ema_50'].dropna()
                if not ema20.empty and not ema50.empty:
                    ema_cross_val = "Bullish" if ema20.iloc[-1] >= ema50.iloc[-1] else "Bearish"
            if 'ema_200' in df_4h.columns:
                ema200 = df_4h['ema_200'].dropna()
                if not ema200.empty:
                    trend_200_val = "Above" if current_price >= ema200.iloc[-1] else "Below"

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
                "rsi": rsi_val,
                "ema_cross": ema_cross_val,
                "trend_200": trend_200_val
            },
            "sentiment": cls.get_market_sentiment(),
            "timestamp": datetime.now().isoformat()
        }
        
        return data