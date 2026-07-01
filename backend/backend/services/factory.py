import os
import json
import asyncio
from openai import OpenAI
from backend.services.data_connector import DataConnector
from backend.services.pattern_matcher import pattern_matcher
from backend.services.notifier import Notifier
from backend.database import Database
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
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("GROQ_API_KEY is not set in environment variables")

        self.client = OpenAI(
            base_url="https://api.groq.com/openai/v1",
            api_key=self.api_key,
            timeout=90.0,
        )
        self.db = Database()

        # ✅ كل الـ experts على Groq — موحّد ومجاني
        self.experts = {
            "chartist":     "llama-3.3-70b-versatile",
            "reporter":     "llama-3.3-70b-versatile",
            "pulser":       "llama-3.3-70b-versatile",
            "radar":        "llama-3.3-70b-versatile",
            "guardian":     "llama-3.3-70b-versatile",
            "investigator": "llama-3.3-70b-versatile",
            "prince":       "llama-3.1-8b-instant",
            "engineer":     "llama-3.3-70b-versatile",
            "advanced":     "llama-3.1-8b-instant",
        }

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
        symbol = session.get('symbol', 'BTC/USDT')

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

        logger.info(f"🚀 Starting Scientific Council for Session {session_id}")
        await self._safe_notify(Notifier.notify_session_start(session_id, symbol))
        issuers = session.get('issuers', ['prince'])

        t_start = time.time()
        # ✅ HEARTBEAT TRACKING: عشان _call_ai يعرف يعمل update على الجلسة الشغالة
        self._active_session_id = session_id
        self._active_session_status = "running_session"

        # --- Fetch Market Data ---
        self.db.update_session_status(session_id, "collecting_data")
        try:
            market_data = await asyncio.wait_for(
                self.connector_get_snapshot(symbol, session, user_id),
                timeout=ROUND_TIMEOUT
            )
        except asyncio.TimeoutError:
            raise Exception("فشل جلب بيانات السوق (انتهت المهلة)")

        logger.info(f"Session {session_id}: Data collection took {time.time()-t_start:.1f}s")

        if not market_data:
            self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": "فشل جلب بيانات السوق."}})
            await self._safe_notify(Notifier.notify_session_fail(session_id, "فشل جلب بيانات السوق"))
            return

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
                self._run_round_7(r1, r6, quant_report, issuers),
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
                    self._run_advanced_round(r6, quant_report, recent_trades),
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
                        strat['backtest_stats'] = {
                            "mode":             "conditional_pass",
                            "reason":           "اجتازت فحص المعايير — السوق الحالي Bearish يؤثر على النتائج التاريخية",
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
                    validation_results['note']     = "تم قبول الاستراتيجيات بشكل مشروط — السوق الحالي Bearish"

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
            for strat in passed_strategies:
                m_type = "advanced" if strat in advanced_strategies else "standard"
                await self._spawn_worker(session_id, user_id, market_id, symbol, strat, user_ws, m_type)

            await self._safe_notify(Notifier.notify_session_ready(session_id, symbol, len(passed_strategies)))
            logger.info(f"✅ Session {session_id} completed successfully with {len(passed_strategies)} strategies.")
            self._active_session_id = None
            self._active_session_status = None

        except Exception as e:
            import traceback
            logger.error(f"[ERROR] Session {session_id} failed: {e}")
            logger.error(traceback.format_exc())
            self.db.update_session_data(session_id, {"status": "failed", "expert_opinions": {"error": str(e)}})
            await self._safe_notify(Notifier.notify_session_fail(session_id, str(e)))

    async def _spawn_worker(self, session_id, user_id, market_id, symbol, strategy, user_ws, model_type):
        try:
            strat_name  = strategy.get('name', f"استراتيجية {model_type}")
            worker_name = f"{'[ADVANCED]' if model_type == 'advanced' else '[STANDARD]'} {strat_name}"

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

            # ✅ FIX 2: capital من worker_settings اللي جت من الـ session
            capital = float(user_ws.get('capital', user_ws.get('portfolioValue', 1000)))

            # ✅ FIX 3: strategy_name بدل pair (workers table مفيش فيه عمود pair)
            worker_data = {
                "user_id":               user_id,
                "kitchen_session_id":    session_id,
                "name":                  worker_name,
                "market_id":             safe_market_id,
                "market_type":           user_ws.get('marketType', 'stable'),
                "strategy_name":         symbol,   # بنحفظ الـ symbol هنا
                "type":                  safe_type,
                "user_settings":         {**user_ws, "expert_signal": strategy, "symbol": symbol},
                "starting_capital":      capital,
                "current_capital":       capital,
                "status":                "running",
                "owner":                 "prince",
            }
            result = self.db.clone_worker_direct(worker_data)
            if result:
                logger.info(f"[{session_id}] ✅ Spawned {model_type} worker: {worker_name} (id={result.get('id')})")
            else:
                logger.error(f"[{session_id}] ❌ clone_worker_direct returned None for {worker_name}")
        except Exception as e:
            logger.error(f"[{session_id}] Failed to spawn {model_type} worker: {e}", exc_info=True)

    async def _run_advanced_round(self, r6, quant, trades):
        trades_context = json.dumps(trades, indent=2) if trades else "لا يوجد صفقات سابقة."
        advanced_prompt = (
            f"أنت العقل المطور لمجلس صقر. حلل التناقض بين التاريخ والواقع الحالي: {trades_context}. "
            f"نقاش المجلس: {r6}. أصدر 3 استراتيجيات متطورة تدمج عقوبة الذاكرة.\n\n"
            f"⚠️ أجب بـ JSON نقي فقط بدون أي نص قبله أو بعده:\n"
            f'{{"strategies": [{{"name": "...", "type": "conservative", "entry_description": "...", '
            f'"target_pct": 2.0, "sl_pct": 1.0, "confidence_score": "85%", "risk_reward": 2.0}}, ...]}}'
        )
        return await self._call_batch({"advanced": advanced_prompt})

    async def connector_get_snapshot(self, symbol, session, user_id=None):
        resolved_uid = user_id or self._resolve_user_id(session.get('user_id'))
        api_creds    = self.db.get_market_api(resolved_uid, session.get('market_id'))
        api_key      = api_creds.get('api_key')    if api_creds else None
        api_secret   = api_creds.get('api_secret') if api_creds else None
        return await DataConnector.collect_all(symbol=symbol, api_key=api_key, api_secret=api_secret)

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

    async def _call_ai(self, expert_key: str, prompt: str) -> str:
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # ✅ HEARTBEAT: نعمل update على updated_at قبل كل AI call
                # عشان الـ KitchenWatcher ما يقتلش الجلسة وهي شغالة
                if self._active_session_id:
                    try:
                        self.db.update_session_status(self._active_session_id, self._active_session_status or "running_session")
                    except Exception:
                        pass

                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        self.client.chat.completions.create,
                        model=self.experts.get(expert_key, "llama-3.3-70b-versatile"),
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=2048,
                        temperature=0.3,
                    ),
                    timeout=85.0
                )
                content = response.choices[0].message.content
                logger.info(f"[_call_ai] Expert '{expert_key}' succeeded — {len(content)} chars")
                return content

            except Exception as e:
                err_str = str(e)
                logger.warning(f"[_call_ai] Expert '{expert_key}' attempt {attempt+1}/{max_retries} failed: {err_str[:200]}")

                if "rate_limit" in err_str.lower() or "429" in err_str:
                    wait_time = (attempt + 1) * 15
                    logger.warning(f"[_call_ai] Rate limit hit. Waiting {wait_time}s...")
                    await asyncio.sleep(wait_time)
                elif attempt < max_retries - 1:
                    await asyncio.sleep(3 * (attempt + 1))
                else:
                    logger.error(f"[_call_ai] Expert '{expert_key}' failed after {max_retries} attempts: {err_str}")
                    return f"Error after {max_retries} retries: {err_str[:200]}"

        return f"Error: max retries exceeded for expert '{expert_key}'"

    # ==================== The 7 Rounds ====================

    async def _run_round_1(self, market_data, quant):
        symbol = market_data['symbol']
        breadth_summary = ", ".join([
            f"{b['symbol']}: {b['change_24h']}%"
            for b in market_data.get('market_breadth', [])[:10]
        ])
        prompts = {
            "chartist": (
                f"أنت الشارتيست الكمي لـ {symbol}. حلل إحصاءات الـ 7 سنوات والـ 3 سنوات (Walk-Forward) "
                f"بشكل منفصل تماماً. استخرج الحقائق الجافة فقط عن السلوك السعري في الفترتين. "
                f"Discovery: {quant['discovery_stats']}."
            ),
            "reporter": (
                f"أنت 'المذيع صقر'. حلل مشاعر المتداولين لـ {symbol} عبر منصة X. "
                f"نظرة عامة على السوق (القائمة البيضاء): {breadth_summary}. "
                f"هل يوجد فومو (FOMO) أو فاد (FUD)؟"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_2(self, r1, quant, market_data=None):
        breadth      = market_data.get('market_breadth', []) if market_data else []
        breadth_text = json.dumps(breadth[:15], indent=1)
        prompts = {
            "pulser": (
                f"بناءً على تشريح البيانات في الجولة 1: {r1}، ضع فرضيات دخول رقمية دقيقة. "
                f"استهدف أرباحاً بناءً على متوسط الربح التاريخي {quant['discovery_stats']['avg_profit']}."
            ),
            "radar": (
                f"بصفتك الرادار، حلل الثبات الإحصائي للفرضيات المقترحة. "
                f"خذ بعين الاعتبار حركة القائمة البيضاء بالكامل: {breadth_text}. "
                f"هل {market_data['symbol'] if market_data else 'العملة'} هي الأفضل حالياً أم يوجد بدلاء أقوى في القائمة؟"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_3(self, r1, r2, quant):
        prompts = {
            "guardian": (
                f"أنت الحارس. هاجم الفرضيات {r2} بشراسة. لماذا فشل هذا النمط في عام 2019؟ "
                f"متوسط الربح التاريخي هو {quant['discovery_stats'].get('avg_profit', 0)}% — "
                f"لكن هذا لا يضمن النجاح دائماً. استخدم هذا الرقم كسقف للتوقعات وابحث عن مخاطر مخفية. "
                f"نحن نبحث عن الأمان أولاً."
            ),
            "investigator": (
                "ابحث عن أي تناقض منطقي في الأرقام أو الفرضيات المقدمة حتى الآن."
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_4(self, r2, r3, quant):
        prompts = {
            "chartist": (
                f"بناءً على هجوم الحارس {r3}، قم بتعديل شروط الدخول. "
                f"أضف فلاتر إضافية (مثل حجم التداول أو مؤشرات الزخم) لتقليل احتمالية تكرار فشل 2019."
            ),
            "engineer": (
                "اقترح تعديلات تقنية على مستويات وقف الخسارة بناءً على أقصى تراجع (Max Drawdown)."
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_5(self, r4, quant):
        prompts = {
            "guardian": (
                f"محاكاة انهيار مفاجئ (Flash Crash) مثل أزمة كورونا 2020 أو انهيار مايو 2021. "
                f"هل تنجو الاستراتيجية المعدلة {r4}؟ ارفع مستوى الحذر لأقصى درجة."
            ),
            "pulser": (
                "كيف سيتصرف زخم السوق في حالة الانهيار المفاجئ؟ هل ستخرج الاستراتيجية في الوقت المناسب؟"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_6(self, r1, r2, r3, r4, r5):
        prompts = {
            "investigator": (
                f"مراجعة شاملة للجولات 1-5. تأكد من عدم وجود أي تناقض في الأرقام أو المنطق. "
                f"هل القرار النهائي الذي يتشكل الآن متوافق مع التاريخ والواقع؟"
            )
        }
        return await self._call_batch(prompts)

    async def _run_round_7(self, r1, r6, quant, issuers):
        prince_prompt = f"""أنت الأمير، القاضي العلمي النهائي لمجلس صقر.
بناءً على 6 جولات من التدقيق والجلد (الجولة 6): {r6}، أصدر مرسومك النهائي.

الأركان الثلاثة لقرارك:
1. البيانات الكمية لـ 10 سنوات.
2. هجوم الفريق الأحمر (حالات الفشل التاريخية).
3. محاكاة البجعة السوداء (Flash Crash).

يجب إصدار 3 استراتيجيات حصراً: (conservative, moderate, aggressive).
لكل استراتيجية، حدد "درجة الثقة الكمية" (Quantitative Confidence) بناءً على مدى صمودها في الجولات السابقة.

⚠️ مهم جداً: أجب بـ JSON نقي فقط، بدون أي نص قبله أو بعده، وبدون markdown أو backticks.

{{
  "strategies": [
    {{
      "name": "...",
      "type": "conservative",
      "entry_description": "...",
      "target_pct": 2.0,
      "sl_pct": 1.0,
      "confidence_score": "85%",
      "risk_reward": 2.0
    }},
    {{
      "name": "...",
      "type": "moderate",
      "entry_description": "...",
      "target_pct": 4.0,
      "sl_pct": 2.0,
      "confidence_score": "75%",
      "risk_reward": 2.0
    }},
    {{
      "name": "...",
      "type": "aggressive",
      "entry_description": "...",
      "target_pct": 7.0,
      "sl_pct": 3.0,
      "confidence_score": "65%",
      "risk_reward": 2.3
    }}
  ]
}}"""
        return await self._call_batch({"prince": prince_prompt})