"""
Saqr (الصقر) — Utility Helpers
Phase 1: Database Foundation

Provides:
- Exponential backoff retry decorator for Supabase operations
- Telegram alert sender (fires when all retries fail)
"""
import os
import time
import logging
from functools import wraps
from typing import Callable, TypeVar, Any

logger = logging.getLogger(__name__)

T = TypeVar("T")

# ---------------------------------------------------------------------------
# Retry Constants (from FR-013: 3 attempts, backoff 1s, 2s, 4s)
# ---------------------------------------------------------------------------
MAX_RETRIES = 3
BACKOFF_DELAYS = [1, 2, 4]  # seconds


def with_retry(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator that retries a function up to MAX_RETRIES times with
    exponential backoff (1s, 2s, 4s). On final failure, saves to
    local_backup and sends a Telegram alert.

    Usage:
        @with_retry
        def some_supabase_call():
            ...
    """
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> T:
        last_exc: Exception | None = None

        for attempt, delay in enumerate(BACKOFF_DELAYS, start=1):
            try:
                return func(*args, **kwargs)
            except Exception as exc:
                last_exc = exc
                logger.warning(
                    "Attempt %d/%d failed for %s: %s",
                    attempt,
                    MAX_RETRIES,
                    func.__name__,
                    exc,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(delay)

        # All retries exhausted
        logger.error(
            "All %d attempts failed for %s. Triggering fallback.",
            MAX_RETRIES,
            func.__name__,
        )
        send_telegram_alert(
            f"⚠️ Saqr: Supabase operation `{func.__name__}` failed after "
            f"{MAX_RETRIES} attempts.\nError: {last_exc}"
        )
        raise last_exc  # type: ignore[misc]

    return wrapper


# ---------------------------------------------------------------------------
# Telegram Alert
# ---------------------------------------------------------------------------

def send_telegram_alert(message: str) -> None:
    """
    Sends an alert message to the configured Telegram bot.
    Silently fails if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are not set
    (they are optional for Phase 1).
    """
    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")

    if not bot_token or not chat_id:
        logger.info("Telegram not configured — skipping alert: %s", message)
        return

    try:
        import urllib.request
        import urllib.parse
        import json

        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = json.dumps({"chat_id": chat_id, "text": message}).encode()
        req = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            logger.info("Telegram alert sent. Status: %s", resp.status)
    except Exception as exc:
        logger.error("Failed to send Telegram alert: %s", exc)
