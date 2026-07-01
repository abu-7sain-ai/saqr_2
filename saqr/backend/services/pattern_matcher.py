"""
Saqr (الصقر) — Quantitative Pattern Matcher
محرك مطابقة الأنماط الكمية مع خاصية الـ Walk-Forward Validation (7+3)
"""

import logging
import pandas as pd
import asyncio
import numpy as np
from datetime import datetime, timedelta, timezone
from backend.database import Database

logger = logging.getLogger("PatternMatcher")

class PatternMatcher:
    def __init__(self):
        from backend.services.historical_data import historical_engine
        self.engine = historical_engine
        self.db = Database()

    async def get_quantitative_report(self, symbol="BTC/USDT", timeframe="4h", current_state=None):
        logger.info(f"🔍 Generating Quantitative Report for {symbol} ({timeframe})...")
        
        import time
        t0 = time.time()
        
        # ✅ FIX: load 10 years to match the full historical pool
        # years=10 but engine loads what's available in DB
        df_ohlcv = await self.engine.load_ohlcv(symbol, timeframe, years=10)
        df_fg = await self.engine.load_fear_greed(years=10)
        
        logger.info(f"Data loaded in {time.time()-t0:.1f}s: {len(df_ohlcv)} OHLCV rows, {len(df_fg)} FG rows")
        
        if df_ohlcv.empty:
            empty = self._empty_stats()
            return {
                "symbol": symbol,
                "current_state": current_state,
                "discovery_stats": empty,
                "discovery_stats_memory": empty,
                "walk_forward_stats": empty,
                "internal_memory": {"failed_matches": 0, "total_internal_warnings": 0},
                "stability": 0,
                "summary": "لا توجد بيانات تاريخية كافية في قاعدة البيانات (يرجى عمل Seed أولاً)",
                "error": "no_historical_data"
            }

        df = self._merge_data(df_ohlcv, df_fg)
        
        now_utc = datetime.now(timezone.utc)
        split_date = now_utc - timedelta(days=3*365)
        
        discovery_pool = df[df['timestamp'] < split_date].copy()
        validation_pool = df[df['timestamp'] >= split_date].copy()
        
        print(f"DEBUG: Data Split - Discovery: {len(discovery_pool)} | Validation: {len(validation_pool)}")

        print("DEBUG: Searching discovery pool...")
        discovery_results = await asyncio.to_thread(
            self._find_matches, discovery_pool, current_state, label="Discovery (7Y)"
        )
        
        print("DEBUG: Searching validation pool...")
        validation_results = await asyncio.to_thread(
            self._find_matches, validation_pool, current_state, label="Walk-Forward (3Y)"
        )
        
        stability_score = self._calculate_stability(discovery_results, validation_results)
        internal_memory = await self._get_internal_memory(symbol, current_state)
        memory_adjusted_stats = self._apply_memory_penalty(discovery_results, internal_memory)

        return {
            "symbol": symbol,
            "current_state": current_state,
            "discovery_stats": discovery_results,
            "discovery_stats_memory": memory_adjusted_stats,
            "walk_forward_stats": validation_results,
            "internal_memory": internal_memory,
            "stability": stability_score,
            "summary": self._generate_summary(discovery_results, validation_results, stability_score, internal_memory)
        }

    def _merge_data(self, df_ohlcv, df_fg):
        df_ohlcv['fear_greed'] = 50 
        df_ohlcv['btc_dom'] = 50.0
        
        if not df_fg.empty:
            df_ohlcv['date_key'] = df_ohlcv['timestamp'].dt.date
            df_fg['date_key'] = df_fg['date']
            df_ohlcv = pd.merge(df_ohlcv, df_fg[['date_key', 'value']], on='date_key', how='left')
            df_ohlcv = df_ohlcv.rename(columns={'value': 'fear_greed_val'})
            df_ohlcv['fear_greed'] = df_ohlcv['fear_greed_val'].ffill().fillna(50)
            
        return df_ohlcv

    def _find_matches(self, df, current, tolerance=0.15, label="Pool"):
        if df.empty or not current:
            return self._empty_stats()

        curr_rsi = current.get('rsi', 50)
        curr_fg = current.get('fear_greed', 50)
        curr_dom = current.get('btc_dominance', 52.0)
        
        rsi_min, rsi_max = curr_rsi * (1 - tolerance), curr_rsi * (1 + tolerance)
        fg_min, fg_max = curr_fg - 10, curr_fg + 10
        dom_min, dom_max = curr_dom - 2, curr_dom + 2
        
        rsi_col = 'rsi_14' if 'rsi_14' in df.columns else ('rsi' if 'rsi' in df.columns else None)
        if rsi_col is None:
            logger.warning("No RSI column found in DataFrame — skipping RSI filter")
            return self._empty_stats()
        
        mask = (df[rsi_col] >= rsi_min) & (df[rsi_col] <= rsi_max)
        if 'fear_greed' in df.columns:
            mask = mask & (df['fear_greed'] >= fg_min) & (df['fear_greed'] <= fg_max)
        if 'btc_dom' in df.columns:
            mask = mask & (df['btc_dom'] >= dom_min) & (df['btc_dom'] <= dom_max)
        
        matches = df[mask].copy()
        
        if len(matches) == 0:
            return self._empty_stats()

        # ✅ FIX: reset index to avoid iloc/loc mismatch issues
        df_reset = df.reset_index(drop=True)
        matches_reset = df_reset[df_reset[rsi_col].between(rsi_min, rsi_max)]

        results = []
        for i in matches_reset.index:
            if i + 48 >= len(df_reset):
                continue
                
            entry_price = df_reset.loc[i, 'close']
            future_window = df_reset.loc[i+1:i+48]
            
            max_high = future_window['high'].max()
            min_low = future_window['low'].min()
            
            target_price = entry_price * 1.025
            reached_target = future_window[future_window['high'] >= target_price]
            
            duration_hours = 0
            if not reached_target.empty:
                duration_hours = (reached_target.index[0] - i) * 4
            
            success = (max_high >= target_price) and (min_low > entry_price * 0.985)
            
            results.append({
                "success": success,
                "profit": ((max_high - entry_price) / entry_price) * 100,
                "loss": ((min_low - entry_price) / entry_price) * 100,
                "duration": duration_hours if success else 0
            })
            
        if not results:
            return self._empty_stats()

        res_df = pd.DataFrame(results)
        winning_trades = res_df[res_df['success']]
        losing_trades = res_df[~res_df['success']]
        
        return {
            "sample_size": len(res_df),
            "success_rate": round((res_df['success'].sum() / len(res_df)) * 100, 1),
            "avg_profit": round(winning_trades['profit'].mean(), 2) if not winning_trades.empty else 0,
            "avg_loss": round(losing_trades['loss'].mean(), 2) if not losing_trades.empty else 0,
            "avg_duration": round(winning_trades['duration'].mean(), 1) if not winning_trades.empty else 0,
            "period_label": label
        }

    async def _get_internal_memory(self, symbol, current):
        if not current:
            return {"failed_matches": 0, "total_internal": 0}
        
        try:
            from backend.config import get_supabase_admin_client
            supabase = get_supabase_admin_client()
            
            trades_resp = supabase.table("trades").select("*").eq("pair", symbol).lt("result", 0).limit(20).execute()
            failed_count = len(trades_resp.data) if trades_resp.data else 0
            
            sessions_resp = supabase.table("kitchen_sessions").select("*").eq("symbol", symbol).eq("status", "failed").limit(10).execute()
            failed_sessions = len(sessions_resp.data) if sessions_resp.data else 0

            return {
                "failed_matches": failed_count,
                "failed_sessions": failed_sessions,
                "total_internal_warnings": failed_count + failed_sessions,
                "memory_date": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error fetching internal memory: {e}")
            return {"failed_matches": 0, "failed_sessions": 0, "total_internal_warnings": 0}

    def _apply_memory_penalty(self, stats, memory):
        new_stats = stats.copy()
        warnings = memory.get('total_internal_warnings', 0)
        
        if warnings > 0:
            penalty = min(warnings * 2, 20)
            new_stats['success_rate'] = max(0, new_stats['success_rate'] - penalty)
            new_stats['memory_penalty_applied'] = penalty
            new_stats['warning_level'] = "High" if penalty > 10 else "Medium"
        
        return new_stats

    def _empty_stats(self):
        return {"sample_size": 0, "success_rate": 0, "avg_profit": 0, "avg_loss": 0, "avg_duration": 0, "period_label": "N/A"}

    def _calculate_stability(self, d_stats, v_stats):
        if d_stats['sample_size'] == 0 or v_stats['sample_size'] == 0:
            return 0
        diff = abs(d_stats['success_rate'] - v_stats['success_rate'])
        return round(max(0, 100 - (diff * 2)), 1)

    def _generate_summary(self, d, v, stability, memory):
        if d['sample_size'] == 0: 
            return "لا توجد توليفات مشابهة كافية في البيانات التاريخية المتاحة."
        
        msg = f"تحليل التوليفة (Cluster): وجدنا {d['sample_size']} حالة تاريخية مشابهة للوضع الحالي."
        msg += f"\n- نسبة النجاح: {d['success_rate']}%"
        
        penalty = d.get('memory_penalty_applied', 0)
        if penalty > 0:
            msg += f"\n⚠️ تنبيه الذاكرة: تم خفض التوقعات بنسبة {penalty}% بسبب إخفاقات داخلية سابقة."
        
        msg += f"\n- متوسط الربح التاريخي: +{d['avg_profit']}%"
        msg += f"\n- متوسط الوقت للهدف: {d['avg_duration']} ساعة"
        
        if stability > 80:
            msg += "\n✅ النمط يظهر ثباتاً ممتازاً في الـ 3 سنوات الأخيرة."
        
        warnings = memory.get('total_internal_warnings', 0)
        if warnings > 5:
            msg += f"\n🔴 تحذير: سجلنا {warnings} إخفاقات في ظروف مشابهة. توخَّ الحذر."
            
        return msg

# Singleton
pattern_matcher = PatternMatcher()