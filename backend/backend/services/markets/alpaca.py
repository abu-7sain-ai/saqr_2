import logging
import pandas as pd
from alpaca_trade_api.rest import REST
from .base import BaseMarket
import asyncio

logger = logging.getLogger(__name__)

class AlpacaMarket(BaseMarket):
    def __init__(self, api_config: dict = None, is_paper: bool = True):
        super().__init__(api_config)
        self.is_paper = is_paper
        base_url = "https://paper-api.alpaca.markets" if is_paper else "https://api.alpaca.markets"
        
        self.client = REST(
            key_id=self.control_key,
            secret_key=self.control_secret,
            base_url=base_url
        )

    async def get_price(self, symbol: str) -> float:
        # Alpaca symbols don't usually have /
        clean_symbol = symbol.replace("/", "")
        try:
            trade = await asyncio.to_thread(self.client.get_latest_trade, clean_symbol)
            return float(trade.price)
        except Exception as e:
            logger.error(f"Alpaca get_price error: {e}")
            raise

    async def buy(self, symbol: str, amount: float) -> dict:
        clean_symbol = symbol.replace("/", "")
        order = await asyncio.to_thread(
            self.client.submit_order,
            symbol=clean_symbol,
            notional=amount,
            side='buy',
            type='market',
            time_in_force='day'
        )
        return order._raw

    async def sell(self, symbol: str, amount: float) -> dict:
        clean_symbol = symbol.replace("/", "")
        order = await asyncio.to_thread(
            self.client.submit_order,
            symbol=clean_symbol,
            notional=amount,
            side='sell',
            type='market',
            time_in_force='day'
        )
        return order._raw

    async def get_balance(self) -> float:
        try:
            account = await asyncio.to_thread(self.client.get_account)
            return float(account.cash)
        except Exception as e:
            logger.error(f"Alpaca get_balance error: {e}")
            return 0.0

    async def get_historical(self, symbol: str, interval: str = '1Hour', limit: int = 100) -> pd.DataFrame:
        clean_symbol = symbol.replace("/", "")
        try:
            bars = await asyncio.to_thread(
                self.client.get_bars,
                clean_symbol,
                interval,
                limit=limit
            )
            df = bars.df
            # Reset index to have timestamp as a column
            df = df.reset_index()
            return df
        except Exception as e:
            logger.error(f"Alpaca get_historical error: {e}")
            return pd.DataFrame()

    async def place_stop_loss(self, symbol: str, price: float, amount: float) -> dict:
        clean_symbol = symbol.replace("/", "")
        order = await asyncio.to_thread(
            self.client.submit_order,
            symbol=clean_symbol,
            qty=amount,
            side='sell',
            type='stop',
            stop_price=price,
            time_in_force='gtc'
        )
        return order._raw

    async def test_connection(self) -> dict:
        results = {
            "watch": {"ok": False, "msg": ""},
            "control": {"ok": False, "msg": ""},
            "historical": {"ok": False, "msg": ""}
        }
        
        # 1. Test Control (Account)
        try:
            await self.get_balance()
            results["control"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["control"] = {"ok": False, "msg": str(e)}

        # 2. Test Watch
        try:
            # We use a common stock like AAPL for testing
            await self.get_price("AAPL")
            results["watch"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["watch"] = {"ok": False, "msg": str(e)}

        # 3. Test Historical
        try:
            df = await self.get_historical("AAPL", limit=1)
            if not df.empty:
                results["historical"] = {"ok": True, "msg": "متصل بنجاح"}
            else:
                results["historical"] = {"ok": False, "msg": "لم يتم استلام بيانات"}
        except Exception as e:
            results["historical"] = {"ok": False, "msg": str(e)}

        return results
