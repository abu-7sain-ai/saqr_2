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


def find_matching_symbol(symbol: str, tradeable_symbols: List[str]) -> Optional[str]:
    if not tradeable_symbols:
        return symbol
    norm_symbol = symbol.replace("/", "").replace("-", "").replace("_", "").upper()
    for ts in tradeable_symbols:
        if ts.replace("/", "").replace("-", "").replace("_", "").upper() == norm_symbol:
            return ts
    return None


async def fetch_gemini_signal(
    active_symbols: List[str],
    worker_settings: Dict[str, Any],
    tradeable_symbols: List[str] = None,
    market_type: str = "crypto",
) -> Optional[Dict[str, Any]]:
    global _cached_signal, _cache_timestamp

    async with _signal_lock:
        now = time.monotonic()

        if _cached_signal is not None and (now - _cache_timestamp) < _CACHE_TTL:
            age = int(now - _cache_timestamp)
            logger.info(f"📦 Shared Signal (كاش عمره {age}s): {_cached_signal.get('symbol')}")
            
            cached_sym = _cached_signal.get('symbol')
            is_valid_for_whitelist = True
            if tradeable_symbols:
                matched = find_matching_symbol(cached_sym, tradeable_symbols)
                if not matched:
                    is_valid_for_whitelist = False
                    logger.info(f"📦 Cached signal {cached_sym} is not in the current worker's whitelist. Fetching new signal.")
                else:
                    _cached_signal['symbol'] = matched
                    cached_sym = matched

            if is_valid_for_whitelist:
                if cached_sym in active_symbols:
                    logger.info(f"🔁 {cached_sym} مفتوح مسبقاً — تجاهل")
                    return None
                return _cached_signal

        logger.info("🔄 جلب إشارة جديدة...")
        signal = await _get_signal_from_ai(worker_settings, tradeable_symbols, market_type)

        _cached_signal = signal
        _cache_timestamp = time.monotonic()

        if signal:
            sym = signal.get('symbol')
            if sym in active_symbols:
                logger.info(f"🔁 {sym} مفتوح مسبقاً — تجاهل")
                return None

        return signal


async def invalidate_cache():
    global _cached_signal, _cache_timestamp
    async with _signal_lock:
        _cached_signal = None
        _cache_timestamp = 0.0
        logger.info("🗑️ Signal cache cleared")


async def _get_signal_from_ai(
    worker_settings: Dict[str, Any],
    tradeable_symbols: List[str] = None,
    market_type: str = "crypto",
) -> Optional[Dict[str, Any]]:
    # Try direct Gemini first since we have GEMINI_API_KEY and OpenRouter often fails with 402
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            logger.info("🟢 محاولة جلب الإشارة باستخدام Gemini API مباشرة...")
            signal = await _call_gemini_directly(worker_settings, tradeable_symbols, market_type)
            if signal:
                return signal
        except Exception as e:
            logger.error(f"❌ Direct Gemini call failed: {e}. Falling back to Groq...")

    logger.info("🟡 محاولة جلب الإشارة باستخدام Groq...")
    return await _call_groq_fallback(worker_settings, tradeable_symbols, market_type)


async def _call_gemini_directly(
    worker_settings: Dict[str, Any],
    tradeable_symbols: List[str] = None,
    market_type: str = "crypto",
) -> Optional[Dict[str, Any]]:
    import re
    from backend.config import get_gemini_client

    tp = float(worker_settings.get("tpValue", 5.0))
    sl = float(worker_settings.get("slValue", 2.0))

    whitelist_str = ", ".join(tradeable_symbols) if tradeable_symbols else "BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, AVAX/USDT, LINK/USDT, DOGE/USDT"
    
    if market_type in ("shares", "stock", "alpaca"):
        prompt = (
            "You are a professional stock trading analyst.\n\n"
            "Based on your knowledge of stock market dynamics, technical patterns, and recent trends:\n"
            f"- Pick ONE stock symbol from this allowed whitelist: {whitelist_str}\n"
            "- Choose MEDIUM or HIGH confidence if you have any reasonable basis for the pick\n"
            "- Only use LOW if you have absolutely no basis whatsoever\n\n"
            "Important: You do NOT need live price data. Choose one that you believe has good short-term momentum.\n"
            f"Return ONLY this exact single line:\n"
            f"SIGNAL: [SYMBOL] | TP: {tp} | SL: {sl} | CONFIDENCE: [HIGH/MEDIUM/LOW] | REASON: [max 10 words]"
        )
    else:
        prompt = (
            "You are a professional crypto trading analyst.\n\n"
            "Based on your knowledge of crypto market dynamics, technical patterns, and recent trends:\n"
            f"- Pick ONE Binance USDT spot pair from this allowed whitelist: {whitelist_str}\n"
            "- Choose MEDIUM or HIGH confidence if you have any reasonable basis for the pick\n"
            "- Only use LOW if you have absolutely no basis whatsoever\n\n"
            "Important: You do NOT need live price data. Choose one that you believe has good short-term momentum.\n"
            f"Return ONLY this exact single line:\n"
            f"SIGNAL: [SYMBOL] | TP: {tp} | SL: {sl} | CONFIDENCE: [HIGH/MEDIUM/LOW] | REASON: [max 10 words]"
        )

    try:
        model = get_gemini_client()
        # Run synchronous generate_content in thread pool
        response = await asyncio.to_thread(model.generate_content, prompt)
        text = response.text.strip()
        logger.info(f"🤖 Direct Gemini raw: {text}")

        line = next((l for l in text.splitlines() if "SIGNAL:" in l.upper()), "")
        match = re.search(
            r"SIGNAL:\s*([A-Z0-9/_-]+)\s*\|\s*TP:\s*([\d.]+)\s*\|\s*SL:\s*([-\d.]+)"
            r"\s*\|\s*CONFIDENCE:\s*(\w+)(?:\s*\|\s*REASON:\s*(.+))?",
            line, re.IGNORECASE,
        )
        if not match:
            logger.warning(f"⚠️ Direct Gemini: تنسيق غير مفهوم → {line}")
            return None

        symbol_raw, tp_raw, sl_raw, confidence, reason = match.groups()
        symbol_raw = symbol_raw.upper()

        if confidence.upper() == "LOW":
            logger.info(f"🚫 ثقة منخفضة لـ {symbol_raw} — تجاهل")
            return None

        matched_symbol = find_matching_symbol(symbol_raw, tradeable_symbols)
        if not matched_symbol:
            logger.warning(f"⚠️ Direct Gemini suggested {symbol_raw} which is not in whitelist!")
            return None

        logger.info(f"✅ Signal جديد من Gemini: {matched_symbol} | TP:{tp_raw}% | SL:{sl_raw}% | {confidence} | {reason or ''}")
        return {
            "symbol": matched_symbol,
            "tp_percent": float(tp_raw),
            "sl_percent": float(sl_raw),
            "confidence": confidence.upper(),
            "reason": (reason or "").strip(),
        }
    except Exception as e:
        logger.error(f"Error in direct Gemini call: {e}")
        raise e


