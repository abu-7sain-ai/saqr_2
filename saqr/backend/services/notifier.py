import httpx  # ✅ بدل requests — بيحل WinError 10060
import logging
import asyncio

logger = logging.getLogger("Notifier")

class TelegramTemplates:
    # 🔴 تنبيهات السوق
    MARKET_SWITCH = "⚠️ السوق تحوّل من {prev} إلى {curr}\nتم التبديل — ردّ خلال 5 دقائق"
    
    # 🔴 تنبيهات الصفقات
    TRADE_ENTRY = "✅ *دخول صفقة جديدة:*\n👤 الموظف: `{worker}`\n💰 الزوج: `{pair}`\n📈 السعر: `{price}`\n🏦 السيولة: `{liquidity}$`"
    TRADE_PROFIT = "💰 *خروج بربح (تيك بروفيت):*\n👤 الموظف: `{worker}`\n📉 الزوج: `{pair}`\n🎯 الربح: `+{amount}$` (%{pct})\n🏁 الحالة: صفقة ناجحة"
    TRADE_LOSS = "🛑 *خروج بخسارة (ستوب لوز):*\n👤 الموظف: `{worker}`\n📉 الزوج: `{pair}`\n💸 الخسارة: `-{amount}$` (%{pct})\n⚠️ الحالة: تفعيل وقف الخسارة"
    TRADE_TRIMMED = "⚖️ *تقليص سيولة آلي:*\n👤 الموظف: `{worker}` | `{pair}`\nالمطلوب: {req}$ | الفعلي: {actual}$\nالسبب: سيولة منخفضة في المحفظة\n📊 الصفقات المتبقية: {count}"
    
    # 🔴 تنبيهات الاجتماع
    SESSION_STARTED = "🚀 *انعقاد مجلس الحكماء:*\n🆔 الجلسة: `#{id}`\n🎯 الهدف: `{symbol}`\n⏳ جاري تحليل 10 سنوات من البيانات..."
    SESSION_READY = "✅ *اكتمال التحليل العلمي:*\n🆔 الجلسة: `#{id}`\n🎯 الهدف: `{symbol}`\n💡 النتيجة: تم إصدار {count} استراتيجيات معتمدة."
    SESSION_BACKTEST_FAIL = "❌ *فشل الاختبار التاريخي (Backtest):*\n🆔 الجلسة: `#{id}`\n⚠️ السبب: {reason}\n(لم تجتز أي استراتيجية معايير الـ 7+3 سنوات الصارمة)"
    SESSION_WALKFORWARD_FAIL = "❌ فشل Walk-Forward\nالسبب: {reason}\nتبي جلسة جديدة؟"
    GROK_TIMEOUT_TRADE = "⚠️ Grok ما يرد — وقت صفقة\nفرصة [{pair}] تنتظر"
    GROK_TIMEOUT_SESSION = "⚠️ Grok ما يرد — وقت اجتماع\nالاجتماع متوقف"
    EXPERT_TIMEOUT = "⚠️ [{expert}] ما يرد — وقت اجتماع\nالاجتماع متوقف"
    
    # 🔴 تنبيهات الموظفين
    WORKER_STARTED = "✅ موظف جديد شغّال: [{name}]"
    WORKER_STOPPED = "⚠️ [{name}] توقف فجأة — سبب غير معروف"
    CRITICAL_NEWS = "🚨 خبر كارثي على CryptoPanic\nتم إيقاف كل الموظفين فوراً"
    
    # 🔴 تنبيهات الرصيد
    DEPOSIT_DETECTED = "✅ أُضيف {amount}$ للرصيد المحرر\n(إيداع خارجي اكتُشف)"
    WITHDRAWAL_DETECTED = "⚠️ رصيد Binance نقص {amount}$\nUSDT الحر المتاح: {free}$\nمن وين أخصم؟"
    
    # 🔴 تنبيهات السيرفر
    SERVER_RECOVERED = "⚠️ السيرفر وقع — رجع الآن\nتم مزامنة {count} صفقة"
    
    # 🔵 للأدمن
    ADMIN_NEW_USER = "🆕 مستخدم جديد ينتظر الموافقة:\nالاسم: [{name}]\nالإيميل: [{email}]\nالموبايل: [{mobile}]"
    ADMIN_API_LOW = "⚠️ تنبيه: {api}\nالرصيد الحالي: {amount}$\nمتوقع ينتهي خلال: {days} يوم"
    ADMIN_API_FAILED = "⚠️ [{api}] فشل 3 مرات متتالية\nتم إيقاف الموظفين — تحقق فوراً"
    ADMIN_BINANCE_CHANGE = "⚠️ Binance API تغيّر\nالكود القديم لا يشتغل — تحقق فوراً"

