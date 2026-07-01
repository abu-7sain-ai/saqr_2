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
    return workers.filter((worker) => {
      const matchesSearch = 
        !filters.search || 
        worker.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        worker.number.toString().includes(filters.search)
      
      const matchesStatus = filters.status === 'all' || worker.status === filters.status
      const matchesOwner = filters.owner === 'all' || worker.owner === filters.owner

      return matchesSearch && matchesStatus && matchesOwner
    })
  },

  updateStatus: async (id, status) => {
    // In a real app, this would call the service. For now, we update local state.
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, status } : w))
    }))
  },

  deleteWorker: (id) => {
    set((state) => ({
      workers: state.workers.filter((w) => w.id !== id)
    }))
  },

  deleteAllStoppedWorkers: () => {
    set((state) => ({
      workers: state.workers.filter((w) => w.status !== 'stopped')
    }))
  },

  promoteWorker: (id) => {
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? { ...w, type: 'live' } : w))
    }))
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
