import React from 'react'
import {
  Users,
  Shield,
  Cpu,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Crown,
  Trash2,
  Microscope,
  Zap,
  AlertTriangle,
  FileCheck
} from 'lucide-react'

import { useSettingStore } from '../../settings/store/useSettingStore'

const MODEL_LABELS = {
  'openai/gpt-oss-120b': 'GPT-OSS 120B (Groq)',
  'groq/compound': 'GPT-OSS 120B (Groq)',
  'compound': 'GPT-OSS 120B (Groq)',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
  'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
  'openai/gpt-4.1-mini': 'GPT-4.1 Mini',
  'meta-llama/llama-4-scout': 'Llama 4 Scout',
  'deepseek/deepseek-chat-v3-0324': 'DeepSeek V3',
  'qwen/qwen3-32b': 'Qwen 3 (32B)',
  'mistralai/mistral-medium-3': 'Mistral Medium 3',
  'llama-3.3-70b-versatile': 'Groq Llama 3.3',
}

const DEFAULT_EXPERTS_LIST = [
  {
    id: 'chartist',
    name: 'الشارتيست الكمي',
    icon: <Microscope size={20} />,
    color: 'text-info'
  },
  {
    id: 'reporter',
    name: 'المذيع صقر',
    icon: <MessageSquare size={20} />,
    color: 'text-warning'
  },
  {
    id: 'pulser',
    name: 'النبّاض',
    icon: <Zap size={20} />,
    color: 'text-danger'
  },
  {
    id: 'radar',
    name: 'الرادار',
    icon: <Users size={20} />,
    color: 'text-primary'
  },
  {
    id: 'guardian',
    name: 'الحارس الصارم',
    icon: <Shield size={20} />,
    color: 'text-danger'
  },
  {
    id: 'investigator',
    name: 'المحقق',
    icon: <FileCheck size={20} />,
    color: 'text-success'
  },
  {
    id: 'engineer',
    name: 'المهندس الكمي',
    icon: <Cpu size={20} />,
    color: 'text-silver'
  },
  {
    id: 'prince',
    name: 'الأمير (صانع القرار)',
    icon: <Crown size={20} />,
    color: 'text-gold'
  },
  {
    id: 'advanced',
    name: 'الملك / العقل المطور',
    icon: <Cpu size={20} />,
    color: 'text-purple'
  }
]