async def _call_groq_fallback(
    worker_settings: Dict[str, Any],
    tradeable_symbols: List[str] = None,
    market_type: str = "crypto",
) -> Optional[Dict[str, Any]]:
    import re
    from backend.config import get_groq_client

    tp = float(worker_settings.get("tpValue", 5.0))
    sl = float(worker_settings.get("slValue", 2.0))

    whitelist_str = ", ".join(tradeable_symbols) if tradeable_symbols else "BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, AVAX/USDT, LINK/USDT, DOGE/USDT"
    
    if market_type in ("shares", "stock", "alpaca"):
        prompt = (
            "You are a professional stock trading analyst.\n\n"
            "Based on your knowledge of stock market dynamics, technical patterns, and recent trends:\n"
            f"- Pick ONE stock symbol from this allowed whitelist: {whitelist_str}\n"
            "- Choose MEDIUM or HIGH confidence if you have any reasonable basis for the pick\n"
            "- Only use LOW if you have absolutely no basis whatsoever\n\n"
            "Important: You do NOT need live price data. Choose one that you believe has good short-term momentum.\n"
            f"Return ONLY this exact single line:\n"
            f"SIGNAL: [SYMBOL] | TP: {tp} | SL: {sl} | CONFIDENCE: [HIGH/MEDIUM/LOW] | REASON: [max 10 words]"
        )
    else:
        prompt = (
            "You are a professional crypto trading analyst.\n\n"
            "Based on your knowledge of crypto market dynamics, technical patterns, and recent trends:\n"
            f"- Pick ONE crypto pair from this allowed whitelist: {whitelist_str}\n"
            "- Choose MEDIUM or HIGH confidence if you have any reasonable basis for the pick\n"
            "- Only use LOW if you have absolutely no basis whatsoever\n\n"
            "Important: You do NOT need live price data. Choose one that you believe has good short-term momentum.\n"
            f"Return ONLY this exact single line:\n"
            f"SIGNAL: [SYMBOL] | TP: {tp} | SL: {sl} | CONFIDENCE: [HIGH/MEDIUM/LOW] | REASON: [max 10 words]"
        )

    try:
        client = get_groq_client()
        model_name = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
        
        chat_completion = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[{"role": "user", "content": prompt}],
            model=model_name,
            temperature=0.3,
            max_tokens=150
        )
        
        text = chat_completion.choices[0].message.content.strip()
        logger.info(f"🤖 Groq raw: {text}")

        line = next((l for l in text.splitlines() if "SIGNAL:" in l.upper()), "")
        match = re.search(
            r"SIGNAL:\s*([A-Z0-9/_-]+)\s*\|\s*TP:\s*([\d.]+)\s*\|\s*SL:\s*([-\d.]+)"
            r"\s*\|\s*CONFIDENCE:\s*(\w+)(?:\s*\|\s*REASON:\s*(.+))?",
            line, re.IGNORECASE,
        )
        if not match:
            logger.warning(f"⚠️ Groq: تنسيق غير مفهوم → {line}")
            return None

        symbol_raw, tp_raw, sl_raw, confidence, reason = match.groups()
        symbol_raw = symbol_raw.upper()

        if confidence.upper() == "LOW":
            logger.info(f"🚫 ثقة منخفضة لـ {symbol_raw} — تجاهل")
            return None

        matched_symbol = find_matching_symbol(symbol_raw, tradeable_symbols)
        if not matched_symbol:
            logger.warning(f"⚠️ Groq suggested {symbol_raw} which is not in whitelist!")
            return None

        logger.info(f"✅ Signal جديد من Groq: {matched_symbol} | TP:{tp_raw}% | SL:{sl_raw}% | {confidence} | {reason or ''}")
        return {
            "symbol": matched_symbol,
            "tp_percent": float(tp_raw),
            "sl_percent": float(sl_raw),
            "confidence": confidence.upper(),
            "reason": (reason or "").strip(),
        }

    except asyncio.TimeoutError:
        logger.error("⏰ Groq timeout")
        return None
    except Exception as e:
        logger.error(f"Groq error: {e}")
        return None