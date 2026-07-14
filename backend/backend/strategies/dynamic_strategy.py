from .base_strategy import BaseStrategy
import pandas as pd
from typing import Dict, Any

class DynamicStrategy(BaseStrategy):
    """
    استراتيجية "الجندي المستنسخ" (Cloned Worker).
    تعتمد كلياً على الإشارات الفنية المولدة من مطبخ الخبراء (Entry, TP, SL).
    """
    
    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(name="Dynamic Strategist", params=params)
        # استخراج الإشارة من المعاملات
        self.signal = self.params.get('expert_signal', {})
        
        # Safe entry price parsing
        entry_val = self.signal.get('entry', 0)
        try:
            self.entry_price = float(entry_val)
        except (ValueError, TypeError):
            self.entry_price = 0.0
            
        # Safe targets parsing
        targets_val = self.signal.get('targets', [])
        if not isinstance(targets_val, list):
            targets_val = [targets_val]
            
        self.targets = []
        for t in targets_val:
            try:
                self.targets.append(float(t))
            except (ValueError, TypeError):
                pass
                
        # Safe sl parsing
        sl_val = self.signal.get('sl', 0)
        try:
            self.sl_price = float(sl_val)
        except (ValueError, TypeError):
            self.sl_price = 0.0

    def should_enter(self, df: pd.DataFrame) -> bool:
        """
        يدخل الموظف إذا كان السعر الحالي حول سعر الدخول الموصى به (بهامش 0.2%).
        """
        if self.entry_price <= 0 or len(df) < 1:
            return False

        last_price = float(df.iloc[-1]['close'])
        
        # هامش السماح للدخول (مثلاً 0.2% من سعر الدخول)
        lower_bound = self.entry_price * 0.998
        upper_bound = self.entry_price * 1.002
        
        if lower_bound <= last_price <= upper_bound:
            self.logger.info(f"Dynamic Entry Signal Matched! Price: {last_price}, Target Entry: {self.entry_price}")
            return True
            
        return False

    def should_exit(self, df: pd.DataFrame, position: Dict[str, Any]) -> bool:
        """
        الخروج بناءً على أهداف الأمير أو وقف الخسارة الصارم.
        """
        if len(df) < 1:
            return False

        last_price = float(df.iloc[-1]['close'])
        
        # 1. التحقق من وقف الخسارة (أولوية قصوى)
        if last_price <= self.sl_price:
            self.logger.warning(f"Stop Loss Hit: {last_price} <= {self.sl_price}")
            return True

        # 2. التحقق من الأهداف (نخرج عند الهدف الأول مؤقتاً كأمان)
        if len(self.targets) > 0 and last_price >= self.targets[0]:
            self.logger.info(f"Target 1 Hit: {last_price} >= {self.targets[0]}")
            return True

        return False
