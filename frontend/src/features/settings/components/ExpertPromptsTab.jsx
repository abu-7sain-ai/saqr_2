import React, { useState } from 'react'
import { Sparkles, Crown, Cpu, Plus, Trash2, Save, X, Info, Edit3, ChevronDown, ChevronUp, Zap, Brain, Shield } from 'lucide-react'
import { useSettingStore } from '../store/useSettingStore'
import { useAuth } from '../../../context/AuthContext'

const DEFAULT_EXPERTS = [
  {
    id: 'chartist',
    name: 'الشارتيست الكمي',
    icon: '📊',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت الشارتيست الكمي لـ {symbol}. حلل إحصاءات الـ 7 سنوات والـ 3 سنوات (Walk-Forward) بشكل منفصل تماماً. استخرج الحقائق الجافة فقط عن السلوك السعري في الفترتين.'
  },
  {
    id: 'reporter',
    name: 'المذيع صقر',
    icon: '🎙️',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت المذيع صقر. حلل مشاعر المتداولين لـ {symbol} عبر منصة X والقائمة البيضاء. هل يوجد فومو (FOMO) أو فاد (FUD)؟'
  },
  {
    id: 'pulser',
    name: 'النبّاض',
    icon: '💓',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت النبّاض تقرأ المشاعر العامة وتأثير الدوبامين على الفرضيات المقترحة. ضع فرضيات دخول رقمية دقيقة واستهدف أرباحاً واقعية.'
  },
  {
    id: 'radar',
    name: 'الرادار',
    icon: '📡',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت الرادار، تراقب الثبات الإحصائي وحركة كامل القائمة البيضاء لتشخيص الحركات الوهمية واختيار أفضل العملات.'
  },
  {
    id: 'guardian',
    name: 'الحارس الصارم',
    icon: '🛡️',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت الحارس الصارم، هاجم الفرضيات بشراسة وافحص مخاطر انهيار كورونا 2020 ومايو 2021. لا تدع أي صفقة تمر دون فحص الأمان أولاً.'
  },
  {
    id: 'investigator',
    name: 'المحقق',
    icon: '🔍',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت المحقق، تراجع الجولات والفرضيات السابقة وتبحث عن أي تناقض منطقي أو إحصائي بين الأخبار والفنيات.'
  },
  {
    id: 'engineer',
    name: 'المهندس الكمي',
    icon: '⚙️',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت المهندس الكمي، تقترح تعديلات تقنية ومستويات وقف الخسارة بناءً على أقصى تراجع تاريخي (Max Drawdown).'
  },
  {
    id: 'prince',
    name: 'الأمير (صانع القرار)',
    icon: '👑',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت الأمير، القاضي العلمي النهائي لمجلس صقر. أصدر مرسومك النهائي بـ 3 استراتيجيات (محافظة، متوسطة، عدوانية) بتنسيق JSON نقي.'
  },
  {
    id: 'advanced',
    name: 'الملك / العقل المطور',
    icon: '🧠',
    defaultModel: 'google/gemini-2.5-flash',
    defaultPrompt: 'أنت العقل المطور / الملك. حلل صفقات المستخدم السابقة ودروس التعلم الآلي لتطوير استراتيجية متطورة ذات عائد عالي.'
  }
]

