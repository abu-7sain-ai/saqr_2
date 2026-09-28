import logging
from typing import Dict, Any, List, Optional
import pandas as pd
from datetime import datetime, timezone
from .base_strategy import BaseStrategy

logger = logging.getLogger(__name__)

class WebhookStrategy(BaseStrategy):
    """
    استراتيجية الاستقبال السلبي (Passive Webhook Strategy).
    تنتظر وتنفذ إشارات التداول القادمة من TradingView أو أي مصدر خارجي عبر Webhook.
    """

    def __init__(self, params: Dict[str, Any] = None):
        super().__init__(name="WebhookStrategy", params=params)
        self.pending_signals: List[Dict[str, Any]] = []
        self.secret_token: Optional[str] = self.params.get('secret_token')

    def inject_signal(self, signal: Dict[str, Any]):
        """
        حقن إشارة واردة من الـ Webhook.
        الصيغة المتوقعة:
        {
            "action": "buy" | "sell" | "close",
            "symbol": "BTC/USDT" أو "BTCUSDT",
            "price": 65000.0,
            "comment": "RSI Oversold Alert"
        }
        """
        signal_copy = dict(signal)
        signal_copy['received_at'] = datetime.now(timezone.utc).isoformat()
        
        # توحيد صيغة الزوج إن وجد
        raw_symbol = signal_copy.get('symbol', '')
        if raw_symbol and '/' not in raw_symbol and raw_symbol.endswith('USDT'):
            base = raw_symbol[:-4]
            signal_copy['symbol'] = f"{base}/USDT"

        self.pending_signals.append(signal_copy)
        self.logger.info(f"📥 Webhook signal injected: {signal_copy.get('action')} for {signal_copy.get('symbol')}")

    def should_enter(self, df: pd.DataFrame, symbol: Optional[str] = None) -> bool:
        """
        فحص إذا كانت هناك إشارة شراء معلقة مطابقة.
        """
        for i, sig in enumerate(self.pending_signals):
            action = str(sig.get('action', '')).lower()
            if action in ('buy', 'long'):
                sig_symbol = sig.get('symbol')
                if not symbol or not sig_symbol or sig_symbol == symbol:
                    consumed = self.pending_signals.pop(i)
                    self.logger.info(f"✅ Webhook BUY signal matched and consumed for {symbol or sig_symbol}")
                    return True
        return False

    def should_exit(self, df: pd.DataFrame, position: Dict[str, Any]) -> bool:
        """
        فحص إذا كانت هناك إشارة بيع أو إغلاق معلقة لهذه الصفقة.
        """
        pos_symbol = position.get('pair')
        for i, sig in enumerate(self.pending_signals):
            action = str(sig.get('action', '')).lower()
            if action in ('sell', 'close', 'exit', 'short'):
                sig_symbol = sig.get('symbol')
                if not pos_symbol or not sig_symbol or sig_symbol == pos_symbol:
                    consumed = self.pending_signals.pop(i)
                    self.logger.info(f"🛑 Webhook SELL/EXIT signal matched and consumed for {pos_symbol}")
                    return True
        return False
