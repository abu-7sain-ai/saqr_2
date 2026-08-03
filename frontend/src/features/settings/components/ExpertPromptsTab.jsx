import React, { useState } from 'react'
import { Sparkles, Crown, Cpu, Plus, Trash2, Save, X, Info } from 'lucide-react'
import { useSettingStore } from '../store/useSettingStore'
import { useAuth } from '../../../context/AuthContext'

const DEFAULT_EXPERTS = [
  {
    id: 'chartist',
    name: 'الشارتيست الكمي',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت الشارتيست الكمي لـ {symbol}. حلل إحصاءات الـ 7 سنوات والـ 3 سنوات (Walk-Forward) بشكل منفصل تماماً. استخرج الحقائق الجافة فقط عن السلوك السعري في الفترتين.'
  },
  {
    id: 'reporter',
    name: 'المذيع صقر',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت المذيع صقر. حلل مشاعر المتداولين لـ {symbol} عبر منصة X والقائمة البيضاء. هل يوجد فومو (FOMO) أو فاد (FUD)؟'
  },
  {
    id: 'pulser',
    name: 'النبّاض',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت النبّاض تقرأ المشاعر العامة وتأثير الدوبامين على الفرضيات المقترحة. ضع فرضيات دخول رقمية دقيقة واستهدف أرباحاً واقعية.'
  },
  {
    id: 'radar',
    name: 'الرادار',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت الرادار، تراقب الثبات الإحصائي وحركة كامل القائمة البيضاء لتشخيص الحركات الوهمية واختيار أفضل العملات.'
  },
  {
    id: 'guardian',
    name: 'الحارس الصارم',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت الحارس الصارم، هاجم الفرضيات بشراسة وافحص مخاطر انهيار كورونا 2020 ومايو 2021. لا تدع أي صفقة تمر دون فحص الأمان أولاً.'
  },
  {
    id: 'investigator',
    name: 'المحقق',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت المحقق، تراجع الجولات والفرضيات السابقة وتبحث عن أي تناقض منطقي أو إحصائي بين الأخبار والفنيات.'
  },
  {
    id: 'engineer',
    name: 'المهندس الكمي',
    defaultModel: 'llama-3.3-70b-versatile',
    defaultPrompt: 'أنت المهندس الكمي، تقترح تعديلات تقنية ومستويات وقف الخسارة بناءً على أقصى تراجع تاريخي (Max Drawdown).'
  },
  {
    id: 'prince',
    name: 'الأمير (صانع القرار القياسي)',
    defaultModel: 'llama-3.1-8b-instant',
    defaultPrompt: 'أنت الأمير، القاضي العلمي النهائي لمجلس صقر. أصدر مرسومك النهائي بـ 3 استراتيجيات (محافظة، متوسطة، عدوانية) بتنسيق JSON نقي.'
  },
  {
    id: 'advanced',
    name: 'الملك / العقل المطور',
    defaultModel: 'llama-3.1-8b-instant',
    defaultPrompt: 'أنت العقل المطور / الملك. حلل صفقات المستخدم السابقة ودروس التعلم الآلي لتطوير استراتيجية متطورة ذات عائد عالي.'
  }
]

