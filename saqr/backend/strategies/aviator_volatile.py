import pandas as pd
import ta
from typing import Dict, Any
from .base_strategy import BaseStrategy

class AviatorVolatileStrategy(BaseStrategy):
    """
    استراتيجية الجندي الطيار - مصممة للأسواق المتوترة (Volatile).
    تعتمد على اصطياد الارتدادات السريعة (Mean Reversion) من حدود البولنجر باوند.
    """
    
    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(name="AviatorVolatile", params=params)
        # إعدادات المخاطرة الخاصة بالطيار
        self.stop_loss_pct = self.params.get('stop_loss_pct', 0.015)  # 1.5% 
        self.take_profit_pct = self.params.get('take_profit_pct', 0.02) # 2%

    def should_enter(self, df: pd.DataFrame) -> bool:
        """
        منطق الدخول:
        1. السعر يكسر أو يلمس الحد السفلي للبولنجر باوند (Oversold).
        2. مؤشر RSI أقل من 30 (تأكيد التشبع البيعي).
        3. مؤشر ATR أكبر من المتوسط (تأكيد وجود تقلب عالي).
        """
        if len(df) < 20: return False

        last_row = df.iloc[-1]
        prev_row = df.iloc[-2]

        # 1. Bollinger Band Rebound
        is_below_bb = last_row['close'] <= last_row['bb_low']
        
        # 2. RSI Oversold
        is_rsi_oversold = last_row['rsi'] < 35
        
        # 3. Volatility Check (High ATR)
        avg_atr = df['atr'].rolling(window=14).mean().iloc[-1]
        is_volatile = last_row['atr'] > (avg_atr * 1.1)

        if is_below_bb and is_rsi_oversold and is_volatile:
            self.logger.info(f"Aviator Entry Signal: Price={last_row['close']}, RSI={last_row['rsi']}")
            return True

        return False

    def should_exit(self, df: pd.DataFrame, position: Dict[str, Any]) -> bool:
        """
        منطق الخروج:
        1. ملامسة خط المنتصف للبولنجر باوند (العودة للمتوسط).
        2. الوصول للهدف الربحي (Take Profit).
        3. تفعيل وقف الخسارة (Stop Loss).
        """
        last_row = df.iloc[-1]
        entry_price = float(position['entry_price'])
        current_price = last_row['close']
        
        # 1. Mean Reversion Exit (Middle Band)
        if current_price >= last_row['bb_mid']:
            self.logger.info("Aviator Exit: Price reached Middle BB (Mean Reversion)")
            return True

        # 2. Risk Management Exits
        profit_pct = (current_price - entry_price) / entry_price
        
        if profit_pct >= self.take_profit_pct:
            self.logger.info(f"Aviator Exit: Take Profit reached ({profit_pct:.2%})")
            return True
            
        if profit_pct <= -self.stop_loss_pct:
            self.logger.info(f"Aviator Exit: Stop Loss triggered ({profit_pct:.2%})")
            return True

        return False
