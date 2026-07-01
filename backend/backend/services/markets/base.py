import logging
import pandas as pd
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class BaseMarket(ABC):
    def __init__(self, api_config: dict = None):
        self.api_config = api_config or {}
        self.watch_key = self.api_config.get('watch_api_key')
        self.watch_secret = self.api_config.get('watch_api_secret')
        self.control_key = self.api_config.get('control_api_key')
        self.control_secret = self.api_config.get('control_api_secret')
        self.historical_key = self.api_config.get('historical_api_key')
        self.historical_secret = self.api_config.get('historical_api_secret')
        
    @abstractmethod
    async def get_price(self, symbol: str) -> float:
        """جلب السعر الحالي لرمز معين"""
        pass

    @abstractmethod
    async def buy(self, symbol: str, amount: float) -> dict:
        """تنفيذ عملية شراء"""
        pass

    @abstractmethod
    async def sell(self, symbol: str, amount: float) -> dict:
        """تنفيذ عملية بيع"""
        pass

    @abstractmethod
    async def get_balance(self) -> float:
        """جلب الرصيد المتاح للتحكم"""
        pass

    @abstractmethod
    async def get_historical(self, symbol: str, interval: str, limit: int = 100) -> pd.DataFrame:
        """جلب البيانات التاريخية للباكتيست"""
        pass

    @abstractmethod
    async def place_stop_loss(self, symbol: str, price: float, amount: float) -> dict:
        """وضع أمر وقف خسارة على المنصة"""
        pass

    async def test_connection(self) -> dict:
        """
        اختبار القنوات الثلاث (المتابعة، التحكم، التاريخي).
        يجب تنفيذ المنطق في الكلاسات المشتقة.
        """
        results = {
            "watch": {"ok": False, "msg": "غير منفذ"},
            "control": {"ok": False, "msg": "غير منفذ"},
            "historical": {"ok": False, "msg": "غير منفذ"}
        }
        return results
