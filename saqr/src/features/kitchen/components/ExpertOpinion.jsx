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
    name: 'الشاريتست (DeepSeek)',
    icon: <BarChart2 size={18} className="text-gold" />,
    description: 'خبير التحليل الفني وقراءة الشموع'
  },
  reporter: {
    name: 'المذيع (Grok)',
    icon: <Mic2 size={18} className="text-info" />,
    description: 'محلل الأخبار والمشاعر العامة'
  },
  pulser: {
    name: 'النبّاض (Grok)',
    icon: <Activity size={18} className="text-warning" />,
    description: 'مراقب زخم السوق والتدفقات'
  },
  radar: {
    name: 'الرادار (DeepSeek)',
    icon: <Radar size={18} className="text-emerald" />,
    description: 'صائد الفرص والاختراقات'
  },
  guardian: {
    name: 'الحارس (DeepSeek)',
    icon: <ShieldAlert size={18} className="text-ruby" />,
    description: 'صمام الأمان ومنع المخاطر'
  },
  investigator: {
    name: 'المحقق (Claude)',
    icon: <Search size={18} className="text-silver" />,
    description: 'مدقق البيانات والبحث المتعمق'
  },
  prince: {
    name: 'العادي (Claude)',
    icon: <Crown size={18} className="text-gold" />,
    description: 'متخذ القرار النهائي (Standard)'
  },
  king: {
    name: 'المطور (LSTM)',
    icon: <Cpu size={18} className="text-purple" />,
    description: 'النموذج المتقدم للتنبؤ (Advanced)'
  },
  engineer: {
    name: 'المهندس (Claude)',
    icon: <Settings size={18} className="text-silver" />,
    description: 'محول الاستراتيجية لكود قابل للاختبار'
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

  return (
    <div
      className="p-3 h-100 border-top border-1 border-gold border-opacity-10 shadow-sm"
      style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '14px' }}
    >
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <div
            className="p-2 rounded-3 border border-gold border-opacity-5"
            style={{ background: 'rgba(197, 160, 89, 0.05)' }}
          >
            {React.cloneElement(info.icon, { size: 16, className: 'opacity-75' })}
          </div>
          <div>
            <div
              className="fw-bold text-silver small opacity-90"
              style={{ letterSpacing: '0.3px', color: '#e2e8f0' }}
            >
              {info.name}
            </div>
            <div className="d-flex gap-1 mt-1">
              {getBrainsForExpert(expertKey.toLowerCase()).map((b) => (
                <span
                  key={b}
                  title={`${brainTypes[b].name}: ${brainTypes[b].desc}`}
                  style={{ fontSize: '10px', cursor: 'help' }}
                >
                  {brainTypes[b].symbol}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div
        className="small text-secondary p-2 rounded-2 border border-gold border-opacity-5"
        style={{
          lineHeight: '1.8',
          fontSize: '11.5px',
          background: 'rgba(0,0,0,0.15)',
          color: '#94a3b8'
        }}
      >
        {opinion}
      </div>
    </div>
  )
}

export default ExpertOpinion
