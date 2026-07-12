import ccxt.async_support as ccxt
import pandas as pd
import logging
from .base import BaseMarket

logger = logging.getLogger(__name__)

class BinanceMarket(BaseMarket):
    def __init__(self, api_config: dict = None, is_paper: bool = False):
        super().__init__(api_config)
        self.is_paper = is_paper
        
        # Initialize CCXT clients for different roles if keys are available
        # Control Client (Main)
        self.client = ccxt.binance({
            'apiKey': self.control_key,
            'secret': self.control_secret,
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })
        if self.is_paper:
            self.client.set_sandbox_mode(True)

        # Public Client for public endpoints
        self.public_client = ccxt.binance({
            'enableRateLimit': True,
            'options': {'defaultType': 'spot'}
        })

    async def close(self):
        await self.client.close()
        await self.public_client.close()

    async def get_price(self, symbol: str) -> float:
        try:
            # ✅ FIX: public_client — لا يحتاج API keys
            ticker = await self.public_client.fetch_ticker(symbol)
            return float(ticker['last'])
        except Exception as e:
            logger.error(f"Binance get_price error: {e}")
            raise

    async def buy(self, symbol: str, amount: float) -> dict:
        # FIX: amount هنا = qty (كمية العملة) محسوبة من worker_executor
        # create_market_buy_order(symbol, amount) = شراء (amount) وحدة من العملة
        # الحد الأدنى على Binance عادةً 10 USDT — تأكد إن order_value >= 10
        return await self.client.create_market_buy_order(symbol, amount)

    async def sell(self, symbol: str, amount: float) -> dict:
        return await self.client.create_market_sell_order(symbol, amount)

    async def get_balance(self) -> float:
        try:
            balance = await self.client.fetch_balance()
            return float(balance.get('USDT', {}).get('free', 0.0))
        except Exception as e:
            logger.error(f"Binance get_balance error: {e}")
            return 0.0

    async def get_historical(self, symbol: str, interval: str = '15m', limit: int = 100) -> pd.DataFrame:
        try:
            # ✅ FIX: public_client — لا يحتاج API keys، بيستخدم /api/v3/klines مش /sapi
            ohlcv = await self.public_client.fetch_ohlcv(symbol, timeframe=interval, limit=limit)
            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
            return df
        except Exception as e:
            logger.error(f"Binance get_historical error: {e}")
            return pd.DataFrame()

    async def place_stop_loss(self, symbol: str, price: float, amount: float) -> dict:
        return await self.client.create_order(
            symbol=symbol,
            type='STOP_LOSS_LIMIT',
            side='sell',
            amount=amount,
            price=price * 0.99, # Execute slightly lower to ensure fill
            params={'stopPrice': price}
        )

    async def test_connection(self) -> dict:
        results = {
            "watch": {"ok": False, "msg": ""},
            "control": {"ok": False, "msg": ""},
            "historical": {"ok": False, "msg": ""}
        }
        
        # 1. Test Control (Account access)
        try:
            await self.get_balance()
            results["control"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["control"] = {"ok": False, "msg": str(e)}

        # 2. Test Watch (Public data access)
        try:
            await self.get_price("BTC/USDT")
            results["watch"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["watch"] = {"ok": False, "msg": str(e)}

        # 3. Test Historical (Public data access)
        try:
            df = await self.get_historical("BTC/USDT", limit=1)
            if not df.empty:
                results["historical"] = {"ok": True, "msg": "متصل بنجاح"}
            else:
                results["historical"] = {"ok": False, "msg": "لم يتم استلام بيانات"}
        except Exception as e:
            results["historical"] = {"ok": False, "msg": str(e)}

        return results