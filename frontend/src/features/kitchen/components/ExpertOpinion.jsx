import React from 'react'
import {
  BarChart2,
  Radar,
  ShieldAlert,
  Mic2,
  Activity,
  Search,
  Crown,
  Settings,
  Cpu
} from 'lucide-react'
const expertInfo = {
  chartist: {
    name: 'الشارتيست الكمي',
    icon: <BarChart2 size={18} className="text-gold" />,
    description: 'خبير التحليل الفني وقراءة الشموع'
  },
  reporter: {
    name: 'المذيع صقر',
    icon: <Mic2 size={18} className="text-info" />,
    description: 'محلل الأخبار والمشاعر العامة'
  },
  pulser: {
    name: 'النبّاض',
    icon: <Activity size={18} className="text-warning" />,
    description: 'مراقب زخم السوق والتدفقات'
  },
  radar: {
    name: 'الرادار',
    icon: <Radar size={18} className="text-emerald" />,
    description: 'صائد الفرص والاختراقات'
  },
  guardian: {
    name: 'الحارس الصارم',
    icon: <ShieldAlert size={18} className="text-ruby" />,
    description: 'صمام الأمان ومنع المخاطر'
  },
  investigator: {
    name: 'المحقق',
    icon: <Search size={18} className="text-silver" />,
    description: 'مدقق البيانات والبحث المتعمق'
  },
  prince: {
    name: 'الأمير (صانع القرار القياسي)',
    icon: <Crown size={18} className="text-gold" />,
    description: 'متخذ القرار النهائي (Standard)'
  },
  advanced: {
    name: 'الملك / العقل المطور',
    icon: <Cpu size={18} className="text-purple" />,
    description: 'النموذج المتقدم للتعلم والتطوير (Advanced)'
  },
  engineer: {
    name: 'المهندس الكمي',
    icon: <Settings size={18} className="text-silver" />,
    description: 'محول الاستراتيجية ومستويات الأمان'
  }
}

export const brainTypes = {
  reactive: { name: 'التحليلي', symbol: '🧠', desc: 'Reactive Agent' },
  cbr: { name: 'العرّافي', symbol: '🔮', desc: 'Case-Based Reasoning' },
  predictive: { name: 'التنبؤي', symbol: '📈', desc: 'Predictive Model' },
  utility: { name: 'الحسابي', symbol: '⚖️', desc: 'Utility-Based Agent' },
  lstm: { name: 'LSTM', symbol: '🧬', desc: 'LSTM via Keras' },
  learning: { name: 'عقل التعلم', symbol: '⚡', desc: 'Learning Agent' },
  mas: { name: 'متعدد العقول', symbol: '🌐', desc: 'Multi-Agent System' }
}

const getBrainsForExpert = (key) => {
  const common = ['reactive', 'cbr']
  if (key === 'prince') return [...common, 'predictive', 'utility']
  if (key === 'king') return [...common, 'predictive', 'learning', 'lstm']
  return common
}

const ExpertOpinion = ({ expertKey, opinion }) => {
  const info = expertInfo[expertKey.toLowerCase()] || {
    name: expertKey,
    icon: <Activity size={18} />,
    description: 'خبير ذكاء اصطناعي'
  }

  const formatOpinionText = (text) => {
    if (!text) return '... في انتظار مشاركة الخبير ...'
    if (typeof text === 'object') {
      try {
        return JSON.stringify(text, null, 2)
      } catch (e) {
        return String(text)
      }
    }
    return String(text)
  }

  return (
    <div
      className="p-3 h-100 border border-1 border-gold border-opacity-15 shadow-sm"
      style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '16px' }}
    >
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="p-2 rounded-3 border border-gold border-opacity-10"
            style={{ background: 'rgba(212, 175, 55, 0.08)' }}
          >
            {React.cloneElement(info.icon, { size: 18, className: 'text-gold' })}
          </div>
          <div>
            <div
              className="fw-bold text-white small"
              style={{ fontSize: '13px', color: '#f8fafc' }}
            >
              {info.name}
            </div>
            <div className="extra-small text-secondary" style={{ fontSize: '11px' }}>
              {info.description}
            </div>
          </div>
        </div>
      </div>
      <div
        className="text-silver p-3 rounded-3 border border-white border-opacity-5 user-select-text"
        style={{
          lineHeight: '1.9',
          fontSize: '12.5px',
          background: 'rgba(0,0,0,0.25)',
          color: '#cbd5e1',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {formatOpinionText(opinion)}
      </div>
    </div>
  )
}

export default ExpertOpinion
