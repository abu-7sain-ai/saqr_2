import axios from 'axios'
import { supabase } from '../../../services/supabase'

const defaultBackend =
  window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `http://${window.location.hostname}:8000`
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || defaultBackend

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000 // 30 seconds — allow enough time when database is busy with syncs
})

export const kitchenService = {
  /**
   * Fetch all sessions (Direct from Supabase for efficiency)
   */
  async getSessions() {
    return await supabase
      .from('kitchen_sessions')
      .select('*')
      .order('created_at', { ascending: false })
  },

  /**
   * Start a new session via FastAPI
   */
  async createSession(sessionData) {
    try {
      const response = await api.post('/api/v1/kitchen/sessions', sessionData)
      return { data: response.data, error: null }
    } catch (error) {
      console.error('KitchenService: createSession failed', error)
      return { data: null, error: error.response?.data?.detail || error.message }
    }
  },

  /**
   * Get detailed session info (Direct from Supabase or API)
   */
  async getSessionById(id) {
    const { data, error } = await supabase
      .from('kitchen_sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  },

  /**
   * Delete a session via FastAPI
   */
  async deleteSession(id) {
    try {
      await api.delete(`/api/v1/kitchen/sessions/${id}`)
      return { success: true }
    } catch (error) {
      console.error('KitchenService: deleteSession failed', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Delete all historical sessions via Supabase (or we could add a FastAPI route)
   */
  async deleteAllSessions() {
    try {
      const { error } = await supabase
        .from('kitchen_sessions')
        .delete()
        .neq('status', 'processing')
        .neq('status', 'pending')
      
      if (error) throw error
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  },

  /**
   * Fetch all active markets
   */
  async getMarkets() {
    const { data, error } = await supabase
      .from('markets')
      .select('*')
      .eq('is_active', true)

    if (error) throw error
    return data
  },

  /**
   * Fetch symbols for a specific market
   */
  async getMarketSymbols(marketId) {
    const { data, error } = await supabase
      .from('whitelist')
      .select('symbol')
      .eq('market_id', marketId)
      .eq('is_active', true)

    if (error) throw error
    return data || []
  },

  /**
   * Fetch workers for buddy selection
   */
  async getWorkers() {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, status')
      .eq('status', 'running')

    if (error) return []
    return data || []
  },

  /**
   * Check historical data coverage (FastAPI)
   * Returns: { data, ok: true } on success
   *          { ok: null, error } if backend unreachable (timeout/network)
   *          { ok: false, error } if backend responded with an error
   */
  async getHistoricalCoverage(symbol, timeframe = '4h', years = 10) {
    try {
      const response = await api.get('/api/v1/historical/coverage', {
        params: { symbol, timeframe, years }
      })
      return { data: response.data, ok: true }
    } catch (error) {
      const isNetworkError = !error.response // no response = backend unreachable/timeout
      return {
        ok: isNetworkError ? null : false,
        error: isNetworkError
          ? 'تعذّر الاتصال بالـ Backend. يمكنك المتابعة أو تشغيل المزامنة أولاً.'
          : (error.response?.data?.detail || error.message)
      }
    }
  },

  /**
   * Sync market data (FastAPI)
   */
  async syncMarket(marketId) {
    try {
      const response = await api.post('/api/v1/historical/sync-market', { market_id: marketId })
      return response.data
    } catch (error) {
      console.error('KitchenService: syncMarket failed', error)
      throw error
    }
  },

  /**
   * Fetch Advisor Report (FastAPI)
   */
  async getAdvisorReport() {
    try {
      const response = await api.get('/api/v1/kitchen/advisor-report')
      return response.data
    } catch (error) {
      console.error('KitchenService: getAdvisorReport failed', error)
      return { report: 'فشل جلب التقرير.' }
    }
  }
}
