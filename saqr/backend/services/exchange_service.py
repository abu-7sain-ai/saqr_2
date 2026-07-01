import logging
from .markets.binance import BinanceMarket
from .markets.alpaca import AlpacaMarket

logger = logging.getLogger("ExchangeService")

async def get_market_instance(exchange: str, api_config: dict = None, is_paper: bool = False):
    """
    مصنع (Factory) لجلب مثيل السوق المناسب.
    """
    exchange = exchange.lower().strip()
    if exchange in ('binance', 'باينانس', 'بايننس'):
        return BinanceMarket(api_config, is_paper)
    elif exchange in ('alpaca', 'الباكا'):
        return AlpacaMarket(api_config, is_paper)
    else:
        raise ValueError(f"المنصة {exchange} غير مدعومة حالياً.")

async def test_connection(exchange: str, key: str, secret: str, is_paper: bool = False) -> dict:
    """
    المدخل الرئيسي لاختبار الاتصال باستخدام النظام الجديد.
    يدعم اختبار القنوات الثلاث (Watch, Control, Historical).
    """
    try:
        # نقوم بتهيئة إعدادات افتراضية للاختبار (استخدام نفس المفاتيح للكل مؤقتاً عند الفحص الأول)
        api_config = {
            'control_api_key': key,
            'control_api_secret': secret,
            'watch_api_key': key,
            'watch_api_secret': secret,
            'historical_api_key': key,
            'historical_api_secret': secret
        }
        
        market = await get_market_instance(exchange, api_config, is_paper)
        results = await market.test_connection()
        
        # إذا كان أي قناة ناجحة، نعتبر الاختبار ناجحاً كلياً لكن مع تفاصيل
        success = any(r['ok'] for r in results.values())
        
        # لغرض التوافق مع الفرونت إند الحالي الذي يتوقع success و message
        message = " | ".join([f"{k}: {'✅' if v['ok'] else '❌'}" for k, v in results.items()])
        
        # Close connection if needed (like in ccxt)
        if hasattr(market, 'close'):
            await market.close()
            
        return {
            "success": success,
            "message": message,
            "results": results
        }
    except Exception as e:
        logger.error(f"Test connection error: {e}")
        return {"success": False, "message": f"خطأ تقني: {str(e)}"}

async def get_total_cash(exchange: str, key: str, secret: str, is_paper: bool = True) -> float:
    """
    جلب الرصيد النقدي المتاح من المنصة باستخدام الكلاس الجديد.
    """
    try:
        api_config = {'control_api_key': key, 'control_api_secret': secret}
        market = await get_market_instance(exchange, api_config, is_paper)
        balance = await market.get_balance()
        if hasattr(market, 'close'): await market.close()
        return balance
    except Exception as e:
        logger.error(f"Failed to fetch total cash from {exchange}: {e}")
        return 0.0