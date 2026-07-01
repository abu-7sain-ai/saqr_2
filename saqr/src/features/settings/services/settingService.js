import { supabase } from '../../../services/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/**
 * Service for handling Settings data (Profile, Platforms, Notifications)
 */
export const settingService = {
  /**
   * Fetches the current user's profile and settings
   */
  async getProfile(userId) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

    if (error) throw error
    return data
  },

  /**
   * Updates public profile information
   */
  async updateProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Fetches all registered exchange configurations
   */
  async getExchangeConfigs(userId) {
    const { data, error } = await supabase
      .from('exchange_configs')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    return data
  },

  /**
   * Fetches all registered API keys for the user (Legacy)
   */
  async getMarketKeys(userId) {
    const { data, error } = await supabase.from('api_keys').select('*').eq('user_id', userId)

    if (error) throw error
    return data
  },

  /**
   * Securely saves trading platform keys
   * Syncs with market_apis table for Saqr Engine compatibility
   */
  async saveMarketKeys(
    userId,
    exchange,
    key_id,
    secret_key,
    is_paper = false,
    watch = true,
    control = false
  ) {
    try {
      const clean_key = (key_id || '').trim()
      const clean_secret = (secret_key || '').trim()

      // 1. Map exchange ID to DB Name and fixed UUID
      // Using fixed UUIDs because the markets table has RLS restricting SELECT for non-admins
      const marketNameMap = {
        binance: { name: 'بينانس (Binance)', id: '8758b29e-c75c-4389-9833-289b4b9b9195' },
        alpaca: { name: 'السوق الأمريكي (US Stocks)', id: 'ac173295-88ce-472d-8f92-9430c5e7514a' }
      }

      const marketInfo = marketNameMap[exchange] || { id: null }
      const marketId = marketInfo.id

      if (!marketId) {
        throw new Error(`Unsupported market exchange: ${exchange}`)
      }

      // 2. If BOTH keys are explicitly empty (user cleared them), DELETE the record
      if (clean_key === '' && (clean_secret === '' || clean_secret === null)) {
        await supabase.from('market_apis').delete().eq('user_id', userId).eq('market_id', marketId)
        await supabase
          .from('exchange_configs')
          .delete()
          .eq('user_id', userId)
          .eq('exchange_type', exchange)
        return { success: true, message: 'Deleted' }
      }

      // 3. Fetch existing record to check if we need to insert or update, and keep masked secret
      const { data: existingRecords } = await supabase
        .from('market_apis')
        .select('*')
        .eq('user_id', userId)
        .eq('market_id', marketId)
        .limit(1)
      const existing = existingRecords?.[0]

      let final_secret = clean_secret
      if (clean_secret === null || clean_secret === '********') {
        final_secret = existing?.historical_api_secret || clean_secret
      }

      // 4. Update or Insert into market_apis with CORRECT schema
      const marketApiData = {
        user_id: userId,
        market_id: marketId,
        historical_api_key: clean_key,
        historical_api_secret: final_secret,
        historical_connected: true,
        watch_api_key: watch ? clean_key : null,
        watch_api_secret: watch ? final_secret : null,
        watch_connected: watch,
        control_api_key: control ? clean_key : null,
        control_api_secret: control ? final_secret : null,
        control_connected: control,
        updated_at: new Date().toISOString()
      }

      if (existing?.id) {
        await supabase.from('market_apis').update(marketApiData).eq('id', existing.id)
      } else {
        await supabase.from('market_apis').insert(marketApiData)
      }

      console.log('Successfully saved to market_apis')

      // 5. Sync with exchange_configs (for legacy worker engine)
      await supabase.from('exchange_configs').upsert(
        {
          user_id: userId,
          exchange_type: exchange,
          api_key: clean_key,
          api_secret: final_secret,
          is_paper: is_paper,
          is_active: true
        },
        { onConflict: 'user_id,exchange_type' }
      )

      return { success: true }
    } catch (err) {
      console.error('Error in saveMarketKeys:', err)
      throw err
    }
  },

  /**
   * Tests connection to a platform via Backend
   */
  async testConnection(exchange, key_id, secret_key, is_paper = false) {
    try {
      const clean_key = (key_id || '').trim()
      const clean_secret = (secret_key || '').trim()

      const response = await fetch(`${BACKEND_URL}/api/v1/market/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exchange,
          key: clean_key,
          secret: clean_secret,
          is_paper
        })
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to test connection')
      }

      return await response.json()
    } catch (err) {
      console.error('Error in testConnection:', err)
      throw err
    }
  }
}
