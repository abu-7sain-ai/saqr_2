import { supabase } from '../../../services/supabase'

export const workerService = {
  /**
   * Fetch all workers for the current user
   */
  async getWorkers() {
    const { data, error } = await supabase
      .from('workers')
      .select('*')
      .order('number', { ascending: true })

    if (error) {
      console.error('Error fetching workers:', error)
      throw error
    }
    return data
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
    const response = await fetch('http://localhost:8000/api/v1/workers/clone', {
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
    const response = await fetch('http://localhost:8000/api/v1/workers/balance')
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
  }
}
