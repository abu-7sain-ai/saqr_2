import React, { useState, useEffect } from 'react'
import { Save, Key, MessageSquare, Mail, Smartphone, Eye, EyeOff, Loader2 } from 'lucide-react'
import { supabase } from '../../../services/supabase'

const SystemSettingsTab = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    twilio_api_url: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    telegram_bot_token: '',
    require_email: true,
    require_sms: false,
    require_telegram: true
  })

  // Show/Hide token toggles
  const [showTwilioToken, setShowTwilioToken] = useState(false)
  const [showTelegramToken, setShowTelegramToken] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('system_settings').select('*').single()

      if (data) {
        setFormData({
          twilio_api_url: data.twilio_api_url || '',
          twilio_auth_token: data.twilio_auth_token || '',
          twilio_phone_number: data.twilio_phone_number || '',
          telegram_bot_token: data.telegram_bot_token || '',
          require_email: data.require_email ?? true,
          require_sms: data.require_sms ?? false,
          require_telegram: data.require_telegram ?? true
        })
      }
    } catch (err) {
      console.error('Error fetching settings:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('system_settings')
        .update(formData)
        .eq('id', (await supabase.from('system_settings').select('id').single()).data.id)

      if (error) throw error
      alert('تم حفظ الإعدادات بنجاح!')
    } catch (err) {
      console.error('Error saving settings:', err)
      alert('خطأ أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="d-flex justify-content-center py-5">
        <Loader2 className="animate-spin text-gold" size={40} />
      </div>
    )

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h5 className="text-white fw-bold m-0 mb-1">إعدادات النظام (System Configuration)</h5>
        <p className="text-secondary small m-0">
          تكوين بوابات الاتصال وشروط الدخول (Authentication Requirements)
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Dynamic Auth Toggles */}
        <div className="glass-panel p-4 mb-4 border-start border-3 border-gold border-opacity-75">
          <h6 className="text-gold fw-bold mb-3 d-flex align-items-center gap-2">
            <Key size={18} /> شروط توثيق الحساب (3-Way OTP)
          </h6>
          <p className="small text-secondary mb-4">
            عند تسجيل مستخدم جديد للمنصة، حدد الخطوات الأمنية الإجبارية التي لا يمكنه استخدام المنصة
            قبل تأكيدها:
          </p>

          <div className="row g-3">
            <div className="col-12 col-md-4">
              <div
                className={`p-3 rounded-3 border transition-all ${formData.require_email ? 'border-success bg-success bg-opacity-10' : 'border-secondary border-opacity-25 bg-dark'}`}
              >
                <div className="form-check form-switch p-0 d-flex justify-content-between align-items-center m-0">
                  <label
                    className={`form-check-label small d-flex align-items-center gap-2 ${formData.require_email ? 'text-success fw-bold' : 'text-secondary'}`}
                  >
                    <Mail size={16} /> تأكيد الإيميل
                  </label>
                  <input
                    className="form-check-input ms-3 m-0"
                    type="checkbox"
                    checked={formData.require_email}
                    onChange={(e) => setFormData({ ...formData, require_email: e.target.checked })}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div
                className={`p-3 rounded-3 border transition-all ${formData.require_sms ? 'border-primary bg-primary bg-opacity-10' : 'border-secondary border-opacity-25 bg-dark'}`}
              >
                <div className="form-check form-switch p-0 d-flex justify-content-between align-items-center m-0">
                  <label
                    className={`form-check-label small d-flex align-items-center gap-2 ${formData.require_sms ? 'text-primary fw-bold' : 'text-secondary'}`}
                  >
                    <Smartphone size={16} /> تأكيد الجوال (SMS)
                  </label>
                  <input
                    className="form-check-input ms-3 m-0"
                    type="checkbox"
                    checked={formData.require_sms}
                    onChange={(e) => setFormData({ ...formData, require_sms: e.target.checked })}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div
                className={`p-3 rounded-3 border transition-all ${formData.require_telegram ? 'border-info bg-info bg-opacity-10' : 'border-secondary border-opacity-25 bg-dark'}`}
              >
                <div className="form-check form-switch p-0 d-flex justify-content-between align-items-center m-0">
                  <label
                    className={`form-check-label small d-flex align-items-center gap-2 ${formData.require_telegram ? 'text-info fw-bold' : 'text-secondary'}`}
                  >
                    <MessageSquare size={16} /> تأكيد التليجرام
                  </label>
                  <input
                    className="form-check-input ms-3 m-0"
                    type="checkbox"
                    checked={formData.require_telegram}
                    onChange={(e) =>
                      setFormData({ ...formData, require_telegram: e.target.checked })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* API Tokens Configuration */}
        <div className="glass-panel p-4 mb-4 border-start border-3 border-primary border-opacity-50">
          <h6 className="text-primary fw-bold mb-4">بوابات الاتصال (API Tokens)</h6>

          <div className="row g-4">
            {/* Telegram Bot */}
            <div className="col-12">
              <label className="text-secondary mb-2 small fw-bold">
                Telegram Bot Token (للإرسال والتنبيهات)
              </label>
              <div className="input-group">
                <input
                  type={showTelegramToken ? 'text' : 'password'}
                  className="form-control bg-transparent border-white border-opacity-10 text-white font-monospace text-muted"
                  value={formData.telegram_bot_token}
                  onChange={(e) => setFormData({ ...formData, telegram_bot_token: e.target.value })}
                  placeholder="مثال: 123456789:ABCdefGhIjk..."
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary border-white border-opacity-10"
                  onClick={() => setShowTelegramToken(!showTelegramToken)}
                >
                  {showTelegramToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Twilio Divider */}
            <div className="col-12 mt-4 pt-3 border-top border-secondary border-opacity-25">
              <label className="text-secondary mb-2 small fw-bold">
                إعدادات مزود الرسائل (Twilio SMS)
              </label>
            </div>

            <div className="col-md-6">
              <label className="text-secondary mb-2 small">رقم هاتف المنصة (Sender)</label>
              <input
                type="text"
                className="form-control bg-transparent border-white border-opacity-10 text-white font-monospace"
                value={formData.twilio_phone_number}
                onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
                placeholder="+1234567890"
              />
            </div>

            <div className="col-md-6">
              <label className="text-secondary mb-2 small">Twilio Account SID (API URL Base)</label>
              <input
                type="text"
                className="form-control bg-transparent border-white border-opacity-10 text-white font-monospace"
                value={formData.twilio_api_url}
                onChange={(e) => setFormData({ ...formData, twilio_api_url: e.target.value })}
                placeholder="ACx...x..."
              />
            </div>

            <div className="col-12">
              <label className="text-secondary mb-2 small">Twilio Auth Token</label>
              <div className="input-group">
                <input
                  type={showTwilioToken ? 'text' : 'password'}
                  className="form-control bg-transparent border-white border-opacity-10 text-white font-monospace"
                  value={formData.twilio_auth_token}
                  onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                  placeholder="Token key..."
                />
                <button
                  type="button"
                  className="btn btn-outline-secondary border-white border-opacity-10"
                  onClick={() => setShowTwilioToken(!showTwilioToken)}
                >
                  {showTwilioToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-end mt-4">
          <button type="submit" className="btn btn-gold px-5 d-flex align-items-center gap-2">
            <Save size={18} /> حفظ إعدادات النظام الحساسة
          </button>
        </div>
      </form>
    </div>
  )
}

export default SystemSettingsTab
