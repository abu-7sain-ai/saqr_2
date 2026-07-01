from .base_strategy import BaseStrategy
import pandas as pd

class PrinceStableStrategy(BaseStrategy):
    """
    استراتيجية "جندي مشاة الأمير" (Stable Prince).
    تتميز بالحذر الشديد والدخول فقط في الاتجاهات الواضحة والآمنة.
    """
    
    def __init__(self, params: dict = None):
        super().__init__(name="Prince Infantry", params=params)
        self.stop_loss_pct = 0.01  # 1% حسب الدستور
        self.target_profit_pct = 0.02 # 2% هدف أولي

    def should_enter(self, df: pd.DataFrame) -> bool:
        """
        شروط الدخول (Long Only):
        1. شمعة مغلقة.
        2. تقاطع MACD إيجابي (macd > macd_signal).
        3. RSI بين 45 و 60 (منطقة قوة بدون تشبع).
        4. السعر فوق المتوسط المتحرك لـ Bollinger (bb_mid).
        """
        if len(df) < 2:
            return False

        last_row = df.iloc[-1]
        prev_row = df.iloc[-2]

        # 1. MACD Cross Up
        macd_cross = (prev_row['macd'] <= prev_row['macd_signal']) and \
                     (last_row['macd'] > last_row['macd_signal'])
        
        # 2. RSI Range
        rsi_ok = 45 < last_row['rsi'] < 60
        
        # 3. Bollinger Context
        above_mid = last_row['close'] > last_row['bb_mid']

        if macd_cross and rsi_ok and above_mid:
            self.logger.info(f"Signal Found: MACD Cross({last_row['macd']:.2f}), RSI({last_row['rsi']:.2f})")
            return True
            
        return False

    def should_exit(self, df: pd.DataFrame, position: dict) -> bool:
        """
        شروط الخروج:
        1. ضرب الـ Stop Loss (1%).
        2. تقاطع MACD سلبي (عكس الدخول).
        3. RSI اخترق الـ 70 (تشبع شراء).
        """
        last_row = df.iloc[-1]
        entry_price = float(position['entry_price'])
        current_price = last_row['close']
        
        # حساب الربح/الخسارة الحالي
        pnl_pct = (current_price - entry_price) / entry_price

        # 1. Stop Loss
        if pnl_pct <= -self.stop_loss_pct:
            return True

        # 2. Take Profit (RSI overbought)
        if last_row['rsi'] > 70:
            return True
            
        # 3. MACD Cross Down
        if last_row['macd'] < last_row['macd_signal']:
            return True

        return False
