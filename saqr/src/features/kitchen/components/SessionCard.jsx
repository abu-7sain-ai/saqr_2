import React, { useState } from 'react'
import {
  Calendar,
  TrendingUp,
  AlertTriangle,
  Target,
  ChevronDown,
  ChevronUp,
  Users,
  Crown,
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import ExpertOpinion from './ExpertOpinion'

const SessionCard = ({ session, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ✅ FIX: Parse expert_opinions صح
  const opinionsData =
    typeof session.expert_opinions === 'string'
      ? JSON.parse(session.expert_opinions)
      : session.expert_opinions || {}

  // ✅ FIX: النتايج محفوظة في final_decision.passed (مش .strategies)
  const passedStrategies = session.final_decision?.passed || []
  const failedStrategies = session.final_decision?.failed || []
  const finalStrategies = passedStrategies  // اللي عدت الـ backtest

  // ✅ FIX: استخرج آراء الخبراء من expert_opinions.rounds
  const rounds = opinionsData.rounds || {}

  // بناء currentOpinions من الجولات المختلفة
  const currentOpinions = {}
  
  // جولة 1: chartist + reporter
  if (rounds['1_dissection']) {
    Object.assign(currentOpinions, rounds['1_dissection'])
  }
  // جولة 2: pulser + radar
  if (rounds['2_hypotheses']) {
    Object.assign(currentOpinions, rounds['2_hypotheses'])
  }
  // جولة 3: guardian + investigator
  if (rounds['3_adversarial']) {
    Object.assign(currentOpinions, rounds['3_adversarial'])
  }
  // جولة 4: chartist + engineer
  if (rounds['4_refinement']) {
    Object.assign(currentOpinions, rounds['4_refinement'])
  }
  // جولة 5: guardian + pulser
  if (rounds['5_stress_test']) {
    Object.assign(currentOpinions, rounds['5_stress_test'])
  }
  // جولة 6: investigator
  if (rounds['6_audit']) {
    Object.assign(currentOpinions, rounds['6_audit'])
  }
  // جولة 7: prince
  if (rounds['7_standard_decree']) {
    Object.assign(currentOpinions, rounds['7_standard_decree'])
  }

  const getStatusInfo = (status) => {
    const map = {
      'pending':              { label: 'في الانتظار',              color: 'text-secondary' },
      'running_session':      { label: 'جاري التشغيل',             color: 'text-info' },
      'collecting_data':      { label: 'جاري جمع البيانات',        color: 'text-info' },
      'pattern_matching':     { label: 'تحليل الأنماط التاريخية',  color: 'text-info' },
      'round_1_analysis':     { label: 'الجولة 1: التشريح',        color: 'text-warning' },
      'round_2_crosstalk':    { label: 'الجولة 2: الفرضيات',       color: 'text-warning' },
      'round_3_guardian':     { label: 'الجولة 3: هجوم الحارس',   color: 'text-danger' },
      'round_4_refinement':   { label: 'الجولة 4: التحسين',        color: 'text-warning' },
      'round_5_stress_test':  { label: 'الجولة 5: اختبار الضغط',  color: 'text-danger' },
      'round_6_audit':        { label: 'الجولة 6: التدقيق',        color: 'text-warning' },
      'round_7_decree':       { label: 'الجولة 7: المرسوم',        color: 'text-gold' },
      'round_8_advanced_learning': { label: 'الجولة 8: المتطور',   color: 'text-purple' },
      'backtesting_7_3':      { label: 'الاختبار التاريخي 7+3',    color: 'text-info' },
      'completed':            { label: 'اكتملت الجلسة ✓',          color: 'text-success' },
      'failed':               { label: 'فشلت الجلسة',              color: 'text-danger' },
    }
    return map[status] || { label: status || 'غير معروف', color: 'text-secondary' }
  }

  const statusInfo = getStatusInfo(session.status)
  const isCompleted = session.status === 'completed'
  const isFailed = session.status === 'failed'
  const isRunning = !isCompleted && !isFailed

  // ✅ ملخص النتيجة
  const getSummary = () => {
    if (isFailed) {
      return opinionsData.error || 'فشلت الجلسة لسبب غير معروف.'
    }
    if (isCompleted && passedStrategies.length > 0) {
      return `تم اعتماد ${passedStrategies.length} استراتيجية بنجاح من أصل ${passedStrategies.length + failedStrategies.length} مقترحة.`
    }
    if (isRunning) {
      return 'جاري معالجة البيانات وتحليل السوق...'
    }
    return opinionsData.error || 'لم تنجح أي استراتيجية في اجتياز معايير الـ Backtest.'
  }

  return (
    <div
      className="glass-panel p-4 mb-4 transition-all border-start border-4"
      style={{
        borderLeftColor: isCompleted
          ? 'var(--saqr-emerald)'
          : isFailed
            ? 'var(--saqr-ruby)'
            : 'var(--saqr-gold)',
        background: 'var(--saqr-surface)',
        boxShadow: 'var(--saqr-shadow)'
      }}
    >
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="p-3 rounded-circle bg-dark bg-opacity-50"
            style={{ border: '1px solid rgba(255, 215, 0, 0.1)' }}>
            <Users size={24} className={
              isCompleted ? 'text-success' : isFailed ? 'text-danger' : 'text-gold'
            } />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <h5 className="m-0 text-white fw-bold">
                جلسة اجتماع الخبراء <span className="text-gold">#{session.id.slice(0, 3)}</span>
              </h5>
              <span className={`badge bg-dark bg-opacity-50 border border-opacity-20 px-3 py-2 ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <div className="small text-silver opacity-75 d-flex align-items-center gap-2 mt-1">
              <Calendar size={14} className="text-gold" />
              {formatDate(session.created_at)} |{' '}
              <Target size={14} className="text-info" />
              {session.symbol}
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <div className="badge bg-dark bg-opacity-50 p-2 px-3 border border-gold border-opacity-10 rounded-3">
            <TrendingUp size={14} className="text-info me-1" />
            <span className="small text-silver">
              {session.market_type === 'stable' ? 'سوق مستقر' : 'سوق متوتر'}
            </span>
          </div>

          {/* ✅ عداد الاستراتيجيات لو الجلسة اكتملت */}
          {isCompleted && (
            <div className="badge bg-success bg-opacity-10 border border-success border-opacity-20 p-2 px-3 rounded-3">
              <CheckCircle2 size={14} className="text-success me-1" />
              <span className="small text-success fw-bold">{passedStrategies.length} استراتيجية</span>
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('هل أنت متأكد من رغبتك في إيقاف/حذف هذا الاجتماع؟')) {
                onDelete(session.id)
              }
            }}
            className="btn p-2 px-3 rounded-3 d-flex align-items-center gap-2"
            style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--saqr-ruby)', border: 'none' }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="border-top border-white border-opacity-5 pt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="small fw-bold d-flex align-items-center gap-2 text-gold">
            <Crown size={18} /> خلاصة قرار العادي:
          </div>
        </div>
        <div
          className="p-4 rounded-4 bg-black bg-opacity-40 border border-white border-opacity-5 text-silver small mb-4"
          style={{
            lineHeight: '1.8',
            borderRight: `4px solid ${isCompleted ? 'var(--saqr-emerald)' : isFailed ? 'var(--saqr-ruby)' : 'var(--saqr-gold)'}`,
            color: '#CBD5E1'
          }}
        >
          {getSummary()}
        </div>

        {/* ✅ FIX: عرض الاستراتيجيات من passed (مش strategies) */}
        {finalStrategies.length > 0 && (
          <div className="row g-4 mb-4">
            {finalStrategies.map((strat, idx) => (
              <div key={idx} className="col-12 col-lg-4">
                <div className="glass-card p-4 h-100 shadow-lg">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge bg-gold text-black fw-bold px-3 py-2" style={{ borderRadius: '8px' }}>
                      {strat.name || `استراتيجية ${idx + 1}`}
                    </span>
                    <div className="text-silver opacity-50" style={{ fontSize: '11px' }}>
                      ثقة: <span className="text-success fw-bold">{strat.confidence_score || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    {/* ✅ FIX: الـ factory بيبعت target_pct و sl_pct مش entry/targets/sl */}
                    <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                      <span className="text-silver opacity-60">النوع:</span>
                      <span className="text-white fw-bold">{strat.type || 'N/A'}</span>
                    </div>
                    <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                      <span className="text-silver opacity-60">الهدف:</span>
                      <span className="text-success fw-bold">+{strat.target_pct}%</span>
                    </div>
                    <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                      <span className="text-silver opacity-60">وقف الخسارة:</span>
                      <span className="text-danger fw-bold">-{strat.sl_pct}%</span>
                    </div>
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-silver opacity-60">نسبة المخاطرة/العائد:</span>
                      <span className="text-gold fw-bold">{strat.risk_reward || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Backtest stats */}
                  {strat.backtest_stats && (
                    <div className="p-3 rounded-3 bg-black bg-opacity-30 mb-3 small">
                      <div className="text-secondary mb-2 fw-bold">نتائج الـ Backtest:</div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-silver opacity-60">نسبة النجاح (7Y):</span>
                        <span className="text-success">{(strat.backtest_stats.discovery?.win_rate * 100)?.toFixed(1)}%</span>
                      </div>
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-silver opacity-60">نسبة النجاح (3Y):</span>
                        <span className="text-info">{(strat.backtest_stats.validation?.win_rate * 100)?.toFixed(1)}%</span>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-silver opacity-60">Sharpe:</span>
                        <span className="text-gold">{strat.backtest_stats.discovery?.sharpe?.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {strat.entry_description && (
                    <p className="small text-secondary mb-3" style={{ lineHeight: '1.6' }}>
                      {strat.entry_description}
                    </p>
                  )}

                  <button
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('open-cloning-modal', {
                        detail: { strategy: { ...strat, session_id: session.id, market_type: session.market_type } }
                      }))
                    }}
                    className="btn btn-gold w-100 mt-2 fw-bold"
                  >
                    استنسـاخ الموظف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* لو اكتملت ومفيش استراتيجيات */}
        {isCompleted && finalStrategies.length === 0 && (
          <div className="text-center p-4 rounded-4 border border-danger border-opacity-20 bg-danger bg-opacity-5 mb-4">
            <XCircle size={32} className="text-danger mb-2" />
            <div className="text-danger small fw-bold">لم تجتز أي استراتيجية معايير الـ Backtest الصارمة</div>
            {failedStrategies.length > 0 && (
              <div className="text-secondary small mt-2">
                {failedStrategies[0]?.failure_reason || 'المعايير الكمية لم تتحقق'}
              </div>
            )}
          </div>
        )}

        <div className="d-flex justify-content-end mt-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="btn btn-dark-gold border-0 small d-flex align-items-center gap-1 p-2 px-3 rounded-pill"
            style={{ fontSize: '11px', background: 'rgba(212, 175, 55, 0.05)' }}
          >
            {isExpanded ? (
              <> إخفاء كواليس النقاش <ChevronUp size={16} /> </>
            ) : (
              <> عرض تفاصيل حوار الخبراء <ChevronDown size={16} /> </>
            )}
          </button>
        </div>
      </div>

      {/* ✅ FIX: عرض آراء الخبراء من البنية الصح */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-top border-gold border-opacity-10 animate-fade-in">
          <h6 className="text-silver mb-4 fw-bold small d-flex align-items-center gap-2 opacity-75">
            <Users size={16} className="text-gold" /> أرشيف جولات الاجتماع والمداولات (التدفق الزمني):
          </h6>

          <div className="d-flex flex-column gap-4 position-relative">
            <div
              className="position-absolute h-100 border-start border-gold border-opacity-10"
              style={{ left: '15px', zIndex: 0 }}
            ></div>

            {[
              { key: 'chartist',     name: 'الشارتيست',  round: '1_dissection' },
              { key: 'reporter',     name: 'المذيع',      round: '1_dissection' },
              { key: 'pulser',       name: 'النبّاض',     round: '2_hypotheses' },
              { key: 'radar',        name: 'الرادار',     round: '2_hypotheses' },
              { key: 'guardian',     name: 'الحارس',      round: '3_adversarial' },
              { key: 'investigator', name: 'المحقق',      round: '3_adversarial' },
              { key: 'engineer',     name: 'المهندس',     round: '4_refinement' },
              { key: 'prince',       name: 'الأمير',      round: '7_standard_decree' },
            ].map((expert, idx) => {
              const roundData = rounds[expert.round] || {}
              const opinion = roundData[expert.key]

              if (!opinion && isCompleted) return null

              return (
                <div key={expert.key} className="d-flex gap-4 position-relative" style={{ zIndex: 1 }}>
                  <div
                    className="bg-black rounded-circle border border-gold border-opacity-20 d-flex align-items-center justify-content-center"
                    style={{ width: '32px', height: '32px', flexShrink: 0 }}
                  >
                    <span className="text-gold fw-bold" style={{ fontSize: '10px' }}>{idx + 1}</span>
                  </div>
                  <div className="flex-grow-1">
                    <ExpertOpinion
                      expertKey={expert.key}
                      expertName={expert.name}
                      opinion={opinion || '... في انتظار الدور ...'}
                    />
                  </div>
                </div>
              )
            })}

            {Object.keys(rounds).length === 0 && isRunning && (
              <div className="text-center py-4 text-secondary small">
                <div className="spinner-border spinner-border-sm text-gold me-2"></div>
                بانتظار اكتمال التحليل في اجتماع الخبراء...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionCard