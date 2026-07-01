# Technical Plan: Hunter & Scientific Council Implementation 🛠️📐

Following the clarified requirements, this plan outlines the technical changes needed to reach the "Implementation" phase.

## 1. Hunter Scanning Loop (Frequency: 5 min)
- **Target:** `backend/services/worker_engine.py` or the main scheduler.
- **Change:** Adjust the `APScheduler` or loop interval to execute every 300 seconds.
- **Logic:** Each scan will trigger a clean read of the `whitelist` table for the target market.

## 2. Quantitative Tie-Breaking (Priority: Success Rate)
- **Target:** `backend/services/worker_executor.py` -> `run()` method.
- **Change:** 
    1. Collect all symbols that trigger `should_enter`.
    2. Fetch their historical `success_rate` from the `pattern_matcher` or latest session reports.
    3. Sort candidates descending by `success_rate`.
    4. Execute entries up to the worker's concurrency limit.

## 3. Capital Segregation (Architecture: Independent)
- **Target:** `backend/services/worker_executor.py` -> `_check_enter`.
- **Change:** 
    - Ensure `available_cap` is strictly calculated using the specific `worker_id`'s `current_capital`.
    - No cross-worker capital checks. Each hunter is an island.

## 4. Council Persistence (Strict 7-Rounds)
- **Target:** `backend/services/factory.py` -> `run_session`.
- **Change:** 
    - Ensure the `asyncio` task for the session does not have a global timeout.
    - Implement a "Retrying logic" for individual AI rounds if the API fails, rather than skipping the round.
    - UI Update: Ensure the progress bar in `MeetingSimulation.jsx` stays in the current round until a positive confirmation from the backend is received.

## 5. Implementation Steps
1.  **Step 1:** Modify `factory.py` to ensure all 7 rounds are synchronous and persistent.
2.  **Step 2:** Update `worker_executor.py` with the 5-minute loop and Success-Rate sorting.
3.  **Step 3:** Finalize `MeetingModal.jsx` to pass the correct Hunter settings to the backend.
