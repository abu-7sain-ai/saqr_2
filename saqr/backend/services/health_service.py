import time
import httpx
import logging
import asyncio
from typing import Dict, Any
from ..config import SUPABASE_URL, get_supabase_admin_client

logger = logging.getLogger("HealthService")

class HealthService:
    """
    خدمة مراقبة صحة النظام - وظيفة المستشار الإدارية.
    تقوم بقياس زمن الاستجابة (Latency) والتأكد من استقرار "المبنى التقني".
    """
    
    @staticmethod
    async def check_api_latency() -> Dict[str, Any]:
        """
        قياس سرعة استجابة API (مثل بينانس).
        ✅ FIX: رفعنا الـ timeout لـ 20 ثانية عشان يتحمل الشبكات البطيئة
        المعيار: < 3000ms (stable)، 3-20s (degraded)، timeout (critical_slow)
        """
        url = "https://api.binance.com/api/v3/ping"
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.get(url)
                latency = (time.time() - start_time) * 1000  # ms

                if latency < 3000:
                    status = "stable"
                elif latency < 20000:
                    status = "degraded"
                else:
                    status = "critical_slow"

                return {"latency": round(latency, 2), "status": status, "online": True}
        except Exception as e:
            logger.error(f"API Health Check Failed: {e}")
            return {"latency": 0, "status": "down", "online": False}

    @staticmethod
    async def check_db_health() -> Dict[str, Any]:
        """التأكد من أن قاعدة بيانات Supabase مستقرة"""
        start_time = time.time()
        try:
            supabase = get_supabase_admin_client()
            # تجربة استعلام بسيط جداً
            supabase.table('profiles').select('count', count='exact').limit(1).execute()
            latency = (time.time() - start_time) * 1000
            return {"latency": round(latency, 2), "status": "healthy", "online": True}
        except Exception as e:
            logger.error(f"DB Health Check Failed: {e}")
            return {"latency": 0, "status": "disconnected", "online": False}

    @classmethod
    async def get_full_health_report(cls) -> Dict[str, Any]:
        """تقرير شامل للنظام يرفعه المستشار"""
        api_health, db_health = await asyncio.gather(
            cls.check_api_latency(),
            cls.check_db_health()
        )
        
        # تقييم عام للنظام
        overall_status = "Excellent" if api_health['online'] and db_health['online'] else "Degraded"
        
        return {
            "overall": overall_status,
            "api": api_health,
            "database": db_health,
            "timestamp": time.time()
        }

if __name__ == "__main__":
    # اختبار سريع
    async def test():
        report = await HealthService.get_full_health_report()
        print(f"Health Report: {report}")
    asyncio.run(test())