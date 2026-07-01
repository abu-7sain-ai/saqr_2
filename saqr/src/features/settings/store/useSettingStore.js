import { create } from 'zustand'
import { settingService } from '../services/settingService'

export const useSettingStore = create((set, get) => ({
  profile: null,
  loading: false,
  saving: false,
  error: null,
  success: null,

  // Local form state (drafts)
  profileForm: {
    full_name: '',
    role: '',
    email: ''
  },
  platformsForm: {
    binanceKey: '',
    binanceSecret: '',
    binanceIsPaper: false,
    binanceWatch: true,
    binanceControl: false,
    alpacaKey: '',
    alpacaSecret: '',
    alpacaIsPaper: true,
    alpacaWatch: true,
    alpacaControl: false
  },
  platformsStatus: {
    binance: { connected: false, message: '', testing: false },
    alpaca: { connected: false, message: '', testing: false }
  },
  notificationsForm: {
    telegramChatId: ''
  },
  aiForm: {
    openRouterKey: ''
  },

  /**
   * Initialize state from database
   */
  fetchProfile: async (userId) => {
    try {
      set({ loading: true, error: null })
      const data = await settingService.getProfile(userId)
      const configs = await settingService.getExchangeConfigs(userId)

      const binance = configs.find((c) => c.exchange_type === 'binance')
      const alpaca = configs.find((c) => c.exchange_type === 'alpaca')

      set({
        profile: data,
        profileForm: {
          full_name: data.full_name || '',
          role: data.role || 'تريدر',
          email: data.email || ''
        },
        platformsForm: {
          binanceKey: binance?.api_key || '',
          binanceSecret: binance?.api_secret ? '********' : '',
          binanceIsPaper: binance?.is_paper ?? false,
          binanceWatch: binance?.watch_connected ?? true,
          binanceControl: binance?.control_connected ?? false,
          alpacaKey: alpaca?.api_key || '',
          alpacaSecret: alpaca?.api_secret ? '********' : '',
          alpacaIsPaper: alpaca?.is_paper ?? true,
          alpacaWatch: alpaca?.watch_connected ?? true,
          alpacaControl: alpaca?.control_connected ?? false
        },
        notificationsForm: {
          telegramChatId: data.settings?.telegram_chat_id || ''
        },
        aiForm: {
          openRouterKey: data.settings?.openrouter_key || ''
        },
        loading: false
      })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  /**
   * Test connection to a specific exchange
   */
  testPlatformConnection: async (exchange) => {
    try {
      const { platformsForm } = get()
      const key = platformsForm[`${exchange}Key`]
      const secret = platformsForm[`${exchange}Secret`]
      const isPaper = platformsForm[`${exchange}IsPaper`]

      if (!key || !secret || secret === '********') {
        throw new Error('يرجى إدخال مفتاح الـ API والسر أولاً.')
      }

      set((state) => ({
        platformsStatus: {
          ...state.platformsStatus,
          [exchange]: { ...state.platformsStatus[exchange], testing: true, message: '' }
        }
      }))

      const result = await settingService.testConnection(exchange, key, secret, isPaper)

      set((state) => ({
        platformsStatus: {
          ...state.platformsStatus,
          [exchange]: {
            connected: result.success,
            message: result.message,
            testing: false
          }
        }
      }))
    } catch (err) {
      set((state) => ({
        platformsStatus: {
          ...state.platformsStatus,
          [exchange]: { connected: false, message: err.message, testing: false }
        }
      }))
    }
  },

  /**
   * Update specific form fields
   */
  setFormField: (section, field, value) => {
    set((state) => ({
      [`${section}Form`]: { ...state[`${section}Form`], [field]: value },
      success: null
    }))
  },

  /**
   * Save all settings to backend
   */
  saveAllSettings: async (userId) => {
    try {
      set({ saving: true, error: null, success: null })
      const { profileForm, notificationsForm, platformsForm } = get()

      // 1. Update Profile & Telegram
      await settingService.updateProfile(userId, {
        full_name: profileForm.full_name,
        role: profileForm.role,
        settings: {
          telegram_chat_id: notificationsForm.telegramChatId,
          openrouter_key: get().aiForm.openRouterKey
        }
      })

      // 2. Save Keys (only if modified - not stars)
      // 2. Save or Delete Keys (always call to ensure sync)
      await settingService.saveMarketKeys(
        userId,
        'binance',
        platformsForm.binanceKey,
        platformsForm.binanceSecret === '********' ? null : platformsForm.binanceSecret,
        platformsForm.binanceIsPaper,
        platformsForm.binanceWatch,
        platformsForm.binanceControl
      )

      await settingService.saveMarketKeys(
        userId,
        'alpaca',
        platformsForm.alpacaKey,
        platformsForm.alpacaSecret === '********' ? null : platformsForm.alpacaSecret,
        platformsForm.alpacaIsPaper,
        platformsForm.alpacaWatch,
        platformsForm.alpacaControl
      )

      set({
        saving: false,
        success: 'تم حفظ كافة الإعدادات والمفاتيح بنجاح! 🦅✨'
      })
    } catch (err) {
      set({ error: err.message, saving: false })
    }
  },

  updateAiForm: (field, value) => {
    set((state) => ({
      aiForm: { ...state.aiForm, [field]: value }
    }))
  },

  clearStatus: () => set({ error: null, success: null })
}))
