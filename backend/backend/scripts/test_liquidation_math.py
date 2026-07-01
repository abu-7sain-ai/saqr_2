# Simulation: Second-By-Second Liquidation Math Check

def simulate_liquidation(starting_cap, trade_size, pnl, target_withdrawal):
    print(f"--- START SIMULATION ---")
    print(f"Starting Capital: ${starting_cap}")
    print(f"Trade Size: ${trade_size}")
    print(f"PnL: ${pnl}")
    print(f"Target Withdrawal: ${target_withdrawal}")
    
    # 1. Trade Closes
    returned_equity = trade_size + pnl
    total_equity_before_sweep = starting_cap + pnl
    
    print(f"1. Total Equity before sweep: ${total_equity_before_sweep}")
    print(f"2. Cash returned from trade: ${returned_equity}")
    
    # 2. Apply First-Proceeds Sweep Logic
    pending = target_withdrawal
    withdrawn = 0
    
    sweep_amount = min(returned_equity, pending)
    
    # 3. Final Results
    final_capital = total_equity_before_sweep - sweep_amount
    withdrawn = sweep_amount
    
    print(f"--- FINAL RESULTS ---")
    print(f"Cash Freed to Pool: ${withdrawn}")
    print(f"Remaining Capital for Worker: ${final_capital}")
    print(f"----------------------\n")
    return final_capital, withdrawn

print("Testing Scenario A (Profit 10$):")
simulate_liquidation(1000, 100, 10, 50)

print("Testing Scenario B (Loss -30$):")
simulate_liquidation(1000, 100, -30, 50)
