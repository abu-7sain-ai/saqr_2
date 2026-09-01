import { supabase } from '../../../services/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export const workerService = {
  /**
   * Fetch all workers for the current user
   */
  async getWorkers() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/workers`)
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) return data
      }
    } catch (e) {
      console.warn('Backend /api/v1/workers failed, falling back to Supabase:', e)
    }

    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workers:', error)
      return []
    }
    return data || []
  },

  async updateWorkerStatus(workerId, status) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/workers/${workerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      if (response.ok) return await response.json()
    } catch (e) {
      console.warn('Backend update worker status failed, falling back to Supabase:', e)
    }
    return await supabase.from('workers').update({ status }).eq('id', workerId)
  },

  async deleteWorker(workerId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/workers/${workerId}`, {
        method: 'DELETE'
      })
      if (response.ok) return await response.json()
    } catch (e) {
      console.warn('Backend delete worker failed, falling back to Supabase:', e)
    }
    return await supabase.from('workers').delete().eq('id', workerId)
  },

  async deleteAllStoppedWorkers() {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/workers/stopped`, {
        method: 'DELETE'
      })
      if (response.ok) return await response.json()
    } catch (e) {
      console.warn('Backend delete stopped workers failed, falling back to Supabase:', e)
    }
    return await supabase.from('workers').delete().eq('status', 'stopped')
  },

  async promoteWorker(workerId) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/v1/workers/${workerId}/promote`, {
        method: 'PATCH'
      })
      if (response.ok) return await response.json()
    } catch (e) {
      console.warn('Backend promote worker failed, falling back to Supabase:', e)
    }
    return await supabase.from('workers').update({ type: 'live' }).eq('id', workerId)
  },

  /**
   * Subscribe to real-time updates for workers
   */
  subscribeToWorkers(onUpdate) {
    return supabase
      .channel('workers_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe()
  },

  /**
   * Clone a strategy into a new worker
   */
  async cloneWorker(payload) {
    // 1. Logic for auto-naming should ideally happen on backend to ensure atomicity
    // But for now we call the new backend endpoint
    const response = await fetch(`${BACKEND_URL}/api/v1/workers/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const err = await response.json()
      throw new Error(err.detail || 'فشل استنساخ الموظف')
    }

    return await response.json()
  },

  /**
   * Fetch available cash balance from Alpaca
   */
  async getAvailableBalance() {
    const response = await fetch(`${BACKEND_URL}/api/v1/workers/balance`)
    if (!response.ok) throw new Error('فشل جلب الرصيد')
    const data = await response.json()
    return data.available_cash || 0
  },

  /**
   * Set liquidation parameters for a worker
   */
  async setLiquidation(workerId, payload) {
    const { data, error } = await supabase
      .from('workers')
      .update({
        pending_withdrawal_amount: payload.amount,
        withdrawal_mode: payload.mode
      })
      .eq('id', workerId)

    if (error) {
      console.error('Error setting liquidation:', error)
      throw error
    }
    return data
  },

  /**
   * Sum all withdrawn_amount across all workers
   */
  async getTotalFreedLiquidity() {
    const { data, error } = await supabase
      .from('workers')
      .select('withdrawn_amount')

    if (error) {
      console.error('Error fetching total freed liquidity:', error)
      return 0
    }

    return data.reduce((sum, w) => sum + (parseFloat(w.withdrawn_amount) || 0), 0)
  },

  _tradesCache: {},

  async getWorkerTrades(workerId, workerObj = null) {
    // 1. Instant return if cached within last 15 seconds
    const now = Date.now()
    if (this._tradesCache[workerId] && (now - this._tradesCache[workerId].timestamp < 15000)) {
      return this._tradesCache[workerId].data
    }

    try {
      // 2. Query Supabase directly in parallel (super fast < 100ms connection)
      const tradesPromise = supabase
        .from('trades')
        .select('*')
        .eq('worker_id', workerId)
        .order('entry_at', { ascending: false })

      const workerPromise = workerObj
        ? Promise.resolve({ data: workerObj })
        : supabase.from('workers').select('*').eq('id', workerId).single()

      const [{ data: tradesData }, { data: worker }] = await Promise.all([tradesPromise, workerPromise])

      const trades = tradesData || []
      const total_trades = trades.length
      const closed_trades = trades.filter(t => t.exit_at)
      const winning_trades = closed_trades.filter(t => (parseFloat(t.result) || 0) > 0)
      const losing_trades = closed_trades.filter(t => (parseFloat(t.result) || 0) < 0)
      const total_pnl = closed_trades.reduce((acc, t) => acc + (parseFloat(t.result) || 0), 0)
      const win_rate = closed_trades.length > 0 ? (winning_trades.length / closed_trades.length) * 100 : 0
      const traded_symbols = Array.from(new Set(trades.map(t => t.pair).filter(Boolean)))

      const result = {
        worker_id: workerId,
        worker_name: worker?.name,
        strategy_name: worker?.strategy_name || worker?.user_settings?.expert_signal?.name || 'تلقائي',
        starting_capital: parseFloat(worker?.starting_capital || 0),
        current_capital: parseFloat(worker?.current_capital || 0),
        summary: {
          total_trades,
          closed_trades: closed_trades.length,
          open_trades: total_trades - closed_trades.length,
          winning_trades: winning_trades.length,
          losing_trades: losing_trades.length,
          win_rate: parseFloat(win_rate.toFixed(2)),
          net_pnl: parseFloat(total_pnl.toFixed(2)),
          traded_symbols
        },
        trades
      }

      this._tradesCache[workerId] = { data: result, timestamp: now }
      return result
    } catch (err) {
      console.error('Error fetching worker trades:', err)
      return {
        worker_id: workerId,
        summary: { total_trades: 0, closed_trades: 0, open_trades: 0, winning_trades: 0, losing_trades: 0, win_rate: 0, net_pnl: 0, traded_symbols: [] },
        trades: []
      }
    }
  }
}
