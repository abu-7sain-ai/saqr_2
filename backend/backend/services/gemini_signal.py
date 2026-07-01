import os
import logging
import asyncio
import time
from typing import Optional, Dict, Any, List
import httpx

logger = logging.getLogger("GeminiSignal")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "perplexity/sonar-pro"

# ─── Shared Signal Cache ─────────────────────────────────────────────────────
_signal_lock = asyncio.Lock()
_cached_signal: Optional[Dict[str, Any]] = None
_cache_timestamp: float = 0.0
_CACHE_TTL = 120.0


async def fetch_gemini_signal(
    active_symbols: List[str],
    worker_settings: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    if not OPENROUTER_API_KEY:
        logger.warning("⚠️ OPENROUTER_API_KEY غير مضبوط في .env")
        return None

    global _cached_signal, _cache_timestamp

    async with _signal_lock:
        now = time.monotonic()

        if _cached_signal is not None and (now - _cache_timestamp) < _CACHE_TTL:
            age = int(now - _cache_timestamp)
            logger.info(f"📦 Shared Signal (كاش عمره {age}s): {_cached_signal.get('symbol')}")
            if _cached_signal.get('symbol') in active_symbols:
                logger.info(f"🔁 {_cached_signal['symbol']} مفتوح مسبقاً — تجاهل")
                return None
            return _cached_signal

        logger.info("🔄 جلب إشارة جديدة من OpenRouter...")
        signal = await _call_openrouter(worker_settings)

        _cached_signal = signal
        _cache_timestamp = time.monotonic()

        if signal and signal.get('symbol') in active_symbols:
            logger.info(f"🔁 {signal['symbol']} مفتوح مسبقاً — تجاهل")
            return None

        return signal


async def invalidate_cache():
    global _cached_signal, _cache_timestamp
    async with _signal_lock:
        _cached_signal = None
        _cache_timestamp = 0.0
        logger.info("🗑️ Signal cache cleared")


async def _call_openrouter(worker_settings: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    import re

    tp = float(worker_settings.get("tpValue", 5.0))
    sl = float(worker_settings.get("slValue", 2.0))

    # ✅ الـ prompt الجديد: لا يطلب real-time Binance data
    # بيطلب تحليل عام بناءً على معرفة السوق — الـ model يقدر يجاوب بثقة
    prompt = (
        "You are a professional crypto trading analyst.\n\n"
        "Based on your knowledge of crypto market dynamics, technical patterns, and recent trends:\n"
        "- Pick ONE Binance USDT spot pair that typically shows strong short-term momentum\n"
        "- Consider well-known volatile pairs: BTC, ETH, SOL, BNB, AVAX, LINK, UNI, DOGE, ADA, DOT\n"
        "- Choose MEDIUM or HIGH confidence if you have any reasonable basis for the pick\n"
        "- Only use LOW if you have absolutely no basis whatsoever\n\n"
        "Important: You do NOT need live price data. Use your knowledge of which coins "
        "historically show momentum and are currently relevant in crypto markets.\n\n"
        f"Return ONLY this exact single line:\n"
        f"SIGNAL: [SYMBOL]USDT | TP: {tp} | SL: {sl} | CONFIDENCE: [HIGH/MEDIUM/LOW] | REASON: [max 10 words]"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://saqr-trading.app",
                    "X-Title": "Saqr Trading Bot",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                    "max_tokens": 150,
                },
            )

        if resp.status_code == 429:
            logger.warning("⏳ OpenRouter: rate limit")
            return None
        if not resp.is_success:
            logger.error(f"OpenRouter HTTP {resp.status_code}: {resp.text[:200]}")
            return None

        body = resp.json()
        text = (
            body.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "")
            .strip()
        )
        logger.info(f"🤖 OpenRouter raw: {text}")

        line = next((l for l in text.splitlines() if "SIGNAL:" in l.upper()), "")
        match = re.search(
            r"SIGNAL:\s*([A-Z0-9]+USDT)\s*\|\s*TP:\s*([\d.]+)\s*\|\s*SL:\s*([-\d.]+)"
            r"\s*\|\s*CONFIDENCE:\s*(\w+)(?:\s*\|\s*REASON:\s*(.+))?",
            line, re.IGNORECASE,
        )
        if not match:
            logger.warning(f"⚠️ OpenRouter: تنسيق غير مفهوم → {line}")
            return None

        symbol, tp_raw, sl_raw, confidence, reason = match.groups()
        symbol = symbol.upper()

        if confidence.upper() == "LOW":
            logger.info(f"🚫 ثقة منخفضة لـ {symbol} — تجاهل")
            return None

        logger.info(f"✅ Signal جديد: {symbol} | TP:{tp_raw}% | SL:{sl_raw}% | {confidence} | {reason or ''}")
        return {
            "symbol": symbol,
            "tp_percent": float(tp_raw),
            "sl_percent": float(sl_raw),
            "confidence": confidence.upper(),
            "reason": (reason or "").strip(),
        }

    except asyncio.TimeoutError:
        logger.error("⏰ OpenRouter timeout")
        return None
    except Exception as e:
        logger.error(f"OpenRouter error: {e}")
        return None