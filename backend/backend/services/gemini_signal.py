import os
import re
import logging
import asyncio
import time
from typing import Optional, Dict, Any, List
from backend.config import get_groq_client

logger = logging.getLogger("GroqSignal")

# ─── Shared Signal Cache ─────────────────────────────────────────────────────
_signal_lock = asyncio.Lock()
_cached_signal: Optional[Dict[str, Any]] = None
_cache_timestamp: float = 0.0
_CACHE_TTL = 30.0  # 30 seconds cache


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
    """
    جلب إشارة التداول حصرياً وفائق السرعة عبر Groq API.
    يتم استبعاد العملات المفتوحة مسبقاً لضمان تنويع المحفظة بين كافة الموظفين.
    """
    global _cached_signal, _cache_timestamp

    # استبعاد أي عملة مفتوحة حالياً عبر كافة الموظفين
    filtered_whitelist = tradeable_symbols or []
    if active_symbols and filtered_whitelist:
        filtered_whitelist = [s for s in filtered_whitelist if s not in active_symbols]

    if not filtered_whitelist:
        logger.info("ℹ️ جميع العملات المعتمدة لديها صفقات نشطة حالياً.")
        return None

    async with _signal_lock:
        now = time.monotonic()

        if _cached_signal is not None and (now - _cache_timestamp) < _CACHE_TTL:
            cached_sym = _cached_signal.get('symbol')
            if cached_sym and cached_sym not in active_symbols:
                matched = find_matching_symbol(cached_sym, filtered_whitelist)
                if matched:
                    logger.info(f"📦 استخدام إشارة Groq النشطة: {matched}")
                    _cached_signal['symbol'] = matched
                    return _cached_signal

        logger.info("🟢 جلب إشارة تداول جديدة عبر Groq...")
        signal = await _call_groq(worker_settings, filtered_whitelist, market_type)

        _cached_signal = signal
        _cache_timestamp = time.monotonic()

        if signal:
            sym = signal.get('symbol')
            if sym in active_symbols:
                logger.info(f"🔁 {sym} مفتوح مسبقاً — تجاهل والبحث عن بديل")
                return None

        return signal


async def invalidate_cache():
    """مسح الكاش فور دخول أي صفقة لإجبار الموظف التالي على اختيار عملة مختلفة"""
    global _cached_signal, _cache_timestamp
    async with _signal_lock:
        _cached_signal = None
        _cache_timestamp = 0.0
        logger.info("🗑️ تم مسح كاش الإشارات لتوزيع العملات على الموظفين")


async def _call_groq(
    worker_settings: Dict[str, Any],
    tradeable_symbols: List[str] = None,
    market_type: str = "crypto",
) -> Optional[Dict[str, Any]]:
    """استدعاء Groq API مع دعم تدوير النماذج واستخراج الرمز بدقة"""
    tp = float(worker_settings.get("tpValue", 4.0))
    sl = float(worker_settings.get("slValue", 2.0))

    whitelist_str = ", ".join(tradeable_symbols) if tradeable_symbols else "BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, AVAX/USDT, LINK/USDT, DOGE/USDT"

    prompt = (
        f"You are a professional quantitative trading engine.\n\n"
        f"Allowed candidates list: {whitelist_str}\n\n"
        f"Task: Select EXACTLY ONE best symbol from the candidates list that has the strongest momentum right now.\n"
        f"Return ONLY this exact line:\n"
        f"SIGNAL: [SYMBOL] | TP: {tp} | SL: {sl} | CONFIDENCE: HIGH | REASON: [short]"
    )

    groq_models = [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.6-27b",
        "llama-3.3-70b-versatile",
    ]

    client = get_groq_client()

    for model_name in groq_models:
        try:
            chat_completion = await asyncio.to_thread(
                client.chat.completions.create,
                messages=[
                    {"role": "system", "content": "You are a quantitative trading signal engine. Output the SIGNAL line."},
                    {"role": "user", "content": prompt}
                ],
                model=model_name,
                temperature=0.1,
                max_tokens=500,
            )

            text = chat_completion.choices[0].message.content.strip()
            logger.info(f"🤖 Groq ({model_name}) Raw output: {text[:150]}...")

            # 1. البحث عن تنسيق SIGNAL
            match = re.search(
                r"SIGNAL:\s*([A-Z0-9/_-]+)(?:\s*\|\s*TP:\s*([\d.]+))?(?:\s*\|\s*SL:\s*([-\d.]+))?(?:\s*\|\s*CONFIDENCE:\s*(\w+))?(?:\s*\|\s*REASON:\s*(.+))?",
                text,
                re.IGNORECASE,
            )

            symbol_raw = None
            tp_raw = tp
            sl_raw = sl
            confidence = "HIGH"
            reason = "Technical breakout"

            if match:
                symbol_raw = match.group(1).upper().strip()
                if match.group(2): tp_raw = float(match.group(2))
                if match.group(3): sl_raw = float(match.group(3))
                if match.group(4): confidence = match.group(4).upper().strip()
                if match.group(5): reason = match.group(5).strip()

            # 2. لو الـ regex مجابش رمز مباشر، نبحث عن أي رمز من الـ whitelist في النص
            if not symbol_raw or not find_matching_symbol(symbol_raw, tradeable_symbols):
                for cand in tradeable_symbols:
                    cand_clean = cand.replace("/", "").upper()
                    if cand in text.upper() or cand_clean in text.upper():
                        symbol_raw = cand
                        break

            if not symbol_raw:
                logger.warning(f"⚠️ Groq ({model_name}) did not provide a recognizable symbol. Trying next model...")
                continue

            matched_symbol = find_matching_symbol(symbol_raw, tradeable_symbols)
            if not matched_symbol:
                logger.warning(f"⚠️ Symbol {symbol_raw} is not in whitelist!")
                continue

            logger.info(f"✅ إشارة مؤكدة من Groq ({model_name}): {matched_symbol} | TP: +{tp_raw}% | SL: -{sl_raw}% | {confidence} | {reason}")
            return {
                "symbol": matched_symbol,
                "tp_percent": float(tp_raw),
                "sl_percent": float(sl_raw),
                "confidence": confidence,
                "reason": reason,
            }

        except Exception as e:
            logger.warning(f"⚠️ Groq model {model_name} failed: {e}. Trying next Groq model...")
            continue

    logger.error("❌ All Groq models failed to produce a valid signal.")
    return None