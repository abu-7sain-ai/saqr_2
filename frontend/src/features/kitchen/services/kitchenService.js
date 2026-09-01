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
   * Delete a session via FastAPI and Supabase concurrently for instant response
   */
  async deleteSession(id) {
    try {
      // Fire FastAPI backend task cancel and direct Supabase delete in parallel
      api.delete(`/api/v1/kitchen/sessions/${id}`, { timeout: 3000 }).catch(() => {})
      await supabase.from('kitchen_sessions').delete().eq('id', id)
      return { success: true }
    } catch (error) {
      console.warn('Delete session error:', error)
      return { success: true }
    }
  },

  /**
   * Stop an active session immediately
   */
  async stopSession(id) {
    try {
      api.post(`/api/v1/kitchen/sessions/${id}/stop`, {}, { timeout: 3000 }).catch(() => {})
      await supabase
        .from('kitchen_sessions')
        .update({
          status: 'failed',
          expert_opinions: { error: 'تم إيقاف الجلسة بناءً على طلب المستخدم' }
        })
        .eq('id', id)
      return { success: true }
    } catch (error) {
      return { success: true }
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
   * Fetch smart whitelist groups definition
   */
  async getWhitelistGroups() {
    try {
      const response = await api.get('/api/v1/whitelist/groups')
      return response.data?.groups || []
    } catch (error) {
      console.warn('KitchenService: getWhitelistGroups failed, returning fallback defaults:', error)
      return [
        {
          id: 'leaders',
          name: '🔵 القادة',
          name_ar: 'القادة',
          description: 'العملات القيادية الأعلى سيولة وتأثيراً في السوق',
          color: '#3b82f6',
          symbol_count: 7,
          symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'ETH/BTC']
        },
        {
          id: 'layer1',
          name: '🟢 الطبقة الأولى',
          name_ar: 'الطبقة الأولى',
          description: 'بلوكتشينات الجيل القادم عالية الأداء',
          color: '#22c55e',
          symbol_count: 26,
          symbols: ['ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'NEAR/USDT', 'ATOM/USDT', 'ICP/USDT', 'SUI/USDT', 'TON/USDT', 'FTM/USDT', 'HBAR/USDT', 'TIA/USDT', 'SEI/USDT']
        },
        {
          id: 'defi_layer2',
          name: '🟡 DeFi والطبقة الثانية',
          name_ar: 'ديفاي والطبقة الثانية',
          description: 'بروتوكولات التمويل اللامركزي وحلول التوسع',
          color: '#eab308',
          symbol_count: 15,
          symbols: ['ARB/USDT', 'OP/USDT', 'LINK/USDT', 'GRT/USDT', 'STX/USDT', 'RENDER/USDT', 'WLD/USDT', 'PYTH/USDT']
        },
        {
          id: 'classic',
          name: '⚪ الكلاسيكيات',
          name_ar: 'الكلاسيكيات',
          description: 'العملات الكلاسيكية الموثوقة ذات التاريخ الطويل',
          color: '#94a3b8',
          symbol_count: 29,
          symbols: ['XRP/USDT', 'LTC/USDT', 'BCH/USDT', 'XMR/USDT', 'XLM/USDT', 'ETC/USDT', 'DOGE/USDT', 'TRX/USDT', 'VET/USDT', 'FIL/USDT', 'THETA/USDT']
        }
      ]
    }
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