const MeetingSimulation = ({ session, onDelete }) => {
  const { expertModelsForm, customExpertsForm } = useSettingStore()
  const opinions = session?.expert_opinions || {}
  const status = session?.status || opinions.status || 'pending'
  const symbol = session?.symbol || opinions.symbol || '???'

  const allExperts = [
    ...DEFAULT_EXPERTS_LIST,
    ...customExpertsForm.map(ce => ({
      id: ce.id,
      name: ce.name,
      icon: <Cpu size={20} />,
      color: 'text-gold'
    }))
  ]

  const experts = allExperts.map(exp => {
    const savedInSession = session?.worker_settings?.expert_models?.[exp.id]
    const savedInStore = expertModelsForm[exp.id]
    const savedInLocal = (() => {
      try {
        return JSON.parse(localStorage.getItem('saqr_expert_models') || '{}')[exp.id]
      } catch (e) {
        return null
      }
    })()
    const rawModel = savedInSession || savedInStore || savedInLocal || 'openai/gpt-oss-120b'
    const label = MODEL_LABELS[rawModel] || rawModel.split('/').pop()
    return {
      ...exp,
      model: label
    }
  })

  if (!session || status === 'completed') return null

  const getStatusLabel = (statusVal) => {
    switch (statusVal) {
      case 'collecting_data':
        return `جاري فحص 10 سنوات من البيانات لـ ${symbol}...`
      case 'pattern_matching':
        return 'مرحلة 0: مطابقة الأنماط التاريخية (Quantitative Matching)'
      case 'round_1_analysis':
        return 'الجولة 1: تشريح البيانات (Data Dissection)'
      case 'round_2_crosstalk':
        return 'الجولة 2: صياغة الفرضيات (Hypotheses Generation)'
      case 'round_3_guardian':
        return 'الجولة 3: الهجوم المعاكس (Adversarial Attack)'
      case 'round_4_refinement':
        return 'الجولة 4: التنقيح الإحصائي (Refinement)'
      case 'round_5_stress_test':
        return 'الجولة 5: محاكاة الأزمات (Stress Testing)'
      case 'round_6_audit':
        return 'الجولة 6: التدقيق المنطقي (Audit)'
      case 'round_7_decree':
        return 'الجولة 7: المرسوم النهائي وإصدار الاستراتيجية'
      case 'round_8_advanced_learning':
        return 'الجولة 8: التعلم المتطور (Advanced Learning)...'
      case 'backtesting_7_3':
        return 'المرحلة النهائية: الاختبار التاريخي والتحقق الكمي...'
      case 'pending':
      case 'running_session':
        return 'جاري تحضير الجلسة وبدء المحرك العلمي...'
      default:
        return 'في انتظار بدء الاجتماع العلمي...'
    }
  }

  const getRoundNumber = (statusVal) => {
    if (statusVal === 'pattern_matching') return 0.5
    if (statusVal.includes('round_')) {
      const parts = statusVal.split('_')
      return parseInt(parts[1])
    }
    return 0
  }

  const currentRound = getRoundNumber(status)
  const isProcessing = [
    'pending',
    'running_session',
    'collecting_data',
    'pattern_matching',
    'round_1_analysis',
    'round_2_crosstalk',
    'round_3_guardian',
    'round_4_refinement',
    'round_5_stress_test',
    'round_6_audit',
    'round_7_decree',
    'round_8_advanced_learning',
    'backtesting_7_3'
  ].includes(status)

  return (
    <>
      <div className="glass-card p-4 border-gold border-opacity-10 mb-4 animate-fade-in shadow-gold overflow-hidden">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <Users className="text-gold" size={24} />
              <h5 className="text-white fw-bold m-0">مجلس الحكماء العلمي (7 جولات)</h5>
              <span className="badge bg-gold text-black small" style={{ fontSize: '9px' }}>
                 LIVE ENGINE v3.0 (Real)
              </span>
            </div>
            <p className="small text-secondary m-0">{getStatusLabel(session.status)}</p>
          </div>
          <div className="d-flex align-items-center gap-3">
            <button
              onClick={() => onDelete(session.id)}
              className="btn btn-dark-ruby border-0 p-2 px-3 rounded-3 d-flex align-items-center gap-2 transition-all hover-ruby"
              style={{ background: 'rgba(220, 38, 38, 0.15)', color: 'var(--saqr-ruby)', cursor: 'pointer' }}
              title="إيقاف الجلسة فوراً"
            >
              <Trash2 size={16} /> <span className="small fw-bold">إيقاف فوري</span>
            </button>

            <div className="d-flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map((r) => (
                <div
                  key={r}
                  className={`rounded-pill px-2 py-1 small fw-bold transition-all ${currentRound === r ? 'bg-gold text-black shadow-lg scale-110' : currentRound > r ? 'bg-success bg-opacity-20 text-success' : 'bg-dark bg-opacity-40 text-secondary border border-white border-opacity-5'}`}
                  style={{ fontSize: '9px', minWidth: '45px', textAlign: 'center' }}
                >
                  ج{r}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row g-3">
          {experts.map((expert) => {
            const isThinking =
              isProcessing &&
              !opinions.rounds?.[`${experts.indexOf(expert) < 4 ? '1_dissection' : '7_final_decree'}`]
            const hasOpinion =
              opinions.rounds &&
              ((experts.indexOf(expert) < 4 && opinions.rounds['1_dissection']) ||
                (experts.indexOf(expert) >= 4 && opinions.rounds['7_standard_decree']))

            return (
              <div key={expert.id} className="col-6 col-md-3">
                <div
                  className={`p-3 rounded-4 border transition-all h-100 ${isThinking ? 'border-gold bg-gold bg-opacity-5 shadow-sm' : 'border-gold border-opacity-10 bg-black bg-opacity-40'}`}
                >
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className={`p-2 rounded-circle bg-dark bg-opacity-50 ${expert.color}`}>
                      {expert.icon}
                    </div>
                    <div className="overflow-hidden">
                      <div
                        className="small fw-bold text-white text-truncate"
                        style={{ fontSize: '11px' }}
                      >
                        {expert.name}
                      </div>
                      <div className="text-secondary text-truncate" style={{ fontSize: '9px' }}>
                        {expert.model}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 d-flex align-items-center gap-2">
                    {isThinking ? (
                      <div className="d-flex align-items-center gap-2 text-gold px-2">
                        <Loader2 size={12} className="animate-spin" />
                        <span style={{ fontSize: '10px' }}>يشرح البيانات...</span>
                      </div>
                    ) : hasOpinion ? (
                      <div className="d-flex align-items-center gap-2 text-success px-2">
                        <CheckCircle2 size={12} />
                        <span style={{ fontSize: '10px' }}>اكتمل التحليل</span>
                      </div>
                    ) : (
                      <div className="text-secondary px-2 opacity-25" style={{ fontSize: '10px' }}>
                        في الانتظار
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 p-3 bg-dark bg-opacity-50 rounded-4 border border-gold border-opacity-10">
          <div className="d-flex align-items-start gap-3">
            <div className="bg-gold bg-opacity-10 p-2 rounded-3 text-gold">
              <Microscope size={18} />
            </div>
            <div className="flex-grow-1">
              <div className="small text-secondary mb-1 fw-bold">الجدول الزمني للبحث العلمي:</div>
              <div className="text-silver small" style={{ lineHeight: '1.6', minHeight: '3em' }}>
                {isProcessing ? (
                  <span className="typewriter">
                    {session.status === 'collecting_data' &&
                      'يتم جلب سجل 10 سنوات (3650 يوم) من البيانات التاريخية ومشاعر السوق...'}
                    {session.status === 'pattern_matching' &&
                      'جاري البحث عن أنماط مشابهة للوضع الحالي في قاعدة البيانات الضخمة (Quant Search)...'}
                    {session.status === 'round_1_analysis' &&
                      'الجولة 1: الخبراء يقومون بتشريح البيانات التاريخية وفصل "الضجيج" عن الإشارات الحقيقية.'}
                    {session.status === 'round_2_crosstalk' &&
                      'الجولة 2: صياغة الفرضيات الرياضية وتحديد نقاط الدخول بناءً على "النمط الذهبي".'}
                    {session.status === 'round_3_guardian' &&
                      'الجولة 3 (هجوم الفريق الأحمر): الحارس يحاول إفشال الفرضيات عبر محاكاة أسوأ السيناريوهات.'}
                    {session.status === 'round_4_refinement' &&
                      'الجولة 4: تنقيح الاستراتيجيات بناءً على نتائج الهجوم المعاكس وتعديل مؤشرات المخاطرة.'}
                    {session.status === 'round_5_stress_test' &&
                      'الجولة 5: محاكاة أزمة "الصندوق الأسود" (Stress Testing) لضمان الصمود أمام الفلاش كراش.'}
                    {session.status === 'round_6_audit' &&
                      'الجولة 6: التدقيق المنطقي الشامل لضمان توافق جميع آراء الخبراء مع الدستور العلمي.'}
                    {session.status === 'round_7_decree' &&
                      'الجولة 7: إصدار المرسوم الملكي النهائي وتوليد الاستراتيجية القابلة للتنفيذ.'}
                    {session.status === 'round_8_advanced_learning' &&
                      'الجولة 8: محرك التعلم المتطور يدمج الذاكرة القصيرة للبحث عن أنماط السوق اللحظية.'}
                    {session.status === 'backtesting_7_3' &&
                      'تم التوصل للمرسوم النهائي؛ جاري التحقق من الاستراتيجيات برمجياً قبل اعتمادها.'}
                  </span>
                ) : (
                  'بانتظار بدء الجلسة العلمية لمجلس الحكماء...'
                )}
              </div>
            </div>
          </div>
        </div>

        <style>{`
          .shadow-gold { box-shadow: 0 10px 40px rgba(212, 175, 55, 0.05); }
          .animate-spin { animation: spin 1.5s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .typewriter { overflow: hidden; display: inline-block; animation: typing 3.5s steps(50, end); }
          @keyframes typing { from { width: 0 } to { width: 100% } }
          .scale-110 { transform: scale(1.1); }
          .hover-ruby:hover { background: rgba(220, 38, 38, 0.2) !important; transform: translateY(-1px); }
        `}</style>
      </div>
    </>
  )
}

export default MeetingSimulation
