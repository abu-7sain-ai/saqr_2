import logging
import pandas as pd
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockLatestTradeRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from .base import BaseMarket
import asyncio
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

TIMEFRAME_MAP = {
    '1Min':  TimeFrame.Minute,
    '5Min':  TimeFrame.Minute,
    '15Min': TimeFrame.Minute,
    '1Hour': TimeFrame.Hour,
    '1Day':  TimeFrame.Day,
}

class AlpacaMarket(BaseMarket):
    def __init__(self, api_config: dict = None, is_paper: bool = True):
        super().__init__(api_config)
        self.is_paper = is_paper

        self.trading_client = TradingClient(
            api_key=self.control_key,
            secret_key=self.control_secret,
            paper=is_paper
        )
        self.data_client = StockHistoricalDataClient(
            api_key=self.control_key,
            secret_key=self.control_secret,
        )

    async def get_price(self, symbol: str) -> float:
        clean_symbol = symbol.replace("/", "")
        try:
            req = StockLatestTradeRequest(symbol_or_symbols=clean_symbol)
            trade = await asyncio.to_thread(self.data_client.get_stock_latest_trade, req)
            return float(trade[clean_symbol].price)
        except Exception as e:
            logger.error(f"Alpaca get_price error: {e}")
            raise

    async def buy(self, symbol: str, amount: float) -> dict:
        clean_symbol = symbol.replace("/", "")
        req = MarketOrderRequest(
            symbol=clean_symbol,
            notional=amount,
            side=OrderSide.BUY,
            time_in_force=TimeInForce.DAY
        )
        order = await asyncio.to_thread(self.trading_client.submit_order, req)
        return order.model_dump()

    async def sell(self, symbol: str, amount: float) -> dict:
        clean_symbol = symbol.replace("/", "")
        req = MarketOrderRequest(
            symbol=clean_symbol,
            notional=amount,
            side=OrderSide.SELL,
            time_in_force=TimeInForce.DAY
        )
        order = await asyncio.to_thread(self.trading_client.submit_order, req)
        return order.model_dump()

    async def get_balance(self) -> float:
        try:
            account = await asyncio.to_thread(self.trading_client.get_account)
            return float(account.cash)
        except Exception as e:
            logger.error(f"Alpaca get_balance error: {e}")
            return 0.0

    async def get_historical(self, symbol: str, interval: str = '1Hour', limit: int = 100) -> pd.DataFrame:
        clean_symbol = symbol.replace("/", "")
        try:
            tf = TIMEFRAME_MAP.get(interval, TimeFrame.Hour)
            end = datetime.utcnow()
            start = end - timedelta(days=max(limit // 24, 7))
            req = StockBarsRequest(
                symbol_or_symbols=clean_symbol,
                timeframe=tf,
                start=start,
                end=end,
                limit=limit
            )
            bars = await asyncio.to_thread(self.data_client.get_stock_bars, req)
            df = bars.df
            df = df.reset_index()
            return df
        except Exception as e:
            logger.error(f"Alpaca get_historical error: {e}")
            return pd.DataFrame()

    async def place_stop_loss(self, symbol: str, price: float, amount: float) -> dict:
        from alpaca.trading.requests import StopOrderRequest
        clean_symbol = symbol.replace("/", "")
        req = StopOrderRequest(
            symbol=clean_symbol,
            qty=amount,
            side=OrderSide.SELL,
            stop_price=price,
            time_in_force=TimeInForce.GTC
        )
        order = await asyncio.to_thread(self.trading_client.submit_order, req)
        return order.model_dump()

    async def test_connection(self) -> dict:
        results = {
            "watch": {"ok": False, "msg": ""},
            "control": {"ok": False, "msg": ""},
            "historical": {"ok": False, "msg": ""}
        }

        try:
            await self.get_balance()
            results["control"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["control"] = {"ok": False, "msg": str(e)}

        try:
            await self.get_price("AAPL")
            results["watch"] = {"ok": True, "msg": "متصل بنجاح"}
        except Exception as e:
            results["watch"] = {"ok": False, "msg": str(e)}

        try:
            df = await self.get_historical("AAPL", limit=1)
            if not df.empty:
                results["historical"] = {"ok": True, "msg": "متصل بنجاح"}
            else:
                results["historical"] = {"ok": False, "msg": "لم يتم استلام بيانات"}
        except Exception as e:
            results["historical"] = {"ok": False, "msg": str(e)}

        return results
