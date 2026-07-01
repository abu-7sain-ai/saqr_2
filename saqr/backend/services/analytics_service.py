import psutil
import os
from datetime import datetime, timedelta
from backend.database import Database
import logging

logger = logging.getLogger("AnalyticsService")

class AnalyticsService:
    @staticmethod
    def get_performance_summary(user_id):
        """
        Calculates top-level summary metrics.
        """
        db = Database()
        workers = db.get_workers(user_id)
        trades = db.get_user_trades(user_id)
        
        total_pl = sum(float(t.get('result', 0)) for t in trades if t.get('exit_at'))
        
        # Best/Worst Worker
        worker_pl = {}
        for t in trades:
            w_id = t.get('worker_id')
            if w_id not in worker_pl: worker_pl[w_id] = 0
            worker_pl[w_id] += float(t.get('result', 0))
        
        best_worker_id = max(worker_pl, key=worker_pl.get) if worker_pl else None
        worst_worker_id = min(worker_pl, key=worker_pl.get) if worker_pl else None
        
        best_worker = next((w for w in workers if w['id'] == best_worker_id), None) if best_worker_id else None
        worst_worker = next((w for w in workers if w['id'] == worst_worker_id), None) if worst_worker_id else None
        
        win_rate = (len([t for t in trades if float(t.get('result', 0)) > 0]) / len(trades) * 100) if trades else 0
        
        return {
            "total_pl": total_pl,
            "total_pl_pct": 0, # Need total capital to calculate
            "best_worker": {
                "name": best_worker['name'] if best_worker else 'N/A',
                "pl": worker_pl.get(best_worker_id, 0)
            },
            "worst_worker": {
                "name": worst_worker['name'] if worst_worker else 'N/A',
                "pl": worker_pl.get(worst_worker_id, 0)
            },
            "trades_count": len(trades),
            "win_rate": round(win_rate, 1)
        }

    @staticmethod
    def get_monthly_matrix(user_id, months_limit=6):
        """
        Returns a matrix of Worker x Month profit.
        """
        db = Database()
        trades = db.get_user_trades(user_id)
        workers = db.get_workers(user_id)
        
        # Determine last X months
        now = datetime.now()
        months = []
        for i in range(months_limit):
            m = (now - timedelta(days=i*30)).strftime("%Y-%m")
            months.append(m)
        months.reverse()
        
        matrix = []
        for w in workers:
            row = {"worker_name": w['name'], "data": {}}
            for m in months:
                m_trades = [t for t in trades if t.get('worker_id') == w['id'] and t.get('exit_at') and t['exit_at'].startswith(m)]
                m_pl = sum(float(t.get('result', 0)) for t in m_trades)
                row["data"][m] = m_pl
            matrix.append(row)
            
        return {"months": months, "matrix": matrix}

    @staticmethod
    def get_system_health():
        """
        Returns CPU, RAM, and system stats.
        """
        try:
            return {
                "cpu_usage": psutil.cpu_percent(),
                "ram_usage": psutil.virtual_memory().percent,
                "active_workers": 0, # Need to fetch from DB
                "network_load": 0,   # Mock or fetch
                "api_calls_min": 0   # Mock or fetch
            }
        except:
            return {"cpu_usage": 0, "ram_usage": 0, "active_workers": 0}

    @staticmethod
    def get_token_dashboard(user_id):
        """
        Fetches token usage from activity_logs.
        """
        db = Database()
        # Fetch logs for the last 30 days
        limit_date = (datetime.now() - timedelta(days=30)).isoformat()
        # Using a custom query or filtering activity_logs
        # For now, we mock based on common usage
        return {
            "deepseek": {"tokens": 120000, "cost": 0.50},
            "grok": {"tokens": 85000, "cost": 1.20},
            "claude": {"tokens": 45000, "cost": 2.10},
            "total_cost": 3.80
        }
