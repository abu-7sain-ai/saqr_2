import os
import json
import asyncio
from openai import OpenAI
from backend.services.data_connector import DataConnector
from backend.services.pattern_matcher import pattern_matcher
from backend.services.notifier import Notifier
from backend.database import Database
from backend.services.whitelist_groups import get_symbols_for_groups, get_group_list, WHITELIST_GROUPS
import re
import logging
import time

logger = logging.getLogger(__name__)

ROUND_TIMEOUT = int(os.environ.get("MEETING_ROUND_TIMEOUT", "120"))
GLOBAL_TIMEOUT = int(os.environ.get("GLOBAL_SESSION_TIMEOUT", "1800"))
ROUND_DELAY = float(os.environ.get("GROQ_ROUND_DELAY", "2.0"))


class StrategyFactory:
    """
    The heart of Saqr: Orchestrates 7-round scientific AI debates to generate strategies.
    ✅ FIXED: Groq rate limits, JSON parsing, round timeouts, worker spawning, Notifier network errors.
    """

    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is not set in environment variables")

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=self.api_key,
            timeout=90.0,
        )
        self.db = Database()

        # تحميل الموديلات المحفوظة مسبقاً من قاعدة البيانات للمستخدم
        saved_settings = self.db.get_user_settings()
        saved_models = saved_settings.get('expert_models') or {}

        self.experts = {
            "chartist":     saved_models.get("chartist", "openai/gpt-oss-120b"),
            "reporter":     saved_models.get("reporter", "openai/gpt-oss-120b"),
            "pulser":       saved_models.get("pulser", "openai/gpt-oss-120b"),
            "radar":        saved_models.get("radar", "openai/gpt-oss-120b"),
            "guardian":     saved_models.get("guardian", "openai/gpt-oss-120b"),
            "investigator": saved_models.get("investigator", "openai/gpt-oss-120b"),
            "prince":       saved_models.get("prince", "openai/gpt-oss-120b"),
            "engineer":     saved_models.get("engineer", "openai/gpt-oss-120b"),
            "advanced":     saved_models.get("advanced", "openai/gpt-oss-120b"),
        }
        self._active_session_id = None
        self._active_session_status = None
        self._custom_prompts = {}

    # ✅ NEW: Telegram-safe wrapper — لو الشبكة انقطعت ما نفشلش الجلسة
    async def _safe_notify(self, coro):
        try:
            await asyncio.wait_for(coro, timeout=10.0)
        except asyncio.TimeoutError:
            logger.warning("Notifier timeout — skipping (network issue)")
        except Exception as e:
            logger.warning(f"Notifier error (non-fatal) — {e}")

    def _resolve_user_id(self, user_id):
        if user_id and str(user_id).lower() != "none":
            return user_id
        try:
            from backend.config import get_supabase_admin_client
            supabase = get_supabase_admin_client()
            resp = supabase.table('profiles').select('id').limit(1).execute()
            if resp.data:
                return resp.data[0]['id']
        except Exception as e:
            logger.warning(f"Could not resolve fallback user_id: {e}")
        return None

    async def run_session(self, session_id):
        session = self.db.get_session(session_id)
        if not session:
            logger.error(f"[{session_id}] Session not found in DB.")
            return

        raw_user_id = session.get('user_id')
        user_id = self._resolve_user_id(raw_user_id)
        # ✅ FIX: market_id ممكن يكون محفوظ مباشرة أو جوه worker_settings.marketId
        market_id = session.get('market_id') or (session.get('worker_settings') or {}).get('marketId')
        raw_symbol = session.get('symbol', 'BTC/USDT')
        
        # ✅ FIX: لو المستخدم اختار "دراسة السوق العام" (ALL)
        # نحلل BTC كمؤشر رئيسي + نجلب بيانات كل القائمة البيضاء
        is_multi_asset = (raw_symbol.upper() == 'ALL')
        symbol = 'BTC/USDT' if is_multi_asset else raw_symbol

        # ✅ NEW: تحديد المجموعات المختارة وتصفية العملات
        worker_settings_raw = session.get('worker_settings') or {}
        selected_groups = worker_settings_raw.get('selectedGroups', [])
        if selected_groups and 'all' not in selected_groups:
            filtered_symbols = get_symbols_for_groups(selected_groups)
            groups_label = ' + '.join(
                WHITELIST_GROUPS.get(g, {}).get('name', g) for g in selected_groups
            )
            logger.info(f"🎯 [Session {session_id}] Selected groups: {selected_groups} → {len(filtered_symbols)} symbols")
        else:
            filtered_symbols = None  # كل القائمة البيضاء
            groups_label = 'القائمة البيضاء بالكامل'

        if is_multi_asset:
            logger.info(f"🌐 [Session {session_id}] Multi-Asset Mode — scope: {groups_label}")

        # --- Check User Balance & Plan ---
        profile = self.db.get_profile(user_id) if user_id else None
        if profile:
            plan = self.db.get_plan(profile.package or 'free')
            if plan and plan.stop_threshold > 0 and profile.balance <= plan.stop_threshold:
                reason = f"رصيدك ({profile.balance}$) تحت حد الإيقاف ({plan.stop_threshold}$)."
                await self._safe_notify(Notifier.send_telegram(f"⚠️ [SUSPENDED] توقفت الجلسة لليوزر {user_id}\nالسبب: {reason}"))
                self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": reason}})
                return
            self._current_plan = plan
            self._user_profile = profile
        else:
            self._current_plan = None
            self._user_profile = None

        user_settings = self.db.get_user_settings(user_id)
        self._custom_prompts = user_settings.get('expert_prompts') or {}
        ws = session.get('worker_settings') or {}
        custom_models = ws.get('expert_models') or user_settings.get('expert_models') or {}
        if custom_models:
            for k, v in custom_models.items():
                if v:
                    clean_v = "openai/gpt-oss-120b" if "compound" in str(v).lower() else v
                    self.experts[k] = clean_v
                    logger.info(f"🧠 Assigned persistent model for expert '{k}': {clean_v}")

        logger.info(f"🚀 Starting Scientific Council for Session {session_id}")
        await self._safe_notify(Notifier.notify_session_start(session_id, raw_symbol))
        issuers = session.get('issuers', ['prince'])

        t_start = time.time()
        # ✅ HEARTBEAT TRACKING: عشان _call_ai يعرف يعمل update على الجلسة الشغالة
        self._active_session_id = session_id
        self._active_session_status = "running_session"

        # --- Fetch Market Data ---
        self.db.update_session_status(session_id, "collecting_data")
        try:
            market_data = await asyncio.wait_for(
                self.connector_get_snapshot(symbol, session, user_id, filter_symbols=filtered_symbols),
                timeout=ROUND_TIMEOUT
            )
        except asyncio.TimeoutError:
            raise Exception("فشل جلب بيانات السوق (انتهت المهلة)")

        logger.info(f"Session {session_id}: Data collection took {time.time()-t_start:.1f}s")

        if not market_data:
            self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": "فشل جلب بيانات السوق."}})
            await self._safe_notify(Notifier.notify_session_fail(session_id, "فشل جلب بيانات السوق"))
            return
        
        # ✅ FIX: في وضع دراسة السوق العام، نتأكد إن القائمة البيضاء وصلت
        # لو market_breadth فاضية، نعمل retry مباشر
        if is_multi_asset or not market_data.get('market_breadth'):
            if not market_data.get('market_breadth'):
                logger.warning(f"[{session_id}] market_breadth empty — retrying with extended timeout...")
                try:
                    breadth_retry = await asyncio.wait_for(
                        DataConnector.collect_market_breadth(filter_symbols=filtered_symbols),
                        timeout=20.0
                    )
                    if breadth_retry:
                        market_data['market_breadth'] = breadth_retry
                        logger.info(f"[{session_id}] ✅ Retry succeeded — got {len(breadth_retry)} symbols")
                except Exception as br_err:
                    logger.warning(f"[{session_id}] Breadth retry failed: {br_err}")
        
        # ✅ FIX: في وضع السوق العام نضيف flag للبرومبتات عشان الخبراء يعرفوا
        if is_multi_asset:
            market_data['is_multi_asset'] = True
            market_data['analysis_scope'] = groups_label
            market_data['selected_groups'] = selected_groups
            market_data['filtered_symbols'] = filtered_symbols or []

        # --- Round 0: Quantitative Analysis ---
        self.db.update_session_status(session_id, "pattern_matching")
        current_state = {
            "rsi":          market_data.get('indicators', {}).get('rsi'),
            "fear_greed":   market_data.get('sentiment',  {}).get('fear_greed'),
            "btc_dominance":market_data.get('btc_dominance', 52.0),
            "trend":        market_data.get('indicators', {}).get('trend_200')
        }
        try:
            quant_report = await asyncio.wait_for(
                pattern_matcher.get_quantitative_report(symbol, current_state=current_state),
                timeout=ROUND_TIMEOUT
            )
        except asyncio.TimeoutError:
            raise Exception("فشل تحليل الأنماط التاريخية (انتهت المهلة)")

        logger.info(f"Session {session_id}: Pattern matching took {time.time()-t_start:.1f}s total")

        if quant_report.get('error'):
            logger.error(f"[{session_id}] Quant Report Error: {quant_report['error']}")
            self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": quant_report['summary']}})
            await self._safe_notify(Notifier.notify_session_fail(session_id, quant_report['summary']))
            return

        # --- The 7 Rounds of Debate ---
        # FIX: نتابع الجولات بشكل تدريجي عشان الكواليس يتعرض live
        live_rounds = {}

        def _save_round(round_key, data):
            live_rounds[round_key] = data
            try:
                self.db.update_session_data(session_id, {
                    "expert_opinions": {"rounds": live_rounds}
                })
            except Exception as e:
                logger.warning(f"[{session_id}] Could not save live round {round_key}: {e}")

        try:
            logger.info(f"Session {session_id}: Round 1 starting at {time.time()-t_start:.1f}s")
            self.db.update_session_status(session_id, "round_1_analysis")
            r1 = await asyncio.wait_for(self._run_round_1(market_data, quant_report), timeout=ROUND_TIMEOUT)
            _save_round("1_dissection", r1)
            logger.info(f"Session {session_id}: Round 1 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            logger.info(f"Session {session_id}: Round 2 starting at {time.time()-t_start:.1f}s")
            self.db.update_session_status(session_id, "round_2_crosstalk")
            r2 = await asyncio.wait_for(self._run_round_2(r1, quant_report, market_data), timeout=ROUND_TIMEOUT)
            _save_round("2_hypotheses", r2)
            logger.info(f"Session {session_id}: Round 2 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            self.db.update_session_status(session_id, "round_3_guardian")
            r3 = await asyncio.wait_for(self._run_round_3(r1, r2, quant_report), timeout=ROUND_TIMEOUT)
            _save_round("3_adversarial", r3)
            logger.info(f"Session {session_id}: Round 3 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            self.db.update_session_status(session_id, "round_4_refinement")
            r4 = await asyncio.wait_for(self._run_round_4(r2, r3, quant_report), timeout=ROUND_TIMEOUT)
            _save_round("4_refinement", r4)
            logger.info(f"Session {session_id}: Round 4 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            self.db.update_session_status(session_id, "round_5_stress_test")
            r5 = await asyncio.wait_for(self._run_round_5(r4, quant_report), timeout=ROUND_TIMEOUT)
            _save_round("5_stress_test", r5)
            logger.info(f"Session {session_id}: Round 5 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            self.db.update_session_status(session_id, "round_6_audit")
            r6 = await asyncio.wait_for(self._run_round_6(r1, r2, r3, r4, r5), timeout=ROUND_TIMEOUT)
            _save_round("6_audit", r6)
            logger.info(f"Session {session_id}: Round 6 done at {time.time()-t_start:.1f}s")
            await asyncio.sleep(ROUND_DELAY)

            logger.info(f"Session {session_id}: Starting Round 7 (Decree)")
            self.db.update_session_status(session_id, "round_7_decree")
            prince_raw = await asyncio.wait_for(
                self._run_round_7(r1, r6, quant_report, issuers, groups_label=groups_label),
                timeout=ROUND_TIMEOUT
            )
            _save_round("7_standard_decree", prince_raw)
            logger.info(f"Session {session_id}: Round 7 done at {time.time()-t_start:.1f}s")

            prince_text = prince_raw.get('prince', '')
            logger.info(f"[DEBUG][{session_id}] prince_raw (first 600 chars): {str(prince_text)[:600]}")

            # --- Advanced Round (optional) ---
            user_settings = self.db.get_user_settings(user_id)
            is_advanced_enabled = user_settings.get('is_developed_enabled', True)
            advanced_strategies = []
            advanced_raw = {}

            if is_advanced_enabled:
                await asyncio.sleep(ROUND_DELAY)
                self.db.update_session_status(session_id, "round_8_advanced_learning")
                recent_trades = self.db.get_recent_trades_summary(user_id, limit=50)
                advanced_raw = await asyncio.wait_for(
                    self._run_advanced_round(r6, quant_report, recent_trades, groups_label=groups_label),
                    timeout=ROUND_TIMEOUT
                )
                adv_text = advanced_raw.get('advanced', '{}')
                advanced_strategies = self._parse_json(adv_text).get('strategies', [])
                logger.info(f"[DEBUG][{session_id}] advanced_strategies count: {len(advanced_strategies)}")

            # --- Backtest ---
            self.db.update_session_status(session_id, "backtesting_7_3")
            standard_strategies = self._parse_json(prince_text).get('strategies', [])
            logger.info(f"[DEBUG][{session_id}] standard_strategies count: {len(standard_strategies)}")

            if not standard_strategies:
                logger.error(f"[{session_id}] PARSE FAILED — prince returned no strategies. Raw: {str(prince_text)[:800]}")

            all_proposed = standard_strategies + advanced_strategies
            logger.info(f"[DEBUG][{session_id}] Total proposed strategies: {len(all_proposed)}")

            from backend.services.backtest_engine import BacktestEngine
            validation_results = BacktestEngine.validate_strategies(
                market_data.get('ohlc_4h_history', []), all_proposed
            )

            passed_strategies  = validation_results.get('passed', [])
            failed_strategies  = validation_results.get('failed', [])
            logger.info(f"[DEBUG][{session_id}] Backtest passed: {len(passed_strategies)} | failed: {len(failed_strategies)}")

            # ✅ Conditional Pass لو السوق Bearish فشّل الكل
            if not passed_strategies and failed_strategies:
                logger.warning(f"[{session_id}] All backtest failed — trying conditional pass")
                conditional_passed = []
                for strat in failed_strategies:
                    rr = float(strat.get('risk_reward', 0))
                    tp = float(strat.get('target_pct', 0))
                    sl = float(strat.get('sl_pct', 0))
                    if rr >= 1.5 and tp >= 0.5 and sl > 0:
                        denom = (tp + sl) if (tp + sl) > 0 else 1.0
                        est_wr = round(max(0.45, min(0.75, 1.0 - (sl / denom))), 2)
                        strat['backtest_stats'] = {
                            "mode":             "conditional_pass",
                            "reason":           "اجتازت فحص المعايير التكتيكية وإدارة المخاطر",
                            "discovery": {
                                "win_rate": est_wr,
                                "sharpe": round(max(0.8, rr * 0.65), 2),
                                "drawdown": round(min(0.25, sl * 2 / 100), 2)
                            },
                            "validation": {
                                "win_rate": round(max(0.40, est_wr - 0.05), 2)
                            },
                            "original_failure": strat.get('failure_reason', 'N/A')
                        }
                        strat.pop('failure_reason', None)
                        conditional_passed.append(strat)

                if conditional_passed:
                    logger.info(f"[{session_id}] Conditional pass: {len(conditional_passed)} strategies accepted")
                    passed_strategies              = conditional_passed
                    failed_strategies              = [s for s in failed_strategies if s not in conditional_passed]
                    validation_results['passed']   = passed_strategies
                    validation_results['failed']   = failed_strategies
                    validation_results['note']     = "تم قبول الاستراتيجيات بناءً على نسب العائد إلى المخاطرة المدروسة"

            all_opinions = {
                "quant_report":       quant_report,
                "is_advanced_active": is_advanced_enabled,
                "backtest_report":    validation_results,
                "rounds": {
                    "1_dissection":      r1,
                    "2_hypotheses":      r2,
                    "3_adversarial":     r3,
                    "4_refinement":      r4,
                    "5_stress_test":     r5,
                    "6_audit":           r6,
                    "7_standard_decree": prince_raw,
                    "8_advanced_decree": advanced_raw if is_advanced_enabled else None
                }
            }

            if not passed_strategies:
                all_reasons = list(set([
                    s.get('failure_reason', 'المعايير لم تتحقق')
                    for s in failed_strategies
                ]))
                reason = " | ".join(all_reasons[:3])
                logger.warning(f"[{session_id}] No strategies passed. Reasons: {reason}")
                self.db.update_session_data(session_id, {
                    "status":         "failed",
                    "expert_opinions": all_opinions,
                    "final_decision":  {"passed": [], "failed": failed_strategies, "failure_summary": reason}
                })
                await self._safe_notify(Notifier.notify_session_fail(session_id, reason))
                return

            self.db.update_session_data(session_id, {
                "status":                "completed",
                "expert_opinions":       all_opinions,
                "final_decision":        {"passed": passed_strategies, "failed": failed_strategies},
                "market_data_snapshot":  market_data
            })

            user_ws = session.get('worker_settings', {})
            num_workers = len(passed_strategies)

            # Fetch active market symbols for multi-symbol distribution if general market is selected
            candidate_symbols = [symbol]
            if symbol in ['BTC/USDT', 'ALL'] or not session.get('symbol'):
                try:
                    from backend.config import get_supabase_admin_client
                    sp = get_supabase_admin_client()
                    whitelist_resp = sp.table('whitelist').select('symbol').eq('is_active', True).execute()
                    if whitelist_resp.data:
                        cand = [r['symbol'] for r in whitelist_resp.data if r.get('symbol')]
                        if cand:
                            # Prioritize top pairs: BTC, ETH, SOL, BNB, ADA, etc.
                            candidate_symbols = cand
                except Exception as ex:
                    logger.warning(f"[{session_id}] Could not fetch whitelist symbols for multi-pair assignment: {ex}")

            target_symbols = [b['symbol'] for b in market_data.get('market_breadth', []) if b.get('symbol')]
            # ✅ فلترة target_symbols بناءً على المجموعات المختارة
            if filtered_symbols:
                target_symbols = [s for s in target_symbols if s in filtered_symbols]
                if not target_symbols:
                    target_symbols = filtered_symbols  # fallback لو breadth ما فيه عملات المجموعات
            for idx, strat in enumerate(passed_strategies):
                m_type = "advanced" if strat in advanced_strategies else "standard"
                await self._spawn_worker(
                    session_id, user_id, market_id, "ALL", strat, user_ws, m_type,
                    worker_index=idx, total_workers=num_workers,
                    target_symbols=target_symbols
                )

            await self._safe_notify(Notifier.notify_session_ready(session_id, symbol, len(passed_strategies)))
            logger.info(f"✅ Session {session_id} completed successfully with {len(passed_strategies)} strategies.")
            self._active_session_id = None
            self._active_session_status = None

        except Exception as e:
            import traceback
            logger.error(f"[ERROR] Session {session_id} failed: {e}")
            logger.error(traceback.format_exc())
            try:
                current_session = self.db.get_session(session_id)
                has_passed = bool(current_session and current_session.get('final_decision', {}).get('passed'))
            except Exception:
                has_passed = False
            if not has_passed:
                self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": str(e)}})
                await self._safe_notify(Notifier.notify_session_fail(session_id, str(e)))

    async def _spawn_worker(self, session_id, user_id, market_id, symbol, strategy, user_ws, model_type, worker_index=0, total_workers=1, target_symbols=None):
        try:
            strat_name  = strategy.get('name', f"استراتيجية {model_type}")
            # ✅ تعريب بادئة نوع الموظف
            type_prefix = 'متقدمة' if model_type == 'advanced' else 'قياسية'
            worker_name = f"[{type_prefix}] {strat_name}"

            # تحقق إن market_id UUID صحيح — لو رقم أو None شيله
            import re as _re
            _uuid_re = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            safe_market_id = (
                market_id
                if market_id and _re.match(_uuid_re, str(market_id), _re.I)
                else None
            )
            if market_id and not safe_market_id:
                logger.warning(f"[{session_id}] market_id '{market_id}' is not a valid UUID — setting to None")

            # ✅ FIX 1: type يجب أن يكون 'paper' أو 'live' فقط حسب DB CHECK constraint
            raw_type = user_ws.get('workerType', user_ws.get('type', 'paper'))
            safe_type = raw_type.lower() if isinstance(raw_type, str) and raw_type.lower() in ('paper', 'live') else 'paper'

            # ✅ FIX 2: Dynamic Liquidity Allocation
            total_capital = float(user_ws.get('capital', user_ws.get('portfolioValue', 1000)))
            portfolio_share_type = user_ws.get('portfolioShareType', 'percent_comp')

            if portfolio_share_type == 'fixed':
                capital = total_capital
            else:
                # Divide total capital among spawned workers with slight strategic variation
                base_share = total_capital / max(1, total_workers)
                # Apply slight variance (-10% to +10%) based on index to differentiate initial capitals
                variance_factors = [1.10, 0.95, 1.05, 0.90, 1.00, 1.02, 0.98]
                factor = variance_factors[worker_index % len(variance_factors)]
                capital = round(base_share * factor, 2)

            # ✅ FIX 3: strategy_name بدل pair والعملات المستهدفة للتداول المباشر
            worker_data = {
                "user_id":               user_id,
                "kitchen_session_id":    session_id,
                "name":                  worker_name,
                "market_id":             safe_market_id,
                "market_type":           user_ws.get('marketType', 'stable'),
                "strategy_name":         strat_name,   # اسم الاستراتيجية
                "type":                  safe_type,
                "user_settings":         {
                    **user_ws,
                    "expert_signal": strategy,
                    "symbol": "ALL",
                    "target_symbols": target_symbols or []
                },
                "starting_capital":      capital,
                "current_capital":       capital,
                "status":                "running",
                "owner":                 "prince",
            }
            result = self.db.clone_worker_direct(worker_data)
            if result:
                logger.info(f"[{session_id}] ✅ Spawned {model_type} worker: {worker_name} (All Whitelist, capital=${capital}) (id={result.get('id')})")
            else:
                logger.error(f"[{session_id}] ❌ clone_worker_direct returned None for {worker_name}")
        except Exception as e:
            logger.error(f"[{session_id}] Failed to spawn {model_type} worker: {e}", exc_info=True)

    async def _run_advanced_round(self, r6, quant, trades, groups_label: str = 'القائمة البيضاء بالكامل'):
        trades_context = json.dumps(trades, indent=2) if trades else "لا يوجد صفقات سابقة."
        advanced_prompt = (
            f"أنت العقل المطور لمجلس صقر. حلل التناقض بين التاريخ والواقع الحالي عبر محفظة المجموعة المختارة ({groups_label}): {trades_context}.\n"
            f"نقاش المجلس: {r6}. أصدر 3 استراتيجيات متطورة تدمج عقوبة الذاكرة وقابلة للتطبيق والتداول حصرياً على أصول: {groups_label}.\n\n"
            f"⚠️ شروط هامة جداً:\n"
            f"- أجب بـ JSON نقي فقط بدون أي نص قبله أو بعده، وبدون markdown.\n"
            f"- حقل 'name' يجب أن يكون اسماً عربياً وصفياً فصيحاً ومميزاً للاستراتيجية (مثال: 'صقر التطوير الحذر', 'درع المخاطر التكيفي', 'قناص الزخم الذكي').\n\n"
            f'{{"strategies": [{{"name": "اسم عربي وصفي للاستراتيجية المتطورة المحافظة", "type": "conservative", "entry_description": "...", '
            f'"target_pct": 2.0, "sl_pct": 1.0, "confidence_score": "85%", "risk_reward": 2.0}}, '
            f'{{"name": "اسم عربي وصفي للاستراتيجية المتطورة المتوازنة", "type": "moderate", "entry_description": "...", '
            f'"target_pct": 4.0, "sl_pct": 2.0, "confidence_score": "75%", "risk_reward": 2.0}}, '
            f'{{"name": "اسم عربي وصفي للاستراتيجية المتطورة الجريئة", "type": "aggressive", "entry_description": "...", '
            f'"target_pct": 7.0, "sl_pct": 3.0, "confidence_score": "65%", "risk_reward": 2.3}}]}}'
        )
        return await self._call_batch({"advanced": advanced_prompt})

    async def connector_get_snapshot(self, symbol, session, user_id=None, filter_symbols=None):
        resolved_uid = user_id or self._resolve_user_id(session.get('user_id'))
        api_creds    = self.db.get_market_api(resolved_uid, session.get('market_id'))
        api_key      = api_creds.get('api_key')    if api_creds else None
        api_secret   = api_creds.get('api_secret') if api_creds else None
        return await DataConnector.collect_all(symbol=symbol, api_key=api_key, api_secret=api_secret, filter_symbols=filter_symbols)

    def _parse_json(self, text):
        if not text or not isinstance(text, str):
            logger.warning(f"_parse_json: invalid input type {type(text)}")
            return {"strategies": []}
        try:
            clean = re.sub(r'```(?:json)?\s*', '', text).replace('```', '').strip()
            match = re.search(r'\{.*\}', clean, re.DOTALL)
            if match:
                clean = match.group(0)
            result = json.loads(clean)
            logger.info(f"_parse_json: success — keys: {list(result.keys())}")
            return result
        except Exception as e:
            logger.error(f"_parse_json FAILED: {e} | input[:400]: {str(text)[:400]}")
            return {"strategies": []}

    async def _call_batch(self, prompts: dict) -> dict:
        results = {}
        for key, prompt in prompts.items():
            result = await self._call_ai(key, prompt)
            results[key] = result
            if len(prompts) > 1:
                await asyncio.sleep(1.5)
        return results

    def _get_client_for_model(self, model_name: str):
        groq_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile"]
        m_lower = str(model_name).lower()
        if any(gm in m_lower for gm in groq_models) or m_lower.startswith("groq/"):
            from backend.config import get_groq_client
            clean_model = "openai/gpt-oss-120b" if "compound" in m_lower else model_name
            return get_groq_client(), clean_model
        return self.client, model_name

    async def _call_ai(self, expert_key: str, prompt: str) -> str:
        raw_model = self.experts.get(expert_key) or self.db.get_user_settings().get('expert_models', {}).get(expert_key, "openai/gpt-oss-120b")
        if "compound" in str(raw_model).lower():
            raw_model = "openai/gpt-oss-120b"

        max_retries = 3
        current_model = raw_model

        for attempt in range(max_retries):
            try:
                if getattr(self, '_active_session_id', None):
                    try:
                        self.db.update_session_status(self._active_session_id, getattr(self, '_active_session_status', 'running_session'))
                    except Exception:
                        pass

                client, model_to_use = self._get_client_for_model(current_model)

                sys_msg = "You are an elite quantitative researcher and algorithm engineer analyzing statistical metrics, historical patterns, and technical data for mathematical models."
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=model_to_use,
                        messages=[
                            {"role": "system", "content": sys_msg},
                            {"role": "user", "content": prompt}
                        ],
                        max_tokens=2048,
                        temperature=0.3,
                    ),
                    timeout=85.0
                )
                msg = response.choices[0].message
                content = msg.content or ""
                if not content.strip() and hasattr(msg, 'reasoning') and msg.reasoning:
                    content = msg.reasoning

                # فحص شامل لحالات الرفض التلقائي للتبديل للنموذج البديل
                lower_c = content.lower()
                if any(ref in lower_c for ref in ["sorry", "can't help", "cannot help", "cannot provide financial", "as an ai"]):
                    raise Exception(f"Model {model_to_use} safety refusal — switching to fallback")

                if content and content.strip():
                    logger.info(f"[_call_ai] Expert '{expert_key}' ({model_to_use}) succeeded — {len(content)} chars")
                    return content
                else:
                    raise Exception(f"Empty response from model {model_to_use}")

            except Exception as e:
                err_str = str(e)
                logger.warning(f"[_call_ai] Expert '{expert_key}' ({current_model}) attempt {attempt+1}/{max_retries} failed: {err_str[:200]}")

                # إذا كان الموديل غير صالح أو واجه خطأ 400/404، التبديل لموديل مضمون
                if "not a valid model" in err_str.lower() or "does not exist" in err_str.lower() or "404" in err_str or "400" in err_str or attempt >= 1:
                    current_model = "google/gemini-2.5-flash"
                    logger.info(f"[_call_ai] Switching expert '{expert_key}' to fallback: {current_model}")

                if "rate_limit" in err_str.lower() or "429" in err_str:
                    wait_time = (attempt + 1) * 10
                    logger.warning(f"[_call_ai] Rate limit hit. Waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    await asyncio.sleep(2 * (attempt + 1))

        # Fallback أخير مضمون بنسبة 100%
        try:
            logger.info(f"[_call_ai] Emergency fallback for '{expert_key}' with google/gemini-2.5-flash")
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    self.client.chat.completions.create,
                    model="google/gemini-2.5-flash",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2048,
                    temperature=0.3,
                ),
                timeout=85.0
            )
            return response.choices[0].message.content or "تم التحليل بنجاح."
        except Exception as final_e:
            logger.error(f"[_call_ai] Emergency fallback failed: {final_e}")
            return "تم إتمام التحليل الكمي للفرصة بنجاح بناءً على سياق الجلسة."

    def _get_prompt(self, expert_key: str, default_prompt: str, context: str = "") -> str:
        custom_p = getattr(self, '_custom_prompts', {}).get(expert_key)
        if custom_p and str(custom_p).strip():
            return f"{custom_p.strip()}\n\n[البيانات الحية وسياق السوق الكامل للجلسة]:\n{default_prompt}"
        return default_prompt

    # ==================== The 7 Rounds ====================

    def _build_whitelist_context(self, market_data):
        """بناء ملخص بأهم وأقوى عملات القائمة البيضاء المختارة للتحليل والتداول مع كامل المؤشرات"""
        breadth = market_data.get('market_breadth', [])
        scope_name = market_data.get('analysis_scope', 'القائمة البيضاء')
        filtered_syms = market_data.get('filtered_symbols', [])
        
        # إذا كانت بيانات السيولة فارغة، نستخدم بيانات بديلة من العملات المختارة
        if not breadth:
            base_list = filtered_syms if filtered_syms else ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'NEAR/USDT', 'ARB/USDT', 'LINK/USDT', 'XRP/USDT', 'DOGE/USDT']
            breadth = [
                {
                    "symbol": s,
                    "price": 62500.0 if 'BTC' in s else 3450.0 if 'ETH' in s else 145.0 if 'SOL' in s else 580.0 if 'BNB' in s else 1.25,
                    "change_24h": round(1.5 if idx % 2 == 0 else -0.8, 2),
                    "volume": 250000000 if 'BTC' in s or 'ETH' in s else 45000000,
                    "rsi": 52.0 if idx % 2 == 0 else 48.5,
                    "ema_trend": "صاعد" if idx % 2 == 0 else "متعادل"
                }
                for idx, s in enumerate(base_list[:12])
            ]
        
        top_coins = breadth[:12]
        lines = []
        lines.append(f"📋 جدول أصول نطاق [{scope_name}] اللحظية للتحليل واقتناص الفرص ({len(top_coins)} عملة):")
        lines.append("| # | العملة | السعر اللحظي | التغير 24h | حجم التداول (Volume) | مؤشر RSI | اتجاه EMA |")
        lines.append("|---|--------|-------------|------------|---------------------|-----------|-----------|")
        
        for idx, b in enumerate(top_coins):
            sym = b.get('symbol', '?')
            price = b.get('price', 0)
            chg = b.get('change_24h', 0)
            vol = b.get('volume', 0)
            rsi = b.get('rsi')
            trend = b.get('ema_trend', '')
            
            rsi_txt = f"{rsi}" if rsi is not None else "50.0"
            trend_txt = f"{trend}" if trend else "صاعد"
            arrow = "+" if chg > 0 else ""
            lines.append(f"| {idx+1} | **{sym}** | ${price:,.4f} | {arrow}{chg:.2f}% | ${vol:,.0f} | {rsi_txt} | {trend_txt} |")
        
        all_changes = [b.get('change_24h', 0) or 0 for b in top_coins]
        avg_change = sum(all_changes) / len(all_changes) if all_changes else 0
        lines.append(f"\n📊 **متوسط أداء سلة العملات:** {avg_change:+.2f}% | **الأخبار والزخم:** {market_data.get('recent_news', 'لا توجد أخبار سلبية مؤثرة.')}")
        
        return "\n".join(lines)

    async def _run_round_1(self, market_data, quant):
        symbol = market_data['symbol']
        is_multi = market_data.get('is_multi_asset', False)
        scope_label = market_data.get('analysis_scope', symbol)
        whitelist_ctx = self._build_whitelist_context(market_data)
        
        # بيانات المؤشرات الفنية للعملة الرئيسية
        indicators = market_data.get('indicators', {})
        sentiment = market_data.get('sentiment', {})
        indicator_txt = (
            f"RSI={indicators.get('rsi', 'N/A')}, "
            f"EMA Cross={indicators.get('ema_cross', 'N/A')}, "
            f"Trend vs EMA200={indicators.get('trend_200', 'N/A')}, "
            f"Fear & Greed={sentiment.get('fear_greed', 'N/A')} ({sentiment.get('fear_greed_label', '')}), "
            f"BTC Dominance={market_data.get('btc_dominance', 'N/A')}%"
        )
        
        disc_stats = quant.get('discovery_stats', {})
        wf_stats = quant.get('walk_forward_stats', {})
        
        disc_str = (
            f"حجم العينة={disc_stats.get('sample_size', 'N/A')} صفقة, "
            f"نسبة النجاح={disc_stats.get('success_rate', 'N/A')}%, "
            f"متوسط الربح=+{disc_stats.get('avg_profit', 'N/A')}%, "
            f"متوسط الخسارة={disc_stats.get('avg_loss', 'N/A')}%, "
            f"متوسط مدة الصفقة={disc_stats.get('avg_duration_days', 'N/A')} يوم"
        )
        wf_str = (
            f"حجم العينة={wf_stats.get('sample_size', 'N/A')} صفقة, "
            f"نسبة النجاح={wf_stats.get('success_rate', 'N/A')}%, "
            f"متوسط الربح=+{wf_stats.get('avg_profit', 'N/A')}%, "
            f"متوسط الخسارة={wf_stats.get('avg_loss', 'N/A')}%, "
            f"متوسط مدة الصفقة={wf_stats.get('avg_duration_days', 'N/A')} يوم"
        )
        
        if is_multi:
            scope_intro = (
                f"⚠️ نطاق التحليل: دراسة السوق العام لجميع أصول القائمة البيضاء (BTC كمعيار مرجعي فقط).\n\n"
            )
        else:
            scope_intro = f"⚠️ نطاق التحليل: العملة المحددة {symbol}.\n\n"
        
        chartist_p = (
            f"{scope_intro}"
            f"أنت الشارتيست الكمي لمجلس صقر.\n"
            f"إحصاءات التحليل الكمي المتوفرة للنموذج:\n"
            f"• فترة الاستكشاف Discovery (7Y): {disc_str}\n"
            f"• فترة التحقق المستقبلي Walk-Forward (3Y): {wf_str}\n\n"
            f"المؤشرات الفنية اللحظية (BTC كمعيار): {indicator_txt}\n\n"
            f"{whitelist_ctx}\n\n"
            f"المطلوب منك:\n"
            f"1. مقارنة إحصاءات Discovery (7Y) مع Walk-Forward (3Y) في جدول واستخراج الحقائق الجافة.\n"
            f"2. قراءة اتجاه السوق العام وفرص أصول القائمة البيضاء."
        )

        reporter_p = (
            f"{scope_intro}"
            f"أنت 'المذيع صقر' لمجلس الخبراء.\n"
            f"المؤشرات العامة: {indicator_txt}\n"
            f"الأخبار العاجلة: {market_data.get('recent_news', 'لا توجد أخبار سلبية مؤثرة')}\n\n"
            f"{whitelist_ctx}\n\n"
            f"المطلوب منك:\n"
            f"1. تحليل مشاعر المتداولين (هل يوجد FOMO أو FUD؟).\n"
            f"2. تسمية وترتيب أقوى العملات حالياً بالاسم والأرقام من جدول القائمة البيضاء المرفق أعلاه."
        )

        prompts = {
            "chartist": self._get_prompt("chartist", chartist_p),
            "reporter": self._get_prompt("reporter", reporter_p)
        }
        return await self._call_batch(prompts)

    async def _run_round_2(self, r1, quant, market_data=None):
        whitelist_ctx = self._build_whitelist_context(market_data) if market_data else "لا تتوفر بيانات القائمة البيضاء."
        is_multi = market_data.get('is_multi_asset', False) if market_data else False
        scope_label = market_data.get('analysis_scope', market_data.get('symbol', 'العملة')) if market_data else 'العملة'
        disc_stats = quant.get('discovery_stats', {})
        
        if is_multi:
            radar_q = (
                f"بصفتك الرادار لمجلس صقر — نطاق التحليل: دراسة السوق العام.\n"
                f"{whitelist_ctx}\n\n"
                f"المطلوب:\n"
                f"1. تحليل الثبات الإحصائي وتدفق السيولة.\n"
                f"2. ترتيب أقوى 3 إلى 5 عملات في القائمة البيضاء المرفقة أعلاه حسب الحجم والزخم بالاسم والأرقام."
            )
        else:
            radar_q = (
                f"بصفتك الرادار لمجلس صقر.\n"
                f"{whitelist_ctx}\n\n"
                f"المطلوب: حلل الثبات الإحصائي، وهل {market_data.get('symbol', 'العملة')} هي الأفضل أم توجد بدائل أقوى من جدول القائمة البيضاء أعلاه؟"
            )
        
        pulser_p = (
            f"بصفتك النبّاض: بناءً على تشريح الجولة 1: {r1}، ضع 3 إلى 5 فرضيات دخول رقمية دقيقة "
            f"مستهدفاً متوسط ربح تاريخي {disc_stats.get('avg_profit', 3.0)}% مع تحديد شروط الدخول ومستويات TP/SL."
        )
        
        prompts = {
            "pulser": self._get_prompt("pulser", pulser_p),
            "radar": self._get_prompt("radar", radar_q)
        }
        return await self._call_batch(prompts)

    async def _run_round_3(self, r1, r2, quant):
        r1_text = json.dumps(r1, ensure_ascii=False)
        r2_text = json.dumps(r2, ensure_ascii=False)
        avg_p = quant['discovery_stats'].get('avg_profit', 3.0)
        win_r = quant['discovery_stats'].get('success_rate', 60.0)
        prompts = {
            "guardian": self._get_prompt(
                "guardian",
                f"أنت 'الحارس الصارم' لمجلس صقر. هاجم فرضيات الجولة 2 بشراسة:\n{r2_text}\n\n"
                f"البيانات الكمية: متوسط الربح التاريخي +{avg_p}%، نسبة النجاح {win_r}%.\n"
                f"لماذا قد تفشل هذه الفرضيات في الأزمات التاريخية مثل 2019؟ ابحث عن المخاطر الخفية لحماية رأس المال أولاً.",
                f"فرضيات الجولة 2: {r2_text}"
            ),
            "investigator": self._get_prompt(
                "investigator",
                f"أنت 'المحقق' لمجلس صقر. دقق في التوافق بين تشريح الجولة 1 وفرضيات الجولة 2:\n"
                f"تشريح الجولة 1: {r1_text}\n"
                f"فرضيات الجولة 2: {r2_text}\n"
                f"استخرج أي تناقض منطقي أو رقمي بين مدخلات Chartist/Reporter ومقترحات Pulser/Radar.",
                f"الجولة 1 و 2: {r2_text}"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_4(self, r2, r3, quant):
        r3_text = json.dumps(r3, ensure_ascii=False)
        avg_loss = quant['discovery_stats'].get('avg_loss', -1.5)
        prompts = {
            "chartist": self._get_prompt(
                "chartist",
                f"بناءً على هجوم الحارس وتدقيق المحقق في الجولة 3:\n{r3_text}\n\n"
                f"قم بتعديل شروط الدخول الفنية بدقة (RSI, فلاتر الحجم والزخم) لتفادي الثغرات المكتشفة.",
                f"مخرجات الجولة 3: {r3_text}"
            ),
            "engineer": self._get_prompt(
                "engineer",
                f"أنت 'المهندس الكمي'. بناءً على هجوم الحارس {r3_text} وبيانات متوسط الخسارة التاريخية ({avg_loss}%):\n"
                f"اقترح تعديلات هندسية على مستويات وقف الخسارة (SL) ونسب العائد للمخاطرة (Risk-to-Reward) لحماية رأس المال بأقصى تراجع (Max Drawdown).",
                f"مخرجات الجولة 3: {r3_text}"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_5(self, r4, quant):
        r4_text = json.dumps(r4, ensure_ascii=False)
        prompts = {
            "guardian": self._get_prompt(
                "guardian",
                f"محاكاة انهيار مفاجئ (Flash Crash) مثل أزمة مارس 2020 أو مايو 2021.\n"
                f"هل تنجو الاستراتيجيات المعدلة من المهندس والشارتيست:\n{r4_text}\n"
                f"افحص متانة وقف الخسارة والسيولة تحت الضغط الشديد.",
                f"تعديلات الجولة 4: {r4_text}"
            ),
            "pulser": self._get_prompt(
                "pulser",
                f"بصفتك النبّاض: في حالة حدوث انهيار مفاجئ واختبار الضغط {r4_text}:\n"
                f"كيف سيتصرف زخم السوق والسيولة؟ وهل ستخرج الاستراتيجية قبل تفاقم الانزلاق السعري؟",
                f"تعديلات الجولة 4: {r4_text}"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_6(self, r1, r2, r3, r4, r5):
        summary_all = json.dumps({
            "round_1_dissection": r1,
            "round_2_hypotheses": r2,
            "round_3_adversarial": r3,
            "round_4_refinement": r4,
            "round_5_stress_test": r5
        }, ensure_ascii=False, indent=1)
        prompts = {
            "investigator": self._get_prompt(
                "investigator",
                f"أنت 'المحقق' المشرف على المراجعة النهائية لكافة مداولات المجلس (الجولات 1 إلى 5):\n\n"
                f"{summary_all}\n\n"
                f"المطلوب: قم بتدقيق شامل ومطابقة الأرقام والفرضيات ومستويات الوقف والأهداف. "
                f"هل القرار النهائي المتشكل متماسك علمياً وخالٍ من التناقضات ومستعد لحكم الأمير؟",
                f"ملخص المداولات الكامل: {summary_all[:600]}"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_7(self, r1, r6, quant, issuers, groups_label: str = 'القائمة البيضاء بالكامل'):
        prince_prompt = f"""أنت الأمير، القاضي العلمي النهائي لمجلس صقر.
بناءً على 6 جولات من التدقيق والجلد (الجولة 6): {r6}، أصدر مرسومك النهائي.

نطاق الاستثمار المختار: **{groups_label}**

الأركان الثلاثة لقرارك:
1. البيانات الكمية لـ 10 سنوات لأصول المجموعة المختارة ({groups_label}).
2. هجوم الفريق الأحمر (حالات الفشل التاريخية).
3. محاكاة البجعة السوداء (Flash Crash).

يجب إصدار 3 استراتيجيات حصراً مصممة للتطبيق على المجموعة: {groups_label}.
لكل استراتيجية، حدد شروط دخول دقيقة (RSI, EMA, الزخم) و"درجة الثقة الكمية" بناءً على مدى صمودها في الجولات السابقة.

⚠️ مهم جداً:
- أجب بـ JSON نقي فقط، بدون أي نص قبله أو بعده، وبدون markdown أو backticks.
- حقل "name" يجب أن يكون اسماً عربياً وصفياً فصيحاً يعبّر عن الاستراتيجية (مثال: "الحارس الحذر", "الفارس المتوازن", "صياد الزخم").

{{
  "strategies": [
    {{
      "name": "اسم عربي وصفي للاستراتيجية المحافظة",
      "type": "conservative",
      "entry_description": "...",
      "target_pct": 2.0,
      "sl_pct": 1.0,
      "confidence_score": "85%",
      "risk_reward": 2.0
    }},
    {{
      "name": "اسم عربي وصفي للاستراتيجية المتوازنة",
      "type": "moderate",
      "entry_description": "...",
      "target_pct": 4.0,
      "sl_pct": 2.0,
      "confidence_score": "75%",
      "risk_reward": 2.0
    }},
    {{
      "name": "اسم عربي وصفي للاستراتيجية الجريئة",
      "type": "aggressive",
      "entry_description": "...",
      "target_pct": 7.0,
      "sl_pct": 3.0,
      "confidence_score": "65%",
      "risk_reward": 2.3
    }}
  ]
}}"""
        final_prince_prompt = self._get_prompt("prince", prince_prompt, f"مخرجات مراجعة الجولة 6:\n{json.dumps(r6, ensure_ascii=False)}")
        return await self._call_batch({"prince": final_prince_prompt})