import pandas as pd
import numpy as np

class BacktestEngine:
    """
    Enhanced Backtester for validating AI-generated strategies.
    Simulates price action to calculate ROI, Drawdown, and Confidence.
    """

    @staticmethod
    def run_backtest(ohlc_data, entry_price, targets, sl_price):
        """
        Simulates the trade using the most recent OHLC data.
        """
        if not ohlc_data or len(ohlc_data) < 5:
            return {"error": "Insufficient data for testing"}

        df = pd.DataFrame(ohlc_data)
        
        hit_target = False
        hit_sl = False
        peak_roi = 0
        max_drawdown = 0
        
        target_1 = targets[0] if (isinstance(targets, list) and len(targets) > 0) else entry_price * 1.01
        
        # We simulate candle by candle to see what happens first
        for _, row in df.iterrows():
            # Calculate drawdown relative to entry
            if entry_price > 0:
                current_low_roi = ((row['low'] - entry_price) / entry_price) * 100
                max_drawdown = min(max_drawdown, current_low_roi)

                # Track peak ROI
                current_high_roi = ((row['high'] - entry_price) / entry_price) * 100
                peak_roi = max(peak_roi, current_high_roi)
            
            # Check for Stop Loss first (Safety First)
            if row['low'] <= sl_price:
                hit_sl = True
                break
            
            # Check for Target 1
            if row['high'] >= target_1:
                hit_target = True
                break

        # Algorithm Confidence calculation (Mocked logic for now)
        confidence = 0
        if hit_target: confidence += 40
        if not hit_sl: confidence += 30
        if peak_roi > 2: confidence += 20
        
        result = {
            "success": hit_target,
            "failure": hit_sl,
            "peak_roi": round(peak_roi, 2),
            "max_drawdown": round(abs(max_drawdown), 2),
            "status": "نجاح (هدف 1)" if hit_target else ("فشل (وقف خسارة)" if hit_sl else "قيد الانتظار"),
            "algorithm_confidence": min(confidence + 10, 99)
        }
        
        return result

    @classmethod
    def validate_strategies(cls, market_data, strategies_json):
        """
        Loops through strategies produced by the Prince and runs backtests.
        """
        ohlc = market_data.get('ohlc_4h_summary', [])
        results = []
        
        # prince outputs a dict with a 'strategies' list
        strategy_list = strategies_json.get('strategies', [])
        if not strategy_list and isinstance(strategies_json, list):
            strategy_list = strategies_json # Fallback if AI skips the wrapper
            
        for strat in strategy_list:
            try:
                entry = float(strat.get('entry', 0))
                targets = [float(t) for t in strat.get('targets', [])]
                sl = float(strat.get('sl', 0))
                
                if entry > 0:
                    report = cls.run_backtest(ohlc, entry, targets, sl)
                    strat['backtest_report'] = report
                    results.append(strat)
            except Exception as e:
                print(f"Error backtesting strategy {strat.get('name')}: {e}")
                
        return {
            "summary": strategies_json.get('summary', "تم توليد الاستراتيجيات بنجاح."),
            "strategies": results
        }
