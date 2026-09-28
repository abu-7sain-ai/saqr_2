import logging
from typing import Dict, Any, Optional
import pandas as pd
import ta
from .base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class NoCodeStrategy(BaseStrategy):
    """
    استراتيجية بدون كود (No-Code Rule-Based Strategy).
    تأخذ قواعد محددة مسبقاً (مؤشرات ونسب) من المستخدم وتنفذها بدقة.
    """

    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(name="NoCodeStrategy", params=params)
        self.rules = self.params.get('rules', {})
        # في حال تم تمرير الإعدادات مباشرة من user_settings
        if not self.rules and 'nocode_rules' in self.params:
            self.rules = self.params['nocode_rules']
        elif not self.rules and 'parsed_rules' in self.params:
            self.rules = self.params['parsed_rules']

        self.entry_rules = self.rules.get('entry_rules', self.rules.get('entry', {}))
        self.exit_rules = self.rules.get('exit_rules', self.rules.get('exit', {}))
        raw_ema = self.entry_rules.get('ema_period')
        self.ema_period = int(raw_ema) if raw_ema is not None else 200

    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        حساب المؤشرات الفنية المشتركة + مؤشرات الاستراتيجية الخاصة.
        """
        df = super().calculate_indicators(df)
        
        # EMA
        ema_col = f'ema_{self.ema_period}'
        if ema_col not in df.columns and len(df) >= 5:
            df[ema_col] = df['close'].ewm(span=self.ema_period, adjust=False).mean()

        # Volume SMA
        if 'volume' in df.columns and len(df) >= 20:
            df['volume_sma20'] = df['volume'].rolling(window=20).mean()

        return df

    def should_enter(self, df: pd.DataFrame) -> bool:
        """
        تقييم شروط الدخول. جميع الشروط الفعالة يجب أن تتحقق.
        """
        if len(df) < 20:
            return False

        last_row = df.iloc[-1]
        prev_row = df.iloc[-2]
        
        # تأكد من وجود المؤشرات
        if 'rsi' not in last_row:
            df = self.calculate_indicators(df)
            last_row = df.iloc[-1]
            prev_row = df.iloc[-2]

        passed_checks = []

        # 1. RSI Condition
        rsi_cond = self.entry_rules.get('rsi_condition', 'none')
        if rsi_cond in ('below', 'oversold'):
            threshold = float(self.entry_rules.get('rsi_value') or 30)
            passed_checks.append(float(last_row['rsi']) <= threshold)
        elif rsi_cond in ('above', 'overbought'):
            threshold = float(self.entry_rules.get('rsi_value') or 70)
            passed_checks.append(float(last_row['rsi']) >= threshold)

        # 2. MACD Condition
        macd_cond = self.entry_rules.get('macd_condition', 'none')
        if macd_cond in ('cross_up', 'bullish_cross'):
            curr_diff = float(last_row.get('macd_diff', 0))
            prev_diff = float(prev_row.get('macd_diff', 0))
            passed_checks.append(prev_diff <= 0 and curr_diff > 0)
        elif macd_cond in ('above_signal', 'bullish'):
            curr_diff = float(last_row.get('macd_diff', 0))
            passed_checks.append(curr_diff > 0)

        # 3. EMA Trend Filter
        ema_cond = self.entry_rules.get('ema_condition', 'none')
        ema_col = f'ema_{self.ema_period}'
        if ema_cond in ('above', 'uptrend') and ema_col in last_row:
            passed_checks.append(float(last_row['close']) >= float(last_row[ema_col]))
        elif ema_cond in ('below', 'downtrend') and ema_col in last_row:
            passed_checks.append(float(last_row['close']) <= float(last_row[ema_col]))

        # 4. Bollinger Bands
        bb_cond = self.entry_rules.get('bb_condition', 'none')
        if bb_cond in ('touch_lower', 'lower_band'):
            passed_checks.append(float(last_row['close']) <= float(last_row['bb_low']))
        elif bb_cond in ('touch_upper', 'upper_band'):
            passed_checks.append(float(last_row['close']) >= float(last_row['bb_high']))

        # 5. Volume Filter
        if self.entry_rules.get('volume_filter') and 'volume_sma20' in last_row and 'volume' in last_row:
            passed_checks.append(float(last_row['volume']) >= float(last_row['volume_sma20']))

        if passed_checks and all(passed_checks):
            self.logger.info(f"🎯 NoCodeStrategy Entry condition matched! Price: {last_row['close']}, RSI: {last_row.get('rsi', 0):.2f}")
            return True

        return False

    def should_exit(self, df: pd.DataFrame, position: Dict[str, Any]) -> bool:
        """
        تقييم شروط الخروج (TP, SL, ومؤشرات الخروج).
        """
        if len(df) < 1:
            return False

        last_row = df.iloc[-1]
        entry_price = float(position.get('entry_price', 0))
        current_price = float(last_row['close'])

        if entry_price <= 0:
            return False

        pnl_pct = ((current_price - entry_price) / entry_price) * 100

        # 1. Take Profit %
        tp_val = self.exit_rules.get('tp_pct') or self.params.get('tpValue') or 0
        tp_pct = float(tp_val)
        if tp_pct > 0 and pnl_pct >= tp_pct:
            self.logger.info(f"🎯 NoCode Exit: TP Hit ({pnl_pct:.2f}% >= {tp_pct}%)")
            return True

        # 2. Stop Loss %
        sl_val = self.exit_rules.get('sl_pct') or self.params.get('slValue') or 0
        sl_pct = float(sl_val)
        if sl_pct > 0 and pnl_pct <= -sl_pct:
            self.logger.warning(f"🛑 NoCode Exit: SL Hit ({pnl_pct:.2f}% <= -{sl_pct}%)")
            return True

        # 3. Technical Exit — RSI Overbought
        rsi_cond = self.exit_rules.get('rsi_condition', 'none')
        if rsi_cond in ('above', 'overbought') and 'rsi' in last_row:
            threshold = float(self.exit_rules.get('rsi_value') or 70)
            if float(last_row['rsi']) >= threshold:
                self.logger.info(f"🛑 NoCode Exit: RSI Overbought ({last_row['rsi']:.2f} >= {threshold})")
                return True

        # 4. Technical Exit — MACD Cross Down
        macd_cond = self.exit_rules.get('macd_condition', 'none')
        if macd_cond in ('cross_down', 'bearish_cross') and len(df) >= 2:
            prev_row = df.iloc[-2]
            curr_diff = float(last_row.get('macd_diff', 0))
            prev_diff = float(prev_row.get('macd_diff', 0))
            if prev_diff >= 0 and curr_diff < 0:
                self.logger.info("🛑 NoCode Exit: MACD Cross Down")
                return True

        # 5. Technical Exit — Bollinger Upper Band Touch
        bb_cond = self.exit_rules.get('bb_condition', 'none')
        if bb_cond in ('touch_upper', 'upper_band') and 'bb_high' in last_row:
            if current_price >= float(last_row['bb_high']):
                self.logger.info("🛑 NoCode Exit: Upper BB reached")
                return True

        return False
