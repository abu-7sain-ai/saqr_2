import asyncio
import logging
from unittest.mock import AsyncMock, MagicMock
from backend.telegram_bot import handle_message, processed_message_ids

# تنظيف سجلات التتبع
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("StressTest")

async def run_stress_test():
    """
    محاكاة وصول 5 رسائل متطابقة في نفس اللحظة للتأكد من أن الرد يكون مرة واحدة فقط.
    """
    logger.info("🧪 Starting Stress Test: Message Deduplication...")
    
    # تفريغ الذاكرة المؤقتة
    processed_message_ids.clear()
    
    # تجهيز كائن رسالة وهمي
    mock_update = MagicMock()
    mock_update.message.message_id = 12345
    mock_update.message.text = "هلا بالصقر، كيف السوق؟"
    mock_update.message.reply_text = AsyncMock()
    mock_update.effective_chat.id = "8679156479"
    
    mock_context = MagicMock()
    mock_context.bot.send_chat_action = AsyncMock()
    
    # محاكاة وصول الرسائل بشكل متزامن
    tasks = [handle_message(mock_update, mock_context) for _ in range(5)]
    
    logger.info("Sending 5 identical messages concurrently...")
    await asyncio.gather(*tasks)
    
    count = len(processed_message_ids)
    logger.info(f"Stress Test Complete. Total processed unique IDs: {count}")
    
    if count == 1:
        print("\n[SUCCESS]: Only ONE response was generated for 5 identical messages!")
    else:
        print(f"\n[FAILURE]: Processed {count} times instead of 1.")

if __name__ == "__main__":
    import backend.telegram_bot as bot
    bot.TELEGRAM_CHAT_ID = "8679156479"
    asyncio.run(run_stress_test())