class Notifier:
    """
    Handles Telegram notifications for both Owners and Admins.
    ✅ Fixed: استخدام httpx بدل requests لحل WinError 10060
    """

    @staticmethod
    async def send_telegram(text, buttons=None, is_admin=False):
        """
        Main entry point for sending notifications.
        """
        from backend.database import Database
        settings = Database.get_telegram_settings()
        if settings:
            return await Notifier.send_telegram_msg(settings['token'], settings['chat_id'], text, buttons)
        return False

    @staticmethod
    async def send_telegram_msg(token, chat_id, text, buttons=None):
        if not token or not chat_id:
            logger.warning("Telegram settings missing.")
            return False

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "Markdown"
        }

        if buttons:
            payload["reply_markup"] = {
                "inline_keyboard": [buttons] if isinstance(buttons[0], dict) else buttons
            }

        try:
            # ✅ httpx async — بيحل WinError 10060 نهائياً
            # timeout=8 → لو Telegram بطيء، بيتجاهل ومش بيكرش السيستم
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(url, json=payload)
            return response.status_code == 200

        except httpx.TimeoutException:
            # ✅ timeout بيتم بصمت — مش بيكرش kitchen_check
            logger.warning("Telegram send timeout (8s) — skipped silently")
            return False
        except httpx.ConnectError:
            # ✅ WinError 10060 بيتعامل معاه هنا
            logger.warning("Telegram connect error (WinError 10060 fixed) — skipped")
            return False
        except Exception as e:
            logger.error(f"Telegram error: {e}")
            return False

    @staticmethod
    async def notify_market_switch(prev, curr):
        text = TelegramTemplates.MARKET_SWITCH.format(prev=prev, curr=curr)
        buttons = [
            {"text": "✅ موافق", "callback_data": "market_ok"},
            {"text": "❌ رفض", "callback_data": "market_no"},
            {"text": "⏹️ إيقاف الكل", "callback_data": "market_stop_all"}
        ]
        return await Notifier.send_telegram(text, buttons=buttons)

    @staticmethod
    async def notify_trade_entry(worker, pair, price, liquidity=0):
        text = TelegramTemplates.TRADE_ENTRY.format(worker=worker, pair=pair, price=price, liquidity=liquidity)
        return await Notifier.send_telegram(text)

    @staticmethod
    async def notify_trade_exit(worker, pair, amount, pct=0, is_profit=True):
        template = TelegramTemplates.TRADE_PROFIT if is_profit else TelegramTemplates.TRADE_LOSS
        text = template.format(worker=worker, pair=pair, amount=abs(amount), pct=round(pct, 2))
        return await Notifier.send_telegram(text)

    @staticmethod
    async def notify_session_start(session_id, symbol):
        text = TelegramTemplates.SESSION_STARTED.format(id=session_id[:8], symbol=symbol)
        return await Notifier.send_telegram(text)

    @staticmethod
    async def notify_session_ready(session_id, symbol, count):
        text = TelegramTemplates.SESSION_READY.format(id=session_id[:8], symbol=symbol, count=count)
        return await Notifier.send_telegram(text)

    @staticmethod
    async def notify_session_fail(session_id, reason):
        text = TelegramTemplates.SESSION_BACKTEST_FAIL.format(id=session_id[:8], reason=reason)
        return await Notifier.send_telegram(text)

    @staticmethod
    async def notify_admin_new_user(name, email, mobile):
        text = TelegramTemplates.ADMIN_NEW_USER.format(name=name, email=email, mobile=mobile)
        buttons = [
            {"text": "✅ قبول", "callback_data": "user_approve"},
            {"text": "❌ رفض", "callback_data": "user_reject"}
        ]
        return await Notifier.send_telegram(text, buttons=buttons, is_admin=True)