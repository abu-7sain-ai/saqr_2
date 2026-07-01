import React, { useState, useEffect } from 'react'
import {
  Mail,
  Smartphone,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  Send,
  Loader2
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../context/AuthContext'

const VerificationWizard = ({ onComplete }) => {
  const { user, profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(1) // 1: Email, 2: Mobile, 3: Telegram, 4: Success
  const [codes, setCodes] = useState({ email: '', mobile: '', telegram: '' })

  // These toggles come from system_settings
  const [requirements, setRequirements] = useState({
    email: true,
    mobile: false,
    telegram: true
  })

  useEffect(() => {
    fetchRequirements()
  }, [])

  const fetchRequirements = async () => {
    try {
      const { data } = await supabase.from('system_settings').select('*').single()
      if (data) {
        setRequirements({
          email: data.require_email,
          mobile: data.require_sms,
          telegram: data.require_telegram
        })

        // Auto-skip steps if not required
        if (!data.require_email) {
          if (data.require_sms) setCurrentStep(2)
          else if (data.require_telegram) setCurrentStep(3)
          else setCurrentStep(4)
        }
      }
    } catch (err) {
      console.error('Error fetching requirements:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = async () => {
    let updateData = {}

    // Step-specific updates
    if (currentStep === 1) updateData = { is_email_verified: true }
    if (currentStep === 2) updateData = { is_phone_verified: true }
    if (currentStep === 3) updateData = { telegram_chat_id: 'pending_id_sync' } // Placeholder for real sync

    if (Object.keys(updateData).length > 0) {
      try {
        await supabase.from('profiles').update(updateData).eq('id', user.id)
        await refreshProfile()
      } catch (err) {
        console.error('Verification update error:', err)
      }
    }

    let next = currentStep + 1
    if (next === 2 && !requirements.mobile) next = 3
    if (next === 3 && !requirements.telegram) next = 4

    if (next > 3) {
      setCurrentStep(4)
      setTimeout(() => onComplete && onComplete(), 2000)
    } else {
      setCurrentStep(next)
    }
  }

  if (loading)
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-darker">
        <Loader2 className="animate-spin text-gold" size={48} />
      </div>
    )
  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100 bg-darker p-3">
      <div
        className="glass-panel p-5 text-center shadow-lg animate-fade-in"
        style={{ maxWidth: '500px', borderTop: '4px solid var(--saqr-gold)' }}
      >
        {/* Step Progress Icons */}
        <div className="d-flex justify-content-center gap-4 mb-5">
          <div className={`step-icon ${currentStep >= 1 ? 'active' : ''}`}>
            <Mail size={20} />
          </div>
          <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`} />
          <div className={`step-icon ${currentStep >= 2 ? 'active' : ''}`}>
            <Smartphone size={20} />
          </div>
          <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`} />
          <div className={`step-icon ${currentStep >= 3 ? 'active' : ''}`}>
            <MessageSquare size={20} />
          </div>
        </div>

        {/* Step 1: Email Verification */}
        {currentStep === 1 && (
          <div className="animate-slide-up">
            <h3 className="text-white fw-bold mb-3">تأكيد البريد الإلكتروني</h3>
            <p className="text-secondary mb-4">
              أرسلنا رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني. يرجى إدخاله للمتابعة.
            </p>
            <input
              type="text"
              className="form-control form-control-lg bg-dark border-secondary border-opacity-25 text-white text-center font-monospace mb-4"
              placeholder="000000"
              maxLength={6}
              value={codes.email}
              onChange={(e) => setCodes({ ...codes, email: e.target.value })}
            />
            <button
              className="btn btn-gold w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2"
              onClick={handleNext}
            >
              تأكيد وإستمرار <ArrowRight size={20} />
            </button>
            <button className="btn btn-link text-secondary mt-3 text-decoration-none small">
              إعادة إرسال الرمز
            </button>
          </div>
        )}

        {/* Step 2: Mobile Verification */}
        {currentStep === 2 && (
          <div className="animate-slide-up">
            <h3 className="text-white fw-bold mb-3">تأكيد رقم الجوال</h3>
            <p className="text-secondary mb-4">
              أدخل رمز الـ SMS الذي وصلك على هاتفك المرتبط برقمك الدولي.
            </p>
            <input
              type="text"
              className="form-control form-control-lg bg-dark border-secondary border-opacity-25 text-white text-center font-monospace mb-4"
              placeholder="000000"
              maxLength={6}
            />
            <button
              className="btn btn-primary w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2"
              onClick={handleNext}
            >
              تأكيد الجوال <ArrowRight size={20} />
            </button>
          </div>
        )}

        {/* Step 3: Telegram Verification */}
        {currentStep === 3 && (
          <div className="animate-slide-up">
            <h3 className="text-white fw-bold mb-3">ربط بوت التليجرام</h3>
            <p className="text-secondary mb-4">
              اضغط على الزر أدناه لمراسلة بوت الصقر، ثم أرسل له كلمة <code>/verify</code> للحصول على
              رمز التأكيد الرقمي.
            </p>
            <div className="d-grid gap-3 mb-4">
              <a
                href="https://t.me/SaqrPlatformBot"
                target="_blank"
                rel="noreferrer"
                className="btn btn-info text-white py-2 d-flex align-items-center justify-content-center gap-2"
              >
                <Send size={18} /> فتح بوت الصقر
              </a>
              <input
                type="text"
                className="form-control form-control-lg bg-dark border-secondary border-opacity-25 text-white text-center font-monospace"
                placeholder="رمز التليجرام"
                maxLength={6}
              />
            </div>
            <button className="btn btn-gold w-100 py-3 fw-bold" onClick={handleNext}>
              إتمام التوثيق الأمني
            </button>
          </div>
        )}

        {/* Step 4: Success */}
        {currentStep === 4 && (
          <div className="animate-fade-in text-center py-4">
            <div className="mb-4 text-success animate-bounce">
              <CheckCircle size={80} />
            </div>
            <h3 className="text-white fw-bold mb-2">تم التوثيق بنجاح!</h3>
            <p className="text-secondary">
              أهلاً بك في منصة الصقر للتداول الذكي. جاري توجيهك للوحة التحكم...
            </p>
          </div>
        )}
      </div>

      <style>{`
        .step-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: #666; transition: all 0.3s; }
        .step-icon.active { background: var(--saqr-gold); color: #000; box-shadow: 0 0 15px rgba(212, 175, 55, 0.4); }
        .step-line { flex-grow: 1; height: 2px; background: rgba(255,255,255,0.05); align-self: center; }
        .step-line.active { background: var(--saqr-gold); }
        .animate-bounce { animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 20%, 50%, 80%, 100% {transform: translateY(0);} 40% {transform: translateY(-20px);} 60% {transform: translateY(-10px);} }
      `}</style>
    </div>
  )
}

export default VerificationWizard
