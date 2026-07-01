# Specification: Hunter Worker & Scientific Council 🦅⚖️ [CERTIFIED: PRODUCTION READY]

## 1. Problem Description
Saqr is evolving from a single-symbol advisor to a multi-symbol quantitative fund. The previous architecture was too slow and lacked the rigor needed for high-frequency scanning across multiple coins.

## 2. Intended Outcomes
- **Rigorous Decision Making:** Move from a 4-round "vibe" debate to a 7-round quantitative-first "Scientific Council."
- **Efficient Capital Scaling:** Implement the "Hunter Worker" capable of scanning the entire whitelist (50+ symbols) instead of one coin per worker.
- **Risk Mitigation:** Portfolio-aware concurrency management to limit total capital exposure across simultaneous trades.

## 3. Core Components

### A. The 7-Round Scientific Council (Kitchen)
The `StrategyFactory` must orchestrate the following sequence:
1. **Data Dissection:** Quantitative analysis of 10-year patterns.
2. **Hypotheses Generation:** Expert models propose entry/exit rules.
3. **Adversarial Attack (Red Team):** The Guardian attempts to find statistical flaws.
4. **Statistical Refinement:** Improving parameters based on the attack.
5. **Black Swan Simulation:** Stress-testing against historical crashes.
6. **Logical Audit:** Final verification of consistency.
7. **The Prince's Decree:** Final JSON strategy generation.
22. **Advanced Bonus:** Round 8 for memory-aware developed models (Powered by GPT-4o).

### B. The Hunter Worker (Executor)
The `WorkerExecutor` must be upgraded to:
- **Scan Mode:** Iterate through the `whitelist` table for the target market every **5 minutes** (as per `main.py` scheduler).
- **Concurrency Manager:**
  - `fixed_count` mode: Limit trades to X (e.g., 5).
  - `percentage` mode: Limit trades so total exposure < X% (e.g., 20%).
- **Selection Engine:** If multiple symbols trigger an entry at the same time, prioritize based on `success_rate` (historical stability).

## 4. Constraints & Requirements
- **Latency:** All 7 rounds must complete within 120 seconds.
- **Data Integrity:** Historical data must be fetched using CCXT and stored in Supabase with exact timestamps.
- **Concurrency:** Ensure no "Race Condition" where multiple workers buy the same coin simultaneously if they share the same capital pool.

## 5. UI Requirements
- **Simulation:** Visualize all 7 rounds with distinct icons and status indicators.
- **Portfolio Settings:** Add controls for Hunter mode and Concurrency limits in the Meeting Modal.
