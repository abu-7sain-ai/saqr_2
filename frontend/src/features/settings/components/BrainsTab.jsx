import React, { useState } from 'react'
import {
  Cpu,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Zap,
  Activity,
  Brain,
  Network,
  Database
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../context/AuthContext'
import { useSettingStore } from '../store/useSettingStore'

const BrainsTab = () => {
  const { user } = useAuth()
  const { aiForm, updateAiForm, profile, saveAllSettings, saving } = useSettingStore()
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isDevelopedEnabled, setIsDevelopedEnabled] = useState(true)
  const [isEditingOpenRouter, setIsEditingOpenRouter] = useState(false)

  const handleResetTraining = async () => {
    setResetting(true)
    try {
      const { error } = await supabase.from('activity_logs').insert({
        user_id: user.id,
        type: 'model_reset',
        message: 'تم تصفير بيانات تدريب المطور (LSTM Memory Reset)',
        metadata: { timestamp: new Date().toISOString(), agent: 'Settings UI' }
      })

      if (error) throw error

      alert('تم تصفير ذاكرة المطور بنجاح. سيبدأ العقل المطور بالتعلم من جديد من الصفقات القادمة.')
      setShowConfirm(false)
    } catch (err) {
      alert('خطأ أثناء التصفير: ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const mindTypes = [
    {
      name: 'التحليلي (Reactive)',
      desc: 'يشوف البيانات الحالية ويرد فوراً.',
      icon: <Zap size={16} />,
      color: 'text-info'
    },
    {
      name: 'العرّافي (Case-Based)',
      desc: 'يقارن الوضع الحالي بـ 10 سنوات من التاريخ.',
      icon: <Activity size={16} />,
      color: 'text-purple'
    },
    {
      name: 'التنبؤي (Predictive)',
      desc: 'يعطي احتمالية مستقبلية بدقة رقمية.',
      icon: <Brain size={16} />,
      color: 'text-gold'
    },
    {
      name: 'الحسابي (Utility-Based)',
      desc: 'يحسب ربح/مخاطرة رياضياً ويختار الأفضل.',
      icon: <Network size={16} />,
      color: 'text-success'
    },
    {
      name: 'LSTM (Deep Learning)',
      desc: 'يتعلم من صفقاتنا الحقيقية تحديداً عبر Keras.',
      icon: <Database size={16} />,
      color: 'text-ruby'
    },
    {
      name: 'متعدد العقول (MAS)',
      desc: 'مجموعة عقول تتناقش وتتفق على قرار.',
      icon: <ShieldCheck size={16} />,
      color: 'text-emerald'
    },
    {
      name: 'عقل التعلم (Learning)',
      desc: 'يتحسن مع كل صفقة جديدة أوتوماتيكياً.',
      icon: <RefreshCw size={16} />,
      color: 'text-warning'
    }
  ]

  // Check if key is actually saved in DB (not just typed in the draft)
  const hasKey = Boolean(profile?.settings?.openrouter_key)

  return (
    <div className="animate-fade-in pb-5">
      {/* Header */}
      <div className="d-flex align-items-center gap-3 mb-5">
        <div className="p-3 bg-gold bg-opacity-10 rounded-4 text-gold shadow-gold-sm border border-gold border-opacity-20">
          <Cpu size={28} />
        </div>
        <div>
          <h4 className="m-0 fw-black text-white">جدول العقول والذكاء الاصطناعي</h4>
          <p className="small text-secondary m-0">إدارة البنية التحتية الإدراكية لمنصة صقر</p>
        </div>
      </div>

      <div className="row g-4">
        {/* Table of Minds */}
        <div className="col-12 col-xl-8">
          <div className="glass-card p-4 border-white border-opacity-5 h-100">
            <h6 className="text-gold fw-bold mb-4 d-flex align-items-center gap-2">
              <Brain size={18} /> أنواع العقول في المنصة
            </h6>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle border-0">
                <thead>
                  <tr className="text-secondary extra-small border-bottom border-white border-opacity-10">
                    <th className="pb-3 border-0">نوع العقل</th>
                    <th className="pb-3 border-0">الوصف والآلية</th>
                    <th className="pb-3 border-0 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="border-0">
                  {mindTypes.map((mind, idx) => (
                    <tr key={idx} className="border-bottom border-white border-opacity-5">
                      <td className="py-3 border-0">
                        <div className="d-flex align-items-center gap-2">
                          <div className={`p-2 rounded-3 bg-dark ${mind.color} bg-opacity-20`}>
                            {mind.icon}
                          </div>
                          <span className="small fw-bold text-white">{mind.name}</span>
                        </div>
                      </td>
                      <td className="py-3 border-0">
                        <span className="extra-small text-silver opacity-75">{mind.desc}</span>
                      </td>
                      <td className="py-3 border-0 text-center">
                        {hasKey ? (
                          <div className="pulse-led-green mx-auto" title="جاهز للعمل"></div>
                        ) : (
                          <div
                            className="mx-auto"
                            style={{
                              width: '8px',
                              height: '8px',
                              backgroundColor: '#495057',
                              borderRadius: '50%'
                            }}
                            title="غير متصل - بانتظار المفتاح"
                          ></div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Distribution & Settings */}
        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-4 h-100">
            {/* Distribution Card */}
            <div className="glass-card p-4 border-gold border-opacity-10">
              <h6 className="text-white fw-bold mb-4 d-flex align-items-center gap-2">
                <Network size={18} className="text-gold" /> توزيع العقول على الخبراء
              </h6>
              <div className="d-flex flex-column gap-3">
                {/* Card 1: All 8 Experts */}
                <div
                  className="p-3 rounded-4 border"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderColor: 'rgba(255,255,255,0.08)'
                  }}
                >
                  <div
                    className="extra-small fw-black text-secondary text-uppercase mb-2"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    كل الخبراء الثمانية
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <span className="badge bg-dark border border-white border-opacity-10 text-white small">
                      ⚡ تحليلي
                    </span>
                    <span className="badge bg-dark border border-white border-opacity-10 text-white small">
                      🔮 عرّافي
                    </span>
                  </div>
                </div>

                {/* Card 2: العادي */}
                <div
                  className="p-3 rounded-4 border"
                  style={{ background: 'rgba(255,215,0,0.04)', borderColor: 'rgba(255,215,0,0.2)' }}
                >
                  <div
                    className="extra-small fw-black text-uppercase mb-2"
                    style={{ color: '#FFD700', letterSpacing: '0.08em' }}
                  >
                    العادي — إضافة
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <span className="badge text-dark small" style={{ background: '#FFD700' }}>
                      📈 تنبؤي جزئي
                    </span>
                    <span className="badge text-dark small" style={{ background: '#FFD700' }}>
                      🧮 حسابي
                    </span>
                  </div>
                </div>

                {/* Card 3: المطور */}
                <div
                  className="p-3 rounded-4 border"
                  style={{ background: 'rgba(255,0,85,0.05)', borderColor: 'rgba(255,0,85,0.25)' }}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div
                      className="extra-small fw-black text-uppercase"
                      style={{ color: '#ff0055', letterSpacing: '0.08em' }}
                    >
                      المطور — إضافة
                    </div>
                    <span
                      className="badge text-white"
                      style={{
                        background: isDevelopedEnabled ? '#10b981' : '#ff0055',
                        fontSize: '9px'
                      }}
                    >
                      {isDevelopedEnabled ? '🟢 مفعّل' : '🔴 موقوف'}
                    </span>
                  </div>
                  <div className="d-flex gap-2 flex-wrap mb-3">
                    <span className="badge text-white small" style={{ background: '#ff0055' }}>
                      🧠 تنبؤي كامل
                    </span>
                    <span className="badge text-white small" style={{ background: '#ff0055' }}>
                      🔁 عقل التعلم
                    </span>
                    <span className="badge text-white small" style={{ background: '#7c3aed' }}>
                      📊 LSTM
                    </span>
                  </div>
                  <div className="d-flex flex-column gap-1">
                    <div className="d-flex justify-content-between">
                      <span className="extra-small text-secondary">عمر العقل:</span>
                      <span className="extra-small text-white fw-bold">0 يوم</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="extra-small text-secondary">الصفقات المتعلَّمة:</span>
                      <span className="extra-small text-white fw-bold">0 صفقة</span>
                    </div>
                    <div className="d-flex justify-content-between">
                      <span className="extra-small text-secondary">دقة التوقع:</span>
                      <span className="extra-small fw-bold" style={{ color: '#10b981' }}>
                        في الانتظار...
                      </span>
                    </div>
                  </div>
                  <div
                    className="progress mt-2"
                    style={{ height: '4px', background: 'rgba(255,255,255,0.05)' }}
                  >
                    <div
                      className="progress-bar"
                      style={{ width: '0%', background: '#ff0055' }}
                    ></div>
                  </div>
                  <p
                    className="extra-small text-secondary text-center mt-1 mb-0"
                    style={{ fontSize: '10px' }}
                  >
                    في انتظار أول صفقة للتعلم
                  </p>
                </div>

                {/* Card 4: Kitchen (MAS) */}
                <div
                  className="p-3 rounded-4 border"
                  style={{
                    background: 'rgba(16,185,129,0.05)',
                    borderColor: 'rgba(16,185,129,0.2)'
                  }}
                >
                  <div
                    className="extra-small fw-black text-uppercase mb-2"
                    style={{ color: '#10b981', letterSpacing: '0.08em' }}
                  >
                    المطبخ كاملاً
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <span className="badge text-dark small" style={{ background: '#10b981' }}>
                      🕸️ متعدد العقول (MAS)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* API Settings Card */}
            <div className="glass-card p-4 border-gold border-opacity-10 mb-4">
              <h6 className="text-white fw-bold mb-3 d-flex align-items-center gap-2">
                <Brain size={18} className="text-gold" /> إعدادات اتصال الذكاء الاصطناعي
              </h6>

              <div className="mb-0">
                <label className="form-label text-secondary small fw-bold">
                  مفتاح OpenRouter API
                </label>
                <div className="d-flex gap-2">
                  {hasKey && !isEditingOpenRouter ? (
                    <>
                      <input
                        type="password"
                        className="form-control bg-dark border-white border-opacity-10 text-white"
                        value="sk-or-v1-••••••••••••••••••••••••"
                        disabled
                      />
                      <button
                        onClick={() => setIsEditingOpenRouter(true)}
                        className="btn btn-outline-secondary fw-bold d-flex align-items-center gap-2"
                      >
                        تعديل
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        type="password"
                        className="form-control bg-dark border-white border-opacity-10 text-white"
                        placeholder="sk-or-v1-..."
                        value={aiForm?.openRouterKey || ''}
                        onChange={(e) => updateAiForm('openRouterKey', e.target.value)}
                      />
                      <button
                        onClick={() => {
                          saveAllSettings(user.id)
                          setIsEditingOpenRouter(false)
                        }}
                        disabled={saving}
                        className="btn btn-gold fw-bold d-flex align-items-center gap-2"
                      >
                        {saving ? (
                          <RefreshCw size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}
                        حفظ
                      </button>
                      {hasKey && (
                        <button
                          onClick={() => {
                            setIsEditingOpenRouter(false)
                            updateAiForm('openRouterKey', profile?.settings?.openrouter_key || '')
                          }}
                          className="btn btn-outline-danger fw-bold d-flex align-items-center gap-2"
                        >
                          إلغاء
                        </button>
                      )}
                    </>
                  )}
                </div>
                <div className="form-text text-silver extra-small mt-2 opacity-75">
                  هذا المفتاح ضروري لتشغيل العقول الذكية (المطور، المطبخ). إذا تركته فارغاً، سيحاول
                  النظام استخدام المفتاح الافتراضي في ملف .env.
                </div>
              </div>
            </div>

            {/* Developed Settings Card */}
            <div className="glass-card p-4 border-ruby border-opacity-10">
              <h6 className="text-white fw-bold mb-4 d-flex align-items-center gap-2">
                <Zap size={18} className="text-ruby" /> المطور — إعدادات خاصة
              </h6>

              <div className="d-flex gap-2 mb-4">
                <button
                  onClick={() => setIsDevelopedEnabled(true)}
                  className={`btn flex-grow-1 py-3 rounded-4 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${isDevelopedEnabled ? 'bg-success text-white shadow-success-sm' : 'bg-dark text-secondary border border-white border-opacity-10'}`}
                >
                  <CheckCircle2 size={16} /> شغّل المطور
                </button>
                <button
                  onClick={() => setIsDevelopedEnabled(false)}
                  className={`btn flex-grow-1 py-3 rounded-4 fw-bold d-flex align-items-center justify-content-center gap-2 transition-all ${!isDevelopedEnabled ? 'bg-ruby text-white shadow-ruby-sm' : 'bg-dark text-secondary border border-white border-opacity-10'}`}
                >
                  <XCircle size={16} /> أوقف المطور
                </button>
              </div>

              <div className="p-3 rounded-4 bg-ruby bg-opacity-5 border border-ruby border-opacity-10">
                <h6 className="text-ruby fw-bold mb-2 small">منطقة الخطر: تصفير التدريب</h6>
                <p className="extra-small text-secondary mb-3">
                  سيُمسح كل تدريب المطور ويبدأ من صفر. لا يتأثر تاريخ الصفقات في Supabase.
                </p>

                {!showConfirm ? (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="btn btn-outline-ruby btn-sm w-100 fw-bold py-2"
                  >
                    تصفير بيانات تدريب المطور
                  </button>
                ) : (
                  <div className="animate-fade-in">
                    <div
                      className="alert alert-ruby p-3 extra-small mb-3 text-white border-0"
                      style={{ background: 'rgba(255, 0, 85, 0.2)' }}
                    >
                      ⚠️ <strong>هل أنت متأكد؟</strong> لا يمكن التراجع عن هذا الإجراء.
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={handleResetTraining}
                        disabled={resetting}
                        className="btn btn-ruby btn-sm flex-grow-1 fw-bold py-2"
                      >
                        {resetting ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          'نعم، متأكد'
                        )}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        disabled={resetting}
                        className="btn btn-outline-secondary btn-sm flex-grow-1 py-2"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-4 bg-dark bg-opacity-30 border border-white border-opacity-5 text-center">
        <p className="small text-secondary m-0">
          💡 <strong>ملاحظة مهمة:</strong> المطور والعادي يشتغلان بالتوازي دائماً. المطور لا يلغي
          العادي أبداً، والسوق يقرر من هو الأفضل.
        </p>
      </div>

      <style>{`
        .fw-black { font-weight: 900 !important; }
        .shadow-gold-sm { box-shadow: 0 5px 15px rgba(255, 215, 0, 0.15); }
        .shadow-success-sm { box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3); }
        .shadow-ruby-sm { box-shadow: 0 10px 20px rgba(255, 0, 85, 0.3); }
        .pulse-led-green { width: 8px; height: 8px; background-color: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border-radius: 24px; }
        .text-ruby { color: #ff0055; }
        .bg-ruby { background-color: #ff0055; }
        .border-ruby { border-color: rgba(255, 0, 85, 0.3) !important; }
        .btn-ruby { background: #ff0055; color: #fff; border: none; }
        .btn-ruby:hover { background: #d40046; color: #fff; }
        .btn-outline-ruby { border: 1px solid #ff0055; color: #ff0055; background: transparent; }
        .btn-outline-ruby:hover { background: rgba(255, 0, 85, 0.1); color: #ff0055; }
        .text-emerald { color: #10b981; }
        .bg-emerald { background-color: #10b981; }
        .border-emerald { border-color: rgba(16, 185, 129, 0.3) !important; }
      `}</style>
    </div>
  )
}

export default BrainsTab
