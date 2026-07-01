import logging
import asyncio
import requests
from backend.services.market_service import fetch_fear_greed
from backend.config import get_openai_client, get_supabase_client

logger = logging.getLogger("FilterEngine")

class FilterEngine:

    @staticmethod
    def get_btc_dominance() -> float:
        """
        جلب BTC Dominance الحقيقي من CoinGecko (مجاني بدون API key).
        Fallback: 50.0 لو فشل الاتصال.
        """
        try:
            r = requests.get(
                "https://api.coingecko.com/api/v3/global",
                timeout=5
            )
            r.raise_for_status()
            pct = r.json()["data"]["market_cap_percentage"].get("btc", 50.0)
            logger.info(f"📊 BTC Dominance (live): {pct:.1f}%")
            return float(pct)
        except Exception as e:
            logger.warning(f"BTC Dominance fetch failed: {e} — using 50.0 fallback")
            return 50.0

    @staticmethod
    def get_news_risk(symbol: str) -> str:
        """
        إرجاع 'low' دايمًا — CryptoPanic غير مدمج.
        لو عندك CRYPTOPANIC_API_KEY ممكن تفعّله لاحقًا.
        """
        return "low"

    @classmethod
    async def layer_1_check(cls, symbol: str) -> bool:
        """
        Layer 1: فحص ماكرو مجاني.
        شرط الرفض: Extreme Greed فوق 80 فقط (كان 75 — رفعناه عشان مش يبقى صارم أوي).
        BTC Dominance: رفض الـ alts فقط لو BTC.D فوق 60% (كان 55 — رفعناه).
        """
        # 1. Fear & Greed
        fng = fetch_fear_greed()
        logger.info(f"📊 Fear & Greed Index: {fng}")
        if fng > 80:
            logger.info(f"🚫 Layer 1 REJECT: Extreme Greed ({fng} > 80). Safety first.")
            return False

        # 2. News Risk (placeholder — دايمًا low)
        if cls.get_news_risk(symbol) == "high":
            logger.info(f"🚫 Layer 1 REJECT: High news risk for {symbol}.")
            return False

        # 3. BTC Dominance — فقط للـ altcoins
        clean = symbol.replace("/", "").replace("USDT", "").replace("USDC", "").replace("BTC", "")
        is_btc = symbol.startswith("BTC")
        if not is_btc:
            btc_d = cls.get_btc_dominance()
            if btc_d > 60:
                logger.info(f"🚫 Layer 1 REJECT: BTC Dominance too high ({btc_d:.1f}% > 60%) — altcoins risky.")
                return False

        logger.info(f"✅ Layer 1 PASSED for {symbol} (FNG={fng})")
        return True

    @classmethod
    async def layer_2_check(cls, symbol: str, df, timeout=None) -> bool:
        """
        Layer 2: AI Micro-Analysis عبر OpenRouter.
        لو AI فشل أو timeout → نعدّي (True) عشان ما نوقفش كل الصفقات.
        """
        try:
            client = get_openai_client()
            last_price = df['close'].iloc[-1]
            prompt = (
                f"Trade Opportunity: {symbol} at ${last_price:.4f}. "
                f"Technical indicators show a potential entry signal. "
                f"Is this a high-probability trade right now? Reply ONLY with YES or NO."
            )

            async def call_ai():
                response = await asyncio.to_thread(
                    client.chat.completions.create,
                    model="google/gemini-2.0-flash-001",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=5
                )
                return response.choices[0].message.content.strip().upper()

            if timeout:
                try:
                    result = await asyncio.wait_for(call_ai(), timeout=timeout)
                    approved = "YES" in result
                    logger.info(f"{'✅' if approved else '🚫'} Layer 2 AI: {symbol} → {result}")
                    return approved
                except asyncio.TimeoutError:
                    logger.warning(f"⏳ Layer 2 Timeout for {symbol} — defaulting to PASS")
                    return True
            else:
                result = await call_ai()
                approved = "YES" in result
                logger.info(f"{'✅' if approved else '🚫'} Layer 2 AI: {symbol} → {result}")
                return approved

        except Exception as e:
            logger.error(f"Layer 2 AI Error for {symbol}: {e} — defaulting to PASS")
            return True  # عدّي لو AI فشل — مش نوقف كل الصفقات