import React, { useState } from 'react'
import { Sparkles, Crown, Cpu } from 'lucide-react'

const EXPERTS = [
  {
    id: 'chartist',
    name: 'الشارتيست',
    model: 'DeepSeek',
    defaultPrompt: 'أنت محلل فني خبير يدرس السيولة...'
  },
  {
    id: 'reporter',
    name: 'المذيع',
    model: 'Grok',
    defaultPrompt: 'أنت مذيع الأخبار الخاص بالمتداولين...'
  },
  {
    id: 'pulser',
    name: 'النبّاض',
    model: 'Grok',
    defaultPrompt: 'أنت النبّاض تقرأ المشاعر العامة وتأثير الدوبامين...'
  },
  {
    id: 'radar',
    name: 'الرادار',
    model: 'DeepSeek',
    defaultPrompt: 'أنت تراقب الاتجاه العام وتشخص الحركات الوهمية...'
  },
  {
    id: 'guardian',
    name: 'الحارس',
    model: 'DeepSeek',
    defaultPrompt: 'أنت العدو الصارم للصفقات، لا تدع أي صفقة تمر دون تعتيم...'
  },
  {
    id: 'investigator',
    name: 'المحقق',
    model: 'Claude',
    defaultPrompt: 'أنت المحقق، تربط التناقضات بين الأخبار والفنيات...'
  },
  {
    id: 'prince',
    name: 'العادي',
    model: 'Claude',
    defaultPrompt: 'أنت الاستراتيجي وصانع القرار النهائي...'
  },
  {
    id: 'engineer',
    name: 'المهندس',
    model: 'Claude',
    defaultPrompt: 'أنت المطور الذي يحول أفكار العادي إلى كود...'
  },
  {
    id: 'king',
    name: 'المطور',
    model: 'LSTM',
    defaultPrompt: 'أنت شبكة التوقع العصبية المعتمدة على البيانات الرقمية...'
  }
]

const ExpertPromptsTab = ({ settings, onUpdate }) => {
  const [prompts, setPrompts] = useState(settings?.expertPrompts || {})
  const [princeActive, setPrinceActive] = useState(settings?.princeActive ?? true)
  const [kingActive, setKingActive] = useState(settings?.kingActive ?? false)
  const [loading, setLoading] = useState(false)

  const handlePromptChange = (id, value) => {
    setPrompts((prev) => ({ ...prev, [id]: value }))
  }

  const handleSave = async () => {
    setLoading(true)
    await onUpdate({ expertPrompts: prompts, princeActive, kingActive })
    setLoading(false)
  }

  const handleAskAdvisor = (id) => {
    alert(`سيقرأ المستشار أداء ${id} ويقترح تحسينات قريباً. الطور الحالي: استعراضية`)
  }

  const handleToggle = (type) => {
    if (type === 'prince') {
      if (princeActive && !kingActive) return
      setPrinceActive(!princeActive)
    } else {
      if (kingActive && !princeActive) return
      setKingActive(!kingActive)
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="text-gold mb-1">إعدادات الخبراء</h5>
          <p className="text-secondary small m-0">تخصيص تعليمات كل خبير وحالة المطورين</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn btn-gold px-4">
          {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </button>
      </div>

      <div className="glass-card p-3 mb-5 border-gold border-opacity-25">
        <div className="d-flex align-items-center gap-3">
          <div className="text-secondary small fw-medium">القيادة الحالية:</div>
          <button
            onClick={() => handleToggle('prince')}
            className={`btn btn-sm d-flex align-items-center gap-2 transition-all ${princeActive ? 'btn-dark-gold border-gold' : 'btn-outline-secondary opacity-50'}`}
          >
            <span
              className={`pulse-dot ${princeActive ? 'bg-success' : 'bg-danger'} d-inline-block`}
              style={{
                width: '8px',
                height: '8px',
                animation: princeActive ? 'pulse-animation 2s infinite' : 'none'
              }}
            ></span>
            العادي (Claude)
          </button>
          <button
            onClick={() => handleToggle('king')}
            className={`btn btn-sm d-flex align-items-center gap-2 transition-all ${kingActive ? 'btn-dark-gold border-gold' : 'btn-outline-secondary opacity-50'}`}
          >
            <span
              className={`pulse-dot ${kingActive ? 'bg-success' : 'bg-danger'} d-inline-block`}
              style={{
                width: '8px',
                height: '8px',
                animation: kingActive ? 'pulse-animation 2s infinite' : 'none'
              }}
            ></span>
            المطور (LSTM)
          </button>
          <div className="small text-secondary ms-auto opacity-75">
            يجب تشغيل خبير قيادي واحد على الأقل
          </div>
        </div>
      </div>

      <div className="d-flex flex-column gap-4">
        {EXPERTS.map((expert) => {
          const currentPrompt = prompts[expert.id] || expert.defaultPrompt
          return (
            <div key={expert.id} className="p-4 rounded-4 glass-card border flex-column gap-3">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="bg-gold bg-opacity-10 p-2 rounded-3 text-gold">
                    {expert.id === 'prince' || expert.id === 'king' ? (
                      <Crown size={20} />
                    ) : (
                      <Cpu size={20} />
                    )}
                  </div>
                  <div>
                    <h6 className="m-0 text-white">{expert.name}</h6>
                    <div className="small text-secondary">{expert.model}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleAskAdvisor(expert.id)}
                  className="btn btn-outline-info btn-sm d-flex align-items-center gap-2"
                >
                  <Sparkles size={14} /> اطلب تحسين المستشار
                </button>
              </div>
              <textarea
                className="form-control bg-dark text-silver-v2 border-secondary bg-opacity-50"
                rows="3"
                value={currentPrompt}
                onChange={(e) => handlePromptChange(expert.id, e.target.value)}
                placeholder="أدخل برومبت مخصص لهذا الخبير..."
              ></textarea>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ExpertPromptsTab