const MODEL_OPTIONS = [
  { value: 'llama-3.3-70b-versatile', label: 'Groq Llama 3.3 (70B) - مجاني وسريع جداً' },
  { value: 'llama-3.1-8b-instant', label: 'Groq Llama 3.1 (8B) - فائق السرعة' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek V3 - تحليل كمي عميق' },
  { value: 'grok-beta', label: 'Grok (xAI) - مشاعر السوق والأخبار' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet - استدلال استراتيجي دقيق' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash - سرعة فائقة ودقة متقدمة' }
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
  const [newExpertForm, setNewExpertForm] = useState({
    name: '',
    id: '',
    model: 'llama-3.3-70b-versatile',
    prompt: ''
  })

  // Combine default experts + custom experts
  const allExperts = [
    ...DEFAULT_EXPERTS,
    ...customExpertsForm.map(ce => ({
      id: ce.id,
      name: ce.name,
      defaultModel: ce.model || 'llama-3.3-70b-versatile',
      defaultPrompt: ce.prompt || '',
      isCustom: true
    }))
  ]

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
    setNewExpertForm({ name: '', id: '', model: 'llama-3.3-70b-versatile', prompt: '' })
  }

  const handleSave = async () => {
    if (user) {
      await saveAllSettings(user.id)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h5 className="text-gold mb-1 d-flex align-items-center gap-2">
            <Sparkles size={20} /> إدارة الخبراء والبرومبتات والعقول
          </h5>
          <p className="text-secondary small m-0">
            تخصيص تعليمات ونماذج الذكاء الاصطناعي لكل خبير في مجلس التداول
          </p>
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-outline-gold d-flex align-items-center gap-2 px-3"
          >
            <Plus size={16} /> إضافة خبير مخصص
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-gold px-4 d-flex align-items-center gap-2"
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

      <div className="alert alert-info bg-info bg-opacity-10 border-info text-info small mb-4 d-flex align-items-center gap-2">
        <Info size={18} />
        <span>
          يمكنك تخصيص البرومبت ونموذج الذكاء الاصطناعي (العقل) لكل خبير. سيتم الاعتماد على إعداداتك المخصصة فوراً أثناء اجتماعات المجلس.
        </span>
      </div>

      <div className="d-flex flex-column gap-4">
        {allExperts.map((expert) => {
          const currentPrompt = expertPromptsForm[expert.id] ?? expert.defaultPrompt
          const currentModel = expertModelsForm[expert.id] || expert.defaultModel

          return (
            <div
              key={expert.id}
              className="p-4 rounded-4 glass-card border border-secondary border-opacity-25 position-relative"
            >
              <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-gold bg-opacity-10 p-2 rounded-3 text-gold">
                    {expert.id === 'prince' || expert.id === 'advanced' ? (
                      <Crown size={22} />
                    ) : (
                      <Cpu size={22} />
                    )}
                  </div>
                  <div>
                    <div className="d-flex align-items-center gap-2">
                      <h6 className="m-0 text-white fw-bold">{expert.name}</h6>
                      {expert.isCustom && (
                        <span className="badge bg-gold text-dark extra-small">مخصص</span>
                      )}
                    </div>
                    <span className="extra-small text-secondary">معرّف النظام: {expert.id}</span>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center gap-2">
                    <span className="extra-small text-secondary">العقل / الموديل:</span>
                    <select
                      className="form-select form-select-sm bg-dark text-white border-secondary"
                      value={currentModel}
                      onChange={(e) => setExpertModel(expert.id, e.target.value)}
                      style={{ maxWidth: '280px' }}
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {expert.isCustom && (
                    <button
                      onClick={() => {
                        if (window.confirm(`هل أنت متأكد من حذف الخبير المخصص "${expert.name}"؟`)) {
                          deleteCustomExpert(expert.id)
                        }
                      }}
                      className="btn btn-outline-ruby btn-sm p-2 rounded-3"
                      title="حذف الخبير المخصص"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="extra-small text-secondary mb-1 d-block fw-bold">
                  التعليمات والبرومبت (System Prompt):
                </label>
                <textarea
                  className="form-control bg-dark text-white border-secondary bg-opacity-50 extra-small"
                  rows="3"
                  value={currentPrompt}
                  onChange={(e) => setExpertPrompt(expert.id, e.target.value)}
                  placeholder="أدخل البرومبت المخصص لهذا الخبير..."
                ></textarea>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal: إضافة خبير مخصص */}
      {showAddModal && (
        <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }} onClick={() => setShowAddModal(false)}>
          <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 rounded-4" style={{ background: '#0e0e1a', border: '1px solid rgba(212,175,55,0.2)' }}>
              <div className="modal-header border-0 pb-0 pt-4 px-4">
                <h6 className="modal-title fw-bold text-gold">
                  <Plus size={18} className="me-2" /> إضافة خبير جديد
                </h6>
                <button className="btn p-0 ms-auto text-secondary" onClick={() => setShowAddModal(false)}>
                  <X size={20} />
                </button>
              </div>
              <div className="modal-body px-4 py-3">
                <div className="mb-3">
                  <label className="small text-secondary mb-1 d-block">اسم الخبير *</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="مثال: الخبير الاستراتيجي"
                    value={newExpertForm.name}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, name: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="small text-secondary mb-1 d-block">المعرف الإنجليزي (ID اختياري)</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-white border-secondary"
                    placeholder="مثال: strategist"
                    value={newExpertForm.id}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, id: e.target.value })}
                  />
                </div>
                <div className="mb-3">
                  <label className="small text-secondary mb-1 d-block">العقل / الموديل</label>
                  <select
                    className="form-select bg-dark text-white border-secondary"
                    value={newExpertForm.model}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, model: e.target.value })}
                  >
                    {MODEL_OPTIONS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="small text-secondary mb-1 d-block">التعليمات / البرومبت *</label>
                  <textarea
                    className="form-control bg-dark text-white border-secondary"
                    rows="4"
                    placeholder="أدخل برومبت التوجيه الخاص بهذا الخبير..."
                    value={newExpertForm.prompt}
                    onChange={(e) => setNewExpertForm({ ...newExpertForm, prompt: e.target.value })}
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2">
                <button className="btn btn-outline-secondary flex-grow-1" onClick={() => setShowAddModal(false)}>
                  إلغاء
                </button>
                <button className="btn btn-gold flex-grow-1 fw-bold" onClick={handleAddExpert}>
                  إضافة الخبير
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExpertPromptsTab
