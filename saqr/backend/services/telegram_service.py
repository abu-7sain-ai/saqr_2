import logging
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup
from backend.config import TELEGRAM_BOT_TOKEN

logger = logging.getLogger(__name__)

async def send_interactive_market_alert(chat_id: str, status: str, metrics: dict):
    """
    إرسال تنبيه تفاعلي يحتوي على أزرار للموافقة أو الرفض على تبديل السوق.
    """
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.warning("TELEGRAM_BOT_TOKEN or chat_id is missing.")
        return
        
    try:
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        
        icon = "🟢" if status == "stable" else "🔴"
        status_ar = "مستقر" if status == "stable" else "متوتر"
        
        msg = (
            f"🦅 <b>تنبيه من الصقر: تغير حالة السوق</b>\n\n"
            f"الحالة المكتشفة: {icon} <b>{status_ar}</b>\n"
            f"<i>ملاحظة: سيتم التبديل تلقائياً خلال 5 دقائق في حال عدم الرد.</i>\n\n"
            f"<b>البيانات الحالية والمخاطرة:</b>\n"
        )
        for pair, data in metrics.items():
            atr_m = data.get('atr_mult', 1.0)
            vol_m = data.get('vol_mult', 1.0)
            risk_color = "🔴" if atr_m > 1.5 or vol_m > 2 else "🟡"
            
            msg += f"• {pair}:\n"
            msg += f"   - تذبذب (ATR): <b>{atr_m}x</b> المعدل {risk_color}\n"
            msg += f"   - سيولة (Vol): <b>{vol_m}x</b> المعدل\n\n"
            
        msg += f"⚠️ <b>الإجراء الضمني:</b> سيتم تحويل كافة الموظفين إلى وضع <b>{status_ar}</b>."
            
        # إنشاء الأزرار
        keyboard = [
            [
                InlineKeyboardButton("✅ موافق (تنفيذ الآن)", callback_data=f"switch_confirm_{status}"),
                InlineKeyboardButton("❌ رفض (إلغاء)", callback_data="switch_reject")
            ],
            [
                InlineKeyboardButton("⏹️ إيقاف جميع الموظفين", callback_data="all_stop")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await bot.send_message(
            chat_id=chat_id, 
            text=msg, 
            parse_mode="HTML",
            reply_markup=reply_markup
        )
    except Exception as e:
        logger.error(f"Failed to send interactive telegram message: {e}")

async def send_market_alert(chat_id: str, text: str):
    """إرسال رسالة نصية بسيطة (مثل التأكيدات)"""
    if not TELEGRAM_BOT_TOKEN or not chat_id: return
    try:
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        await bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
    except Exception as e:
        logger.error(f"Failed to send simple telegram alert: {e}")
