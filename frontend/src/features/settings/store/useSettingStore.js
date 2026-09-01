import { create } from 'zustand'
import { settingService } from '../services/settingService'
import { supabase } from '../../../services/supabase'

const getSavedExpertModels = () => {
  try {
    const raw = localStorage.getItem('saqr_expert_models')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return {}
}

const getSavedExpertPrompts = () => {
  try {
    const raw = localStorage.getItem('saqr_expert_prompts')
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return {}
}

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
  expertPromptsForm: getSavedExpertPrompts(),
  expertModelsForm: getSavedExpertModels(),
  customExpertsForm: [],

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

      const dbModels = data.settings?.expert_models || {}
      const localModels = getSavedExpertModels()
      const mergedModels = { ...localModels, ...dbModels }
      const finalModels = Object.fromEntries(
        Object.entries(mergedModels).map(([k, v]) => [
          k,
          (v === 'groq/compound' || v === 'compound') ? 'openai/gpt-oss-120b' : v
        ])
      )

      if (Object.keys(finalModels).length > 0) {
        try { localStorage.setItem('saqr_expert_models', JSON.stringify(finalModels)) } catch (e) {}
      }

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
        expertPromptsForm: { ...getSavedExpertPrompts(), ...(data.settings?.expert_prompts || {}) },
        expertModelsForm: finalModels,
        customExpertsForm: data.settings?.custom_experts || [],
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

  setExpertPrompt: async (expertId, promptText) => {
    const updatedPrompts = { ...get().expertPromptsForm, [expertId]: promptText }
    set({ expertPromptsForm: updatedPrompts, success: null })
    try {
      localStorage.setItem('saqr_expert_prompts', JSON.stringify(updatedPrompts))
    } catch (e) {}

    // Auto-save to Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const currentSettings = get().profile?.settings || {}
        await supabase.from('profiles').update({
          settings: { ...currentSettings, expert_prompts: updatedPrompts }
        }).eq('id', user.id)
      }
    } catch (e) {
      console.warn('Auto-save expert prompt failed:', e)
    }
  },

  setExpertModel: async (expertId, modelName) => {
    const updatedModels = { ...get().expertModelsForm, [expertId]: modelName }
    set({ expertModelsForm: updatedModels, success: null })
    try {
      localStorage.setItem('saqr_expert_models', JSON.stringify(updatedModels))
    } catch (e) {}

    // Auto-save to Supabase immediately
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const currentSettings = get().profile?.settings || {}
        await supabase.from('profiles').update({
          settings: { ...currentSettings, expert_models: updatedModels }
        }).eq('id', user.id)
      }
    } catch (e) {
      console.warn('Auto-save expert model failed:', e)
    }
  },

  addCustomExpert: async (newExpert) => {
    const updatedCustom = [...get().customExpertsForm, newExpert]
    const updatedPrompts = { ...get().expertPromptsForm, [newExpert.id]: newExpert.defaultPrompt }
    const updatedModels = { ...get().expertModelsForm, [newExpert.id]: newExpert.model }
    set({
      customExpertsForm: updatedCustom,
      expertPromptsForm: updatedPrompts,
      expertModelsForm: updatedModels,
      success: null
    })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const currentSettings = get().profile?.settings || {}
        await supabase.from('profiles').update({
          settings: {
            ...currentSettings,
            custom_experts: updatedCustom,
            expert_prompts: updatedPrompts,
            expert_models: updatedModels
          }
        }).eq('id', user.id)
      }
    } catch (e) {}
  },

  deleteCustomExpert: async (expertId) => {
    const updatedCustom = get().customExpertsForm.filter(e => e.id !== expertId)
    const updatedPrompts = { ...get().expertPromptsForm }
    const updatedModels = { ...get().expertModelsForm }
    delete updatedPrompts[expertId]
    delete updatedModels[expertId]
    set({
      customExpertsForm: updatedCustom,
      expertPromptsForm: updatedPrompts,
      expertModelsForm: updatedModels,
      success: null
    })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        const currentSettings = get().profile?.settings || {}
        await supabase.from('profiles').update({
          settings: {
            ...currentSettings,
            custom_experts: updatedCustom,
            expert_prompts: updatedPrompts,
            expert_models: updatedModels
          }
        }).eq('id', user.id)
      }
    } catch (e) {}
  },

  /**
   * Save all settings to backend
   */
  saveAllSettings: async (userId) => {
    try {
      set({ saving: true, error: null, success: null })
      const { profileForm, notificationsForm, platformsForm } = get()

      // 1. Update Profile & Telegram & Expert Settings
      await settingService.updateProfile(userId, {
        full_name: profileForm.full_name,
        role: profileForm.role,
        settings: {
          ...(get().profile?.settings || {}),
          telegram_chat_id: notificationsForm.telegramChatId,
          openrouter_key: get().aiForm.openRouterKey,
          expert_prompts: get().expertPromptsForm || {},
          expert_models: get().expertModelsForm || {},
          custom_experts: get().customExpertsForm || []
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
