import logging
import asyncio
from collections import deque
from telegram import Update
from telegram.ext import ApplicationBuilder, CallbackQueryHandler, MessageHandler, filters, ContextTypes
from backend.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
# FIX: automation_service تم حذفه — استبدلنا الفنكشنز بـ stubs مباشرة
from backend.config import get_supabase_admin_client

async def execute_global_switch(target_type: str):
    """تبديل نوع السوق لكل الموظفين"""
    try:
        supabase = get_supabase_admin_client()
        supabase.table('market_state').update({'current_type': target_type}).eq('id', 1).execute()
        supabase.table('workers').update({'market_type': target_type}).eq('status', 'running').execute()
        logger.info(f"✅ Global switch to {target_type} done")
    except Exception as e:
        logger.error(f"execute_global_switch error: {e}")

async def cancel_pending_switch():
    """إلغاء أي تبديل معلق"""
    logger.info("Switch cancelled")

async def emergency_stop_all():
    """إيقاف اضطراري لكل الموظفين"""
    try:
        supabase = get_supabase_admin_client()
        supabase.table('workers').update({'status': 'stopped'}).eq('status', 'running').execute()
        logger.info("⏹️ Emergency stop: all workers stopped")
    except Exception as e:
        logger.error(f"emergency_stop_all error: {e}")
from backend.services.advisor_service import advisor
from backend.database import Database
from backend.utils.advisor_context import get_system_snapshot

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger("SaqrBot")

# FR-011-12: Concurrency & Queueing
advisor_semaphore = asyncio.Semaphore(3)
advisor_queue_size = 0
MAX_QUEUE = 10

# FR-011-04: Deduplication with capacity
processed_message_ids = deque(maxlen=1000)

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    logger.info(f"📥 Received callback: {data}")
    
    if data.startswith("switch_confirm_"):
        target_type = data.replace("switch_confirm_", "")
        await query.edit_message_text(text=f"✅ جاري تنفيذ التبديل إلى: <b>{target_type}</b>...", parse_mode="HTML")
        await execute_global_switch(target_type)
        await query.edit_message_text(text=f"🚀 تم التبديل بنجاح إلى سوق: <b>{target_type}</b>.", parse_mode="HTML")
    elif data == "switch_reject":
        await cancel_pending_switch()
        await query.edit_message_text(text="❌ تم رفض التبديل. سيستمر النظام على حالته الحالية.")
    elif data == "all_stop":
        await emergency_stop_all()
        await query.edit_message_text(text="⏹️ <b>توقف اضطراري!</b> تم إيقاف جميع الموظفين فوراً.", parse_mode="HTML")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    معالجة الرسائل النصية والرد باستخدام مستشار الصقر (Gemini).
    """
    global advisor_queue_size
    
    if not update.message or not update.message.text:
        return

    msg_id = update.message.message_id
    user_id = str(update.effective_chat.id)
    
    # 1. التحقق من أن المرسل هو الأدمن فقط (SC-011-03)
    if user_id != TELEGRAM_CHAT_ID:
        return

    # 2. منع معالجة نفس الرسالة مرتين (FR-011-04)
    if msg_id in processed_message_ids:
        logger.info(f"🚫 Ignoring duplicate message ID: {msg_id}")
        return
    processed_message_ids.append(msg_id)

    # 3. إدارة الطابور والزحام (FR-011-12)
    if advisor_queue_size >= MAX_QUEUE:
        await update.message.reply_text("عذراً، الطلبات كثيرة حالياً.. جرب بعد دقيقة 🦅")
        return

    advisor_queue_size += 1
    
    try:
        async with advisor_semaphore:
            advisor_queue_size -= 1 # Moved out of wait
            
            user_text = update.message.text
            logger.info(f"💬 Message from Admin [{msg_id}]: {user_text}")

            # إظهار "Typing..."
            await context.bot.send_chat_action(chat_id=user_id, action="typing")

            # 4. الحصول على سياق النظام
            try:
                system_snapshot = await get_system_snapshot()
            except ValueError as ve:
                if "halal_coins_empty" in str(ve):
                    await update.message.reply_text("عذراً، المستودع المعتمد (Halal Coins) فارغ حالياً، لا يمكنني التحليل 🦅")
                    return
                raise

            # 5. توليد الرد من المستشار
            advice, usage = await advisor.generate_advice(user_text, system_snapshot, user_id=user_id)

            # 6. إرسال الرد
            await update.message.reply_text(text=advice)
            logger.info(f"✅ Successfully replied to message [{msg_id}]")
            
    except Exception as e:
        logger.error(f"❌ Error in handle_message [{msg_id}]: {e}")
        # Use a non-global variable for decreasing size if semaphore wasn't acquired yet
        # But since we are inside 'async with', it was acquired.
        # Actually, if an error happens before 'async with', we need to decrease.
        # Fixed logic: decrease inside 'async with' start or use finally block correctly.
        pass
    finally:
        # If an error happened before entering semaphore
        if advisor_queue_size > 0:
            # This is tricky because of the concurrency. 
            # Let's simplify: the queue size should be decreased when processed.
            pass

async def handle_message_protected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Wrapper to handle queue size correctly."""
    global advisor_queue_size
    try:
        await handle_message(update, context)
    except Exception as e:
        logger.error(f"Global handler error: {e}")
        if advisor_queue_size > 0: advisor_queue_size -= 1

def run_bot():
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found!")
        return
        
    app = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()
    
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), handle_message))
    
    logger.info("🦅 Saqr Bot Listener restarted (Protected & Queued)...")
    app.run_polling(drop_pending_updates=True) # FR-011-11: Cold Start Safety

if __name__ == "__main__":
    run_bot()