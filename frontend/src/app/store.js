import { create } from 'zustand'

const useStore = create((set) => ({
  user: {
    name: 'أحمد الأمير',
    role: 'admin',
    isAuthenticated: true
  },
  marketStatus: {
    type: 'stable', // 'stable' | 'volatile'
    isConnected: true,
    platform: 'Alpaca'
  },
  advisor: {
    status: 'monitoring', // 'monitoring' | 'evaluating' | 'alert'
    lastMessage: 'تم اكتشاف نمط "رأس وكتفين" على زوج BTC/USDT'
  },
  notifications: [{ id: 1, type: 'info', message: 'مرحبا بك في منصة الصقر', time: new Date() }],

  // Actions
  setUser: (user) => set({ user }),
  setMarketStatus: (status) =>
    set((state) => ({
      marketStatus: { ...state.marketStatus, ...status }
    })),
  addNotification: (note) =>
    set((state) => ({
      notifications: [{ id: Date.now(), ...note }, ...state.notifications]
    })),
  clearNotifications: () => set({ notifications: [] })
}))

export default useStore