const MODEL_OPTIONS = [
  { value: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', desc: 'فائق السرعة والذكاء على Groq', badge: 'Groq', color: '#10b981' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', desc: 'سريع ورخيص — أفضل قيمة', badge: 'موصى', color: '#4285f4' },
  { value: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', desc: 'استدلال استراتيجي دقيق', badge: 'ذكي', color: '#d97706' },
  { value: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'متوازن بين السعر والجودة', badge: 'متوازن', color: '#6366f1' },
  { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout', desc: 'مفتوح المصدر — ذكاء عالي', badge: 'مفتوح', color: '#0ea5e9' },
  { value: 'deepseek/deepseek-chat-v3-0324', label: 'DeepSeek V3', desc: 'تحليل كمي عميق', badge: 'عميق', color: '#8b5cf6' },
  { value: 'qwen/qwen3-32b', label: 'Qwen 3 (32B)', desc: 'سريع ورخيص — متعدد اللغات', badge: 'سريع', color: '#f43f5e' },
  { value: 'mistralai/mistral-medium-3', label: 'Mistral Medium 3', desc: 'أوروبي — متوسط التكلفة', badge: 'متوسط', color: '#f97316' },
]

const ExpertPromptsTab = () => {
  const { user } = useAuth()
  const {
    expertPromptsForm,
    expertModelsForm,
    customExpertsForm,
    setExpertPrompt,
    setExpertModel,
    addCustomExpert,
    deleteCustomExpert,
    saveAllSettings,
    saving
  } = useSettingStore()

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(null)
  const [expandedCards, setExpandedCards] = useState({})
  const [newExpertForm, setNewExpertForm] = useState({
    name: '',
    id: '',
    model: 'google/gemini-2.5-flash',
    prompt: ''
  })

  const allExperts = [
    ...DEFAULT_EXPERTS,
    ...customExpertsForm.map(ce => ({
      id: ce.id,
      name: ce.name,
      icon: '🤖',
      defaultModel: ce.model || 'google/gemini-2.5-flash',
      defaultPrompt: ce.prompt || '',
      isCustom: true
    }))
  ]

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleAddExpert = () => {
    if (!newExpertForm.name || !newExpertForm.prompt) {
      alert('يرجى إدخال اسم الخبير والبرومبت المطلوب')
      return
    }
    const generatedId = newExpertForm.id.trim() || `custom_${Date.now()}`
    addCustomExpert({
      id: generatedId,
      name: newExpertForm.name,
      model: newExpertForm.model,
      defaultPrompt: newExpertForm.prompt
    })
    setShowAddModal(false)
    setNewExpertForm({ name: '', id: '', model: 'google/gemini-2.5-flash', prompt: '' })
  }

  const handleSave = async () => {
    if (user) {
      await saveAllSettings(user.id)
    }
  }

  const getModelInfo = (modelValue) => {
    return MODEL_OPTIONS.find(m => m.value === modelValue) || MODEL_OPTIONS[1]
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h5 className="mb-1 d-flex align-items-center gap-2 fw-bold" style={{ color: '#d4af37' }}>
            <Sparkles size={20} /> إدارة الخبراء والعقول
          </h5>
          <p className="small m-0" style={{ color: '#8b8b9e' }}>
            تخصيص نماذج الذكاء الاصطناعي والتعليمات لكل خبير في مجلس التداول
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn d-flex align-items-center gap-2 px-3"
            style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
              border: '1px solid rgba(212,175,55,0.3)',
              color: '#d4af37',
              borderRadius: '12px'
            }}
          >
            <Plus size={16} /> إضافة خبير
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn px-4 d-flex align-items-center gap-2 fw-bold"
            style={{
              background: 'linear-gradient(135deg, #d4af37, #b8941f)',
              color: '#000',
              borderRadius: '12px',
              border: 'none'
            }}
          >
            {saving ? (
              <span className="spinner-border spinner-border-sm" role="status" />
            ) : (
              <Save size={16} />
            )}
            {saving ? 'جاري الحفظ...' : 'حفظ الكل'}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-4 p-3 d-flex align-items-center gap-3" style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.03))',
        border: '1px solid rgba(16,185,129,0.25)',
        borderRadius: '14px',
        color: '#6ee7b7'
      }}>
        <Sparkles size={18} style={{ flexShrink: 0, color: '#10b981' }} />
        <span style={{ fontSize: '0.8rem' }}>
          ✅ <strong>الحفظ التلقائي الفوري مفعّل:</strong> أي موديل تختاره لأي خبير يتم حفظه وتثبيته فوراً ودائماً لقاعدة البيانات، ولن تحتاج للضغط على زر الحفظ قبل عقد الاجتماعات.
        </span>
      </div>

      <div className="d-flex flex-column gap-3">
        {allExperts.map((expert) => {
          const currentPrompt = expertPromptsForm[expert.id] ?? expert.defaultPrompt
          const savedInLocal = (() => {
            try {
              return JSON.parse(localStorage.getItem('saqr_expert_models') || '{}')[expert.id]
            } catch (e) {
              return null
            }
          })()
          const currentModel = expertModelsForm[expert.id] || savedInLocal || 'openai/gpt-oss-120b'
          const modelInfo = getModelInfo(currentModel)
          const isExpanded = expandedCards[expert.id]
          const isEditing = editingPrompt === expert.id
          const isPrinceOrAdvanced = expert.id === 'prince' || expert.id === 'advanced'

          return (
            <div
              key={expert.id}
              style={{
                background: isPrinceOrAdvanced
                  ? 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
                border: isPrinceOrAdvanced
                  ? '1px solid rgba(212,175,55,0.2)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Card Header */}
              <div
                className="d-flex justify-content-between align-items-center p-3 px-4"
                style={{ cursor: 'pointer' }}
                onClick={() => toggleCard(expert.id)}
              >
                <div className="d-flex align-items-center gap-3">
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    background: isPrinceOrAdvanced
                      ? 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.08))'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
                    border: isPrinceOrAdvanced
                      ? '1px solid rgba(212,175,55,0.3)'
                      : '1px solid rgba(255,255,255,0.1)'
                  }}>
                    {expert.icon}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <span className="fw-bold text-white" style={{ fontSize: '0.95rem' }}>{expert.name}</span>
                      {expert.isCustom && (
                        <span className="badge" style={{
                          background: 'rgba(212,175,55,0.2)',
                          color: '#d4af37',
                          fontSize: '0.65rem',
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}>مخصص</span>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '1px 8px',
                        borderRadius: '6px',
                        background: `${modelInfo.color}20`,
                        color: modelInfo.color,
                        border: `1px solid ${modelInfo.color}30`,
                        fontWeight: 600
                      }}>{modelInfo.badge}</span>
                      <span style={{ fontSize: '0.72rem', color: '#8b8b9e' }}>{modelInfo.label}</span>
                    </div>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  {isExpanded ? <ChevronUp size={18} color="#8b8b9e" /> : <ChevronDown size={18} color="#8b8b9e" />}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4" style={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  paddingTop: '16px'
                }}>
                  {/* Model Selector */}
                  <div className="mb-3">
                    <label className="d-block mb-2 fw-bold" style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>
                      <Brain size={14} className="me-1" /> العقل / الموديل
                    </label>
                    <div className="d-flex flex-wrap gap-2">
                      {MODEL_OPTIONS.map((m) => {
                        const isSelected = currentModel === m.value
                        return (
                          <button
                            key={m.value}
                            onClick={(e) => { e.stopPropagation(); setExpertModel(expert.id, m.value) }}
                            className="btn p-0"
                            style={{
                              padding: '8px 14px',
                              borderRadius: '10px',
                              fontSize: '0.75rem',
                              border: isSelected ? `2px solid ${m.color}` : '1px solid rgba(255,255,255,0.1)',
                              background: isSelected ? `${m.color}15` : 'rgba(255,255,255,0.03)',
                              color: isSelected ? m.color : '#8b8b9e',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                          >
                            <div className="d-flex align-items-center gap-2 px-2 py-1">
                              <span className="fw-bold">{m.label}</span>
                              <span style={{
                                fontSize: '0.62rem',
                                opacity: 0.7,
                                background: `${m.color}20`,
                                padding: '1px 6px',
                                borderRadius: '4px',
                                color: m.color
                              }}>{m.badge}</span>
                            </div>
                            <div style={{ fontSize: '0.65rem', opacity: 0.6, paddingInline: '8px' }}>{m.desc}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Prompt Section */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="fw-bold" style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>
                        <Edit3 size={14} className="me-1" /> التعليمات (System Prompt)
                      </label>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingPrompt(isEditing ? null : expert.id) }}
                        className="btn btn-sm d-flex align-items-center gap-1"
                        style={{
                          fontSize: '0.72rem',
                          padding: '4px 12px',
                          borderRadius: '8px',
                          background: isEditing ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                          color: isEditing ? '#ef4444' : '#a5b4fc',
                          border: `1px solid ${isEditing ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)'}`
                        }}
                      >
                        {isEditing ? <><X size={12} /> إغلاق</> : <><Edit3 size={12} /> تعديل</>}
                      </button>
                    </div>

                    {isEditing ? (
                      <textarea
                        className="form-control"
                        rows="4"
                        value={currentPrompt}
                        onChange={(e) => setExpertPrompt(expert.id, e.target.value)}
                        placeholder="أدخل البرومبت المخصص لهذا الخبير..."
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          color: '#e2e8f0',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          resize: 'vertical'
                        }}
                      />
                    ) : (
                      <div style={{
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '0.78rem',
                        color: '#94a3b8',
                        lineHeight: 1.7,
                        border: '1px solid rgba(255,255,255,0.05)',
                        maxHeight: '80px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {currentPrompt || 'لم يتم تعيين برومبت...'}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`هل أنت متأكد من حذف الخبير "${expert.name}"؟ ${!expert.isCustom ? '(سيتم إعادة تعيينه للقيم الافتراضية)' : ''}`)) {
                          if (expert.isCustom) {
                            deleteCustomExpert(expert.id)
                          } else {
                            // Reset to defaults
                            const def = DEFAULT_EXPERTS.find(d => d.id === expert.id)
                            if (def) {
                              setExpertPrompt(expert.id, def.defaultPrompt)
                              setExpertModel(expert.id, def.defaultModel)
                            }
                          }
                        }
                      }}
                      className="btn btn-sm d-flex align-items-center gap-1"
                      style={{
                        fontSize: '0.72rem',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: 'rgba(239,68,68,0.08)',
                        color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.15)'
                      }}
                    >
                      <Trash2 size={13} />
                      {expert.isCustom ? 'حذف الخبير' : 'إعادة تعيين'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal: إضافة خبير مخصص */}
      {showAddModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.85)', zIndex: 9999 }} onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0" style={{
              background: 'linear-gradient(135deg, #0e0e1a, #12121f)',
              border: '1px solid rgba(212,175,55,0.15)',
              borderRadius: '20px'
            }}>
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <h6 className="modal-title fw-bold" style={{ color: '#d4af37' }}>
                  <Plus size={18} className="me-2" /> إضافة خبير جديد
                </h6>
                <button className="btn p-0 ms-auto" onClick={() => setShowAddModal(false)} style={{ color: '#666' }}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body px-4 py-3">
                <div className="mb-3">
                  <label className="small mb-1 d-block" style={{ color: '#8b8b9e' }}>اسم الخبير *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="مثال: الخبير الاستراتيجي"
                    value={newExpertForm.name}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, name: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      borderRadius: '12px'
                    }}
                  />
                </div>
                <div className="mb-3">
                  <label className="small mb-1 d-block" style={{ color: '#8b8b9e' }}>المعرف الإنجليزي (ID اختياري)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="مثال: strategist"
                    value={newExpertForm.id}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, id: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      borderRadius: '12px'
                    }}
                  />
                </div>
                <div className="mb-3">
                  <label className="small mb-1 d-block" style={{ color: '#8b8b9e' }}>العقل / الموديل</label>
                  <select
                    className="form-select"
                    value={newExpertForm.model}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, model: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      borderRadius: '12px'
                    }}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value} style={{ background: '#1a1a2e', color: '#e2e8f0' }}>
                        {m.label} — {m.desc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="small mb-1 d-block" style={{ color: '#8b8b9e' }}>التعليمات / البرومبت *</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="أدخل برومبت التوجيه الخاص بهذا الخبير..."
                    value={newExpertForm.prompt}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, prompt: e.target.value })}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0',
                      borderRadius: '12px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2">
                <button
                  className="btn flex-grow-1"
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8b8b9e',
                    borderRadius: '12px'
                  }}
                >
                  إلغاء
                </button>
                <button
                  className="btn flex-grow-1 fw-bold"
                  onClick={handleAddExpert}
                  style={{
                    background: 'linear-gradient(135deg, #d4af37, #b8941f)',
                    color: '#000',
                    borderRadius: '12px',
                    border: 'none'
                  }}
                >
                  إضافة الخبير
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .form-control:focus, .form-select:focus {
          box-shadow: 0 0 0 2px rgba(99,102,241,0.25) !important;
          border-color: rgba(99,102,241,0.4) !important;
        }
      `}</style>
    </div>
  )
}

export default ExpertPromptsTab
