import pandas as pd
import ta
from typing import Dict, Any, List
import logging

class BaseStrategy:
    """
    الأساس البرمجي لجميع استراتيجيات الصقر.
    يحتوي على الوظائف المشتركة مثل حساب المؤشرات وجلب البيانات.
    """
    
    def __init__(self, name: str, params: Dict[str, Any] = None):
        self.name = name
        self.params = params or {}
        self.logger = logging.getLogger(f"Strategy.{name}")

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        حساب المؤشرات الفنية المشتركة لجميع الموظفين.
        """
        # MACD
        macd = ta.trend.MACD(close=df['close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()

        # RSI
        df['rsi'] = ta.momentum.RSIIndicator(close=df['close']).rsi()

        # Bollinger Bands
        bb = ta.volatility.BollingerBands(close=df['close'])
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_mid'] = bb.bollinger_mavg()

        # ATR (Volatility)
        df['atr'] = ta.volatility.AverageTrueRange(
            high=df['high'], low=df['low'], close=df['close']
        ).average_true_range()

        return df

    def should_enter(self, df: pd.DataFrame) -> bool:
        """
        يجب تطبيقها في الكلاسات الفرعية.
        """
        raise NotImplementedError("Each strategy must implement should_enter")

    def should_exit(self, df: pd.DataFrame, position: Dict[str, Any]) -> bool:
        """
        يجب تطبيقها في الكلاسات الفرعية.
        """
        raise NotImplementedError("Each strategy must implement should_exit")
