import { create } from 'zustand'
import { kitchenService } from '../services/kitchenService'

export const useKitchenStore = create((set, get) => ({
  sessions: [],
  isLoading: false,
  error: null,
  filters: {
    marketType: 'all' // 'all' | 'stable' | 'volatile'
  },

  /**
   * Fetch historical sessions
   */
  fetchSessions: async () => {
    set({ isLoading: true, error: null })
    const { data, error } = await kitchenService.getSessions()
    if (error) {
      set({ error, isLoading: false })
    } else {
      set({ sessions: data || [], isLoading: false })
    }
  },

  /**
   * Update a specific filter
   */
  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    }))
  },

  /**
   * Get sessions based on current filters
   */
  getFilteredSessions: () => {
    const { sessions, filters } = get()
    return sessions.filter((session) => {
      const matchesMarketType = 
        filters.marketType === 'all' || 
        session.market_type === filters.marketType
      
      return matchesMarketType
    })
  },

  /**
   * Start a new session
   */
  createSession: async (config) => {
    set({ isLoading: true, error: null })
    const { data, error } = await kitchenService.createSession(config)
    if (error) {
      set({ error, isLoading: false })
      return { success: false, error }
    }

    // ✅ FIX: backend بيرجع { session_id, status } — نحوله لـ object بـ .id
    // عشان الـ sessions list وأي كود تاني يشتغل صح
    const sessionObj = data?.id ? data : { ...data, id: data?.session_id, status: data?.status || 'pending' }

    // ما بنضيفوش للقايمة هنا لأن الـ polling هيجيب الجلسة الكاملة من Supabase
    set({ isLoading: false })

    return { success: true, data: sessionObj }
  },

  /**
   * Delete a session
   */
  deleteSession: async (id) => {
    const { success, error } = await kitchenService.deleteSession(id)
    if (success) {
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id)
      }))
    }
    return { success, error }
  },

  /**
   * Clear all non-active sessions
   */
  deleteAllSessions: async () => {
    const { success, error } = await kitchenService.deleteAllSessions()
    if (success) {
      set((state) => ({
        sessions: state.sessions.filter((s) => 
          s.status === 'processing' || s.status === 'pending'
        )
      }))
    }
    return { success, error }
  }
}))
