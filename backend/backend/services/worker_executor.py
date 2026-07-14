import os
import logging
import asyncio
from typing import Dict, Any, List
import pandas as pd
from datetime import datetime, timedelta, timezone
from ..strategies.prince_stable import PrinceStableStrategy
from ..strategies.dynamic_strategy import DynamicStrategy
from ..config import get_supabase_admin_client as get_supabase_client
from .exchange_service import get_market_instance

logger = logging.getLogger(__name__)

class WorkerExecutor:
    def __init__(self, worker_data: Dict[str, Any]):
        self.worker = worker_data
        self.worker_id = worker_data['id']
        self.market_id = worker_data.get('market_id')
        self.logger = logging.getLogger(f"Worker.{worker_data['name']}")
        
        user_settings = worker_data.get('user_settings', {})

        # Professional Hunter/Sniper Settings (read from user_settings falling back to database fields)
        self.is_hunter = user_settings.get('is_hunter', worker_data.get('is_hunter', True))
        
        # Concurrency mode: 'fixed_count' (limit trades to X) or 'percentage' (exposure limits)
        raw_concurrency = user_settings.get('concurrency_mode', 
                                            user_settings.get('maxOpenTradesType', 
                                            worker_data.get('concurrency_mode', 'fixed_count')))
        self.concurrency_mode = 'fixed_count' if raw_concurrency == 'limit' else raw_concurrency
            
        self.max_trades = int(user_settings.get('max_concurrent_trades', 
                              user_settings.get('maxOpenTradesValue', 
                              worker_data.get('max_concurrent_trades', 3))))
                              
        self.max_exposure_pct = float(user_settings.get('max_capital_exposure_pct', 
                                     user_settings.get('tradeSizingValue', 
                                     worker_data.get('max_capital_exposure_pct', 10.0))))
                                     
        self.selection_criteria = user_settings.get('selection_criteria', 
                                  user_settings.get('selectionCriteria', 
                                  worker_data.get('selection_criteria', 'success_rate')))

        # Market Instance (New Architecture)
        self.market = None
        self.market_type = 'crypto'
        self.is_paper = True
        self.consecutive_failures = 0
        self.market_direction = "neutral" # Default

        self._initialize_strategy()

    async def _initialize_market(self):
        """تجهيز كلاس السوق بناءً على المنصة المختارة"""
        try:
            # FIX: نستخدم admin client عشان يتخطى RLS ويقدر يقرأ market_apis
            from backend.config import get_supabase_admin_client
            supabase = get_supabase_admin_client()
            if self.market_id:
                # جلب بيانات السوق والـ APIs
                market_resp = supabase.table('markets').select('*, market_apis(*)').eq('id', self.market_id).execute()
                if market_resp.data:
                    market_data = market_resp.data[0]
                    self.market_type = market_data.get('type', 'crypto')
                    apis = market_data.get('market_apis', [])
                    
                    if apis:
                        api_config = apis[0]
                        # Paper أو Live بناءً على إعداد الموظف في user_settings
                        worker_type = self.worker.get('user_settings', {}).get('workerType', 'paper')
                        self.is_paper = (worker_type != 'live')
                        
                        self.market = await get_market_instance(
                            exchange=market_data['name'],
                            api_config=api_config,
                            is_paper=self.is_paper
                        )
                        mode = 'Paper' if self.is_paper else 'Live'
                        self.logger.info(f"✅ Market initialized: {market_data['name']} ({mode})")
        except Exception as e:
            self.logger.error(f"Failed to initialize market instance: {e}")

    def _initialize_strategy(self):
        settings = self.worker.get('user_settings', {})
        if 'expert_signal' in settings:
            self.strategy = DynamicStrategy(params={'expert_signal': settings['expert_signal']})
        elif self.worker.get('owner') == 'prince' and self.worker.get('market_type') == 'stable':
            self.strategy = PrinceStableStrategy()
        else:
            # FIX: fallback بدل None عشان الموظف ما يوقفش
            self.strategy = DynamicStrategy(params={})

    async def run(self):
        # 1. Initialize Market if not already done
        if not self.market:
            await self._initialize_market()
            
        if not self.strategy or not self.market:
            self.logger.warning(f"Worker {self.worker['name']} not ready.")
            return
        
        try:
            supabase = get_supabase_client()
            
            # 2. Check Global Market Environment (Soft Stop Guard)
            market_state_resp = supabase.table('market_state').select('current_type').eq('id', 1).execute()
            current_env = market_state_resp.data[0]['current_type'] if market_state_resp.data else 'stable'
            
            worker_market_type = self.worker.get('market_type', 'stable')
            is_env_match = (worker_market_type == current_env)
            
            if not is_env_match:
                self.logger.info(f"🛡️ Environment Mismatch: Market is {current_env}, Worker is {worker_market_type}. Safe Mode.")

            # 3. Load Whitelist & Leaders
            symbols = await self._get_market_symbols()
            
            # 4. MONITOR LEADERS (Direction Only)
            # تحديث اتجاه السوق بناءً على حركة العملات القيادية
            await self._update_market_direction(symbols["direction"])
            
            if self.market_direction == "bearish":
                self.logger.warning(f"📉 Market Direction is BEARISH. Skipping entry for all symbols.")
                # We still check exits for open positions
            
            # 5. Handle Active Trades (Exits)
            active_trades_resp = supabase.table('trades').select('*').eq('worker_id', self.worker_id).is_('exit_at', 'null').execute()
            active_trades = {t['pair']: t for t in active_trades_resp.data}

            for pair, trade in active_trades.items():
                df = await self.market.get_historical(pair, interval="1m", limit=100)
                if not df.empty:
                    # ✅ FIX: احسب المؤشرات الفنية قبل فحص الخروج لتفادي KeyError
                    df = self.strategy.calculate_indicators(df)
                    await self._check_exit(df, trade, pair)

            # 6. SCAN WHITELIST (Entry)
            # ندخل صفقات فقط إذا كان الاتجاه غير سلبي والبيئة مطابقة
            if is_env_match and self.market_direction != "bearish" and self._can_open_more_trades(len(active_trades)):
                tradeable_symbols = symbols["tradeable"]
                candidates = []

                # استخدام Gemini للحصول على إشارة AI مباشرة بدلاً من البوابات التقنية
                from backend.services.gemini_signal import fetch_gemini_signal
                # ✅ نمرر قائمة العملات المعتمدة ونوع السوق للـ Gemini Signal Engine
                signal = await fetch_gemini_signal(
                    active_symbols=list(active_trades.keys()),
                    worker_settings=self.worker.get('user_settings', {}),
                    tradeable_symbols=tradeable_symbols,
                    market_type=self.market_type
                )
                
                if signal:
                    symbol = signal['symbol']
                    if symbol not in active_trades:
                        df_1m = await self.market.get_historical(symbol, interval="1m", limit=100)
                        if not df_1m.empty:
                            # ✅ احسب المؤشرات الفنية للشموع لمنع KeyError في شروط الدخول/الخروج
                            df_1m = self.strategy.calculate_indicators(df_1m)
                            
                            # ✅ جلب نسبة النجاح التاريخية للمفاضلة
                            success_rate = 50.0
                            try:
                                from backend.services.pattern_matcher import pattern_matcher
                                last_row = df_1m.iloc[-1]
                                current_state = {
                                    "rsi": float(last_row.get('rsi', 50)),
                                    "trend": float(last_row.get('close', 0))
                                }
                                report = await pattern_matcher.get_quantitative_report(
                                    symbol=symbol,
                                    timeframe="15m",
                                    current_state=current_state
                                )
                                success_rate = float(report.get('discovery_stats', {}).get('success_rate', 50.0))
                            except Exception as pe:
                                self.logger.warning(f"Failed to fetch pattern matcher success rate for {symbol}: {pe}")
                            
                            candidates.append({
                                "symbol": symbol,
                                "df": df_1m,
                                "success_rate": success_rate
                            })

                # المفاضلة والتنفيذ بناءً على نسبة النجاح التاريخية (Tie-breaking)
                if candidates:
                    candidates.sort(key=lambda x: x['success_rate'], reverse=True)
                    
                    for cand in candidates:
                        if self._can_open_more_trades(len(active_trades)):
                            self.logger.info(f"🎯 Execution: Entering trade for candidate {cand['symbol']} (Success Rate: {cand['success_rate']}%)")
                            await self._check_enter(cand['df'], cand['symbol'])
                            active_trades[cand['symbol']] = True

        except Exception as e:
            self.logger.error(f"Error in Worker run: {e}")

    async def _update_market_direction(self, leader_symbols: List[str]):
        """
        يراقب العملات القيادية لتحديد اتجاه السوق.
        Bearish: لو أغلب القياديين تحت EMA 20 (على فريم 15 دقيقة)
        Bullish: لو أغلب القياديين فوق EMA 20
        """
        if not leader_symbols:
            self.market_direction = "neutral"
            return

        bullish_count = 0
        bearish_count = 0
        
        for symbol in leader_symbols:
            try:
                df = await self.market.get_historical(symbol, interval="15m", limit=50)
                if df.empty: continue
                
                ema_20 = df['close'].ewm(span=20, adjust=False).mean().iloc[-1]
                price = df['close'].iloc[-1]
                
                if price > ema_20: bullish_count += 1
                else: bearish_count += 1
            except: continue
            
        if bullish_count > bearish_count:
            self.market_direction = "bullish"
        elif bearish_count > bullish_count:
            self.market_direction = "bearish"
        else:
            self.market_direction = "neutral"
            
        self.logger.info(f"📊 Market Direction determined: {self.market_direction.upper()} (Leaders: {bullish_count} Up / {bearish_count} Down)")

    def _can_open_more_trades(self, current_count: int) -> bool:
        if self.concurrency_mode == 'fixed_count':
            if current_count >= self.max_trades: return False
        
        if self.concurrency_mode == 'percentage':
            current_cap = float(self.worker.get('current_capital', 1000))
            starting_cap = float(self.worker.get('starting_capital', 1000))
            exposure_pct = ((starting_cap - current_cap) / starting_cap) * 100
            if exposure_pct >= self.max_exposure_pct: return False
        
        return True

    async def _check_enter(self, df: pd.DataFrame, symbol: str):
        # Two-Layer Filter Check
        from .filter_engine import FilterEngine
        
        # Check news risk for Sniper (to pause it immediately on high news risk)
        is_sniper = (self.worker.get('owner') == 'sniper')
        
        if is_sniper:
            try:
                # Check news risk directly
                news_risk = FilterEngine.get_news_risk(symbol)
                if news_risk == "high":
                    self.logger.warning(f"🚨 CRITICAL NEWS: High news risk for {symbol} on CryptoPanic. Pausing Sniper worker immediately.")
                    # Update status in DB to paused
                    supabase = get_supabase_client()
                    supabase.table('workers').update({"status": "paused"}).eq('id', self.worker_id).execute()
                    
                    # Notify via Telegram
                    from backend.services.notifier import Notifier
                    asyncio.create_task(Notifier.send_telegram(f"🚨 خبر كارثي على CryptoPanic للمستودع {symbol} - تم إيقاف القناص فوراً."))
                    return
            except Exception as ne:
                self.logger.error(f"Error checking sniper news risk: {ne}")
        
        # 1. Layer 1 Check (Free)
        l1_passed = await FilterEngine.layer_1_check(symbol)
        if not l1_passed:
            self.logger.info(f"🚫 Entry Blocked: Layer 1 check failed for {symbol}.")
            return
            
        # 2. Layer 2 Check (AI - Paid)
        # Timeout 15s for Sniper
        timeout = 15.0 if is_sniper else None
        
        l2_passed = await FilterEngine.layer_2_check(symbol, df, timeout=timeout)
        if not l2_passed:
            self.logger.info(f"🚫 Entry Blocked: Layer 2 AI check failed for {symbol}.")
            return

        last_row = df.iloc[-1]
        price = float(last_row['close'])
        settings = self.worker.get('user_settings', {})
        
        # Capital Check
        available_cap = float(self.worker.get('current_capital', 1000))
        pending_withdraw = float(self.worker.get('pending_withdrawal_amount', 0))
        usable_cap = available_cap - pending_withdraw

        sizing_val = float(settings.get('tradeSizingValue', 10))
        order_value = sizing_val if settings.get('tradeSizingType') == 'fixed' else usable_cap * (sizing_val / 100)

        if order_value > usable_cap or order_value <= 0: return

        qty = order_value / price
        try:
            # 1. Place order on Exchange (Live/Paper)
            if self.market and not self.is_paper:
                # Buy Order
                await self.market.buy(symbol, qty)
                # Hard Stop Loss Order
                sl_val = float(settings.get('slValue', 2.0))
                sl_price = price * (1 - (sl_val / 100))
                await self.market.place_stop_loss(symbol, sl_price, qty)
                self.logger.info(f"✅ Order & Hard SL placed on Exchange for {symbol}")
            else:
                self.logger.info(f"✅ [Paper Mode] Mock order & SL placed locally for {symbol} at {price}")

            # 2. Record in DB
            supabase = get_supabase_client()
            trade_data = {
                "user_id": self.worker['user_id'],
                "worker_id": self.worker_id,
                "pair": symbol,
                "entry_price": price,
                "amount_actual": qty,
                "entry_at": datetime.now().isoformat(),
            }
            supabase.table('trades').insert(trade_data).execute()
            self._db_update_capital(available_cap - order_value)
            
            # امسح الكاش عشان الموظفين التانيين ما يفتحوش نفس العملة
            from backend.services.gemini_signal import invalidate_cache
            asyncio.create_task(invalidate_cache())
            
            from backend.services.notifier import Notifier
            asyncio.create_task(Notifier.notify_trade_entry(self.worker['name'], symbol, price))
        except Exception as e:
            self.logger.error(f"Entry execution failed for {symbol}: {e}")

    async def _check_exit(self, df: pd.DataFrame, position: Dict[str, Any], symbol: str):
        last_row = df.iloc[-1]
        exit_price = float(last_row['close'])
        entry_price = float(position['entry_price'])
        qty = float(position['amount_actual'])
        settings = self.worker.get('user_settings', {})
        
        pnl_pct = (exit_price - entry_price) / entry_price
        
        # 1. Strategy Exit
        if self.strategy.should_exit(df, position):
            await self._execute_exit(position, exit_price, qty, entry_price, "strategy_signal")
            return

        # 2. Hard TP/SL (Safety Net)
        tp = float(settings.get('tpValue', 5.0)) / 100
        sl = -float(settings.get('slValue', 2.0)) / 100

        if pnl_pct >= tp: await self._execute_exit(position, exit_price, qty, entry_price, "hard_tp")
        elif pnl_pct <= sl: await self._execute_exit(position, exit_price, qty, entry_price, "hard_sl")

    async def _execute_exit(self, position, exit_price, qty, entry_price, reason):
        pnl = (exit_price - entry_price) * qty
        try:
            # 1. Execute on Exchange
            if self.market and not self.is_paper:
                await self.market.sell(position['pair'], qty)
            else:
                self.logger.info(f"✅ [Paper Mode] Mock exit executed locally for {position['pair']} at {exit_price}")

            # 2. Update DB
            supabase = get_supabase_client()
            supabase.table('trades').update({
                "exit_price": exit_price, "exit_at": datetime.now().isoformat(),
                "result": pnl, "exit_type": reason
            }).eq('id', position['id']).execute()

            # Update Capital & Handle Liquidation (Sweeping)
            w_resp = supabase.table('workers').select('*').eq('id', self.worker_id).single().execute()
            if w_resp.data:
                worker = w_resp.data
                current_cap = float(worker['current_capital'])
                target_withdraw = float(worker.get('pending_withdrawal_amount', 0))
                already_withdrawn = float(worker.get('withdrawn_amount', 0))
                mode = worker.get('withdrawal_mode', 'aggressive')
                
                returned_equity = qty * exit_price
                
                # Check for buddy system transfer (Scenario 8 / Paired Bot System)
                buddy_id = worker.get('paired_with')
                has_transferred = False
                
                if buddy_id:
                    # Get the current global market state
                    market_state_resp = supabase.table('market_state').select('current_type').eq('id', 1).execute()
                    current_env = market_state_resp.data[0]['current_type'] if market_state_resp.data else 'stable'
                    
                    # If this worker's market type mismatches the current environment, transfer the equity to the buddy!
                    if worker['market_type'] != current_env:
                        buddy_resp = supabase.table('workers').select('*').eq('id', buddy_id).execute()
                        if buddy_resp.data:
                            buddy = buddy_resp.data[0]
                            buddy_current_cap = float(buddy['current_capital'] or 0)
                            new_buddy_cap = buddy_current_cap + returned_equity
                            
                            # Update buddy capital in database
                            supabase.table('workers').update({"current_capital": new_buddy_cap}).eq('id', buddy_id).execute()
                            self.logger.info(f"💸 Buddy System: Transferred ${returned_equity:.2f} from exited trade to paired worker '{buddy['name']}' ({buddy['market_type']})")
                            
                            # Notify via Telegram
                            from backend.services.notifier import Notifier
                            await Notifier.send_telegram(f"💸 <b>نظام الأصدقاء:</b> تم تحويل <b>${returned_equity:.2f}</b> من صفقة مقفلة على <b>{worker['name']}</b> إلى صديقه المقابل <b>{buddy['name']}</b> بسبب تغير حالة السوق.")
                            
                            has_transferred = True
                            
                if not has_transferred:
                    new_cap = current_cap + returned_equity
                    
                    # Check if we need to sweep funds
                    if target_withdraw > 0:
                        remaining_to_withdraw = target_withdraw
                        sweep_amount = 0
                        
                        if mode == 'aggressive':
                            # All returns (principal + profit) are candidates for sweeping
                            sweep_amount = returned_equity
                        elif mode == 'profit_only' and pnl > 0:
                            # Only net profit is swept
                            sweep_amount = pnl
                        
                        if sweep_amount > 0:
                            actual_sweep = min(sweep_amount, remaining_to_withdraw)
                            
                            new_cap -= actual_sweep
                            new_pending = target_withdraw - actual_sweep
                            new_withdrawn = already_withdrawn + actual_sweep
                            
                            # Update worker with liquidation progress
                            supabase.table('workers').update({
                                "current_capital": new_cap,
                                "pending_withdrawal_amount": new_pending,
                                "withdrawn_amount": new_withdrawn
                            }).eq('id', self.worker_id).execute()
                            
                            self.logger.info(f"🧹 Swept ${actual_sweep} into freed pool. Remaining target: ${new_pending}")
                        else:
                            self._db_update_capital(new_cap)
                    else:
                        self._db_update_capital(new_cap)
            
            from backend.services.notifier import Notifier
            asyncio.create_task(Notifier.notify_trade_exit(self.worker['name'], position['pair'], pnl, pnl >= 0))
        except Exception as e:
            self.logger.error(f"Exit execution failed: {e}")

    def _db_update_capital(self, new_cap: float):
        try:
            supabase = get_supabase_client()
            supabase.table('workers').update({"current_capital": new_cap}).eq('id', self.worker_id).execute()
        except Exception as e:
            self.logger.error(f"Capital update failed: {e}")

    async def _get_market_symbols(self) -> Dict[str, list]:
        try:
            supabase = get_supabase_client()
            # جلب القائمة البيضاء
            whitelist = supabase.table('whitelist').select('symbol').eq('market_id', self.market_id).eq('is_active', True).execute()
            # جلب قائمة القياديين
            leaders = supabase.table('market_leaders').select('symbol').eq('market_id', self.market_id).eq('is_active', True).execute()
            
            return {
                "tradeable": [s['symbol'] for s in whitelist.data],
                "direction": [s['symbol'] for s in leaders.data]
            }
        except Exception as e:
            self.logger.error(f"Error fetching symbols: {e}")
            return {"tradeable": [], "direction": []}