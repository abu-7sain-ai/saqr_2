import { create } from 'zustand'
import { workerService } from '../services/workerService'

export const useWorkerStore = create((set, get) => ({
  workers: [],
  isLoading: false,
  error: null,
  filters: {
    search: '',
    status: 'all', // 'all' | 'running' | 'stopped' | 'paused'
    owner: 'all'   // 'all' | 'prince' | 'king' | 'sniper'
  },

  // Actions
  fetchWorkers: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await workerService.getWorkers()
      set({ workers: data, isLoading: false })
    } catch (err) {
      set({ error: err.message, isLoading: false })
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    }))
  },

  getFilteredWorkers: () => {
    const { workers, filters } = get()
    const filtered = (workers || []).filter((worker) => {
      const searchLower = (filters.search || '').toLowerCase().trim()
      const matchesSearch = 
        !searchLower || 
        (worker.name && worker.name.toLowerCase().includes(searchLower)) ||
        (worker.number && worker.number.toString().includes(searchLower)) ||
        (worker.strategy_name && worker.strategy_name.toLowerCase().includes(searchLower))
      
      const matchesStatus = filters.status === 'all' || worker.status === filters.status
      const matchesOwner = filters.owner === 'all' || worker.owner === filters.owner

      return matchesSearch && matchesStatus && matchesOwner
    })

    // ✅ ترتيب الموظفين: الحديث فوق دائماً (الأحدث أولاً)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      if (dateA !== dateB) return dateB - dateA
      return (b.number || 0) - (a.number || 0)
    })
  },

  updateStatus: async (id, status) => {
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, status } : w))
    }))
    try {
      await workerService.updateWorkerStatus(id, status)
    } catch (err) {
      console.error('Error updating worker status:', err)
    }
  },

  deleteWorker: async (id) => {
    set((state) => ({
      workers: state.workers.filter((w) => w.id !== id)
    }))
    try {
      await workerService.deleteWorker(id)
    } catch (err) {
      console.error('Error deleting worker:', err)
    }
  },

  deleteAllStoppedWorkers: async () => {
    set((state) => ({
      workers: state.workers.filter((w) => w.status !== 'stopped')
    }))
    try {
      await workerService.deleteAllStoppedWorkers()
    } catch (err) {
      console.error('Error deleting stopped workers:', err)
    }
  },

  promoteWorker: async (id) => {
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, type: 'live' } : w))
    }))
    try {
      await workerService.promoteWorker(id)
    } catch (err) {
      console.error('Error promoting worker:', err)
    }
  },

  requestLiquidation: async (id, amount, mode) => {
    try {
      await workerService.setLiquidation(id, { amount, mode })
      // Local state will be updated via real-time subscription
    } catch (err) {
      set({ error: err.message })
      throw err
    }
  },

  // Real-time update handler
  handleRealtimeUpdate: (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    const { workers } = get()

    let updatedWorkers = [...workers]

    if (eventType === 'INSERT') {
      updatedWorkers = [newRecord, ...updatedWorkers]
    } else if (eventType === 'UPDATE') {
      updatedWorkers = updatedWorkers.map((w) =>
        w.id === newRecord.id ? { ...w, ...newRecord } : w
      )
    } else if (eventType === 'DELETE') {
      updatedWorkers = updatedWorkers.filter((w) => w.id !== oldRecord.id)
    }

    set({ workers: updatedWorkers })
  }
}))
