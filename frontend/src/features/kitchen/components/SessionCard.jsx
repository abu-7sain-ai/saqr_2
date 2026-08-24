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
  XCircle,
  FileDown,
  FileText
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
    if (passedStrategies.length > 0) {
      return `تم اعتماد وإصدار ${passedStrategies.length} استراتيجية بنجاح من مجلس الخبراء والأمير وتوزيعها للتنفيذ.`
    }
    if (isFailed) {
      return opinionsData.error || 'فشلت الجلسة أثناء المعالجة.'
    }
    if (isRunning) {
      return 'جاري معالجة البيانات وتحليل السوق ومناقشات الخبراء...'
    }
    return opinionsData.error || 'لم تنجح أي استراتيجية في اجتياز معايير الـ Backtest.'
  }

  const formatType = (t) => {
    const map = {
      conservative: 'محافظة (تحفيزية)',
      moderate: 'متوسطة',
      aggressive: 'عدوانية / مضاربية'
    }
    return map[String(t).toLowerCase()] || t || 'عامة'
  }

  // ✅ تنزيل تقرير الجلسة كـ PDF احترافي
  const handleExportPDF = (e) => {
    e.stopPropagation()
    const printWindow = window.open('', '_blank', 'width=950,height=1000')
    if (!printWindow) {
      alert('يرجى السماح بالنوافذ المنبثقة لتحميل وطباعة ملف الـ PDF')
      return
    }

    const expertRoundsList = [
      { key: 'chartist',     name: '1. الشارتيست الكمي (تحليل السلوك السعري والشموع والمؤشرات)', round: '1_dissection' },
      { key: 'reporter',     name: '2. المذيع صقر (تحليل المشاعر العامة والأخبار والزخم)',     round: '1_dissection' },
      { key: 'pulser',       name: '3. النبّاض (استشعار النبضات وفرضيات الدخول الرقمية)',      round: '2_hypotheses' },
      { key: 'radar',        name: '4. الرادار (مراقبة الثبات الإحصائي وتدفق السيولة)',       round: '2_hypotheses' },
      { key: 'guardian',     name: '5. الحارس الصارم (هجوم الأمان واختبار صمود الأزمات)',     round: '3_adversarial' },
      { key: 'investigator', name: '6. المحقق (التدقيق ومطابقة الفرضيات وكشف التناقضات)',    round: '3_adversarial' },
      { key: 'engineer',     name: '7. المهندس الكمي (ضبط مستويات الوقف ونسب المخاطرة)',     round: '4_refinement' },
      { key: 'prince',       name: '8. الأمير (صانع القرار القياسي واعتماد الاستراتيجيات)',   round: '7_standard_decree' },
    ]

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>تقرير اجتماع الخبراء العلمي - #${session.id.slice(0, 8)}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
          body {
            font-family: 'Cairo', sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 35px;
            margin: 0;
            line-height: 1.7;
          }
          .header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 18px;
            margin-bottom: 25px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .logo {
            font-size: 22px;
            font-weight: 800;
            color: #b45309;
          }
          .meta-info {
            font-size: 12px;
            color: #475569;
            margin-top: 4px;
          }
          .badge {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
          }
          .decree-box {
            background: #f8fafc;
            border-right: 5px solid #d4af37;
            padding: 18px;
            border-radius: 8px;
            margin-bottom: 25px;
            font-size: 13.5px;
            border: 1px solid #e2e8f0;
            border-right: 5px solid #d4af37;
          }
          .section-title {
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 8px;
            margin: 30px 0 16px 0;
          }
          .strategies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
          }
          .strat-card {
            border: 1px solid #cbd5e1;
            border-radius: 10px;
            padding: 16px;
            background: #ffffff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.03);
          }
          .strat-card h4 {
            margin: 0 0 12px 0;
            font-size: 14.5px;
            color: #0f172a;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 6px;
          }
          .strat-row {
            display: flex;
            justify-content: space-between;
            font-size: 12.5px;
            margin-bottom: 7px;
            padding-bottom: 5px;
            border-bottom: 1px dashed #f1f5f9;
          }
          .debate-item {
            margin-bottom: 16px;
            padding: 14px 18px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            page-break-inside: avoid;
          }
          .expert-name {
            font-weight: 700;
            color: #b45309;
            font-size: 13.5px;
            margin-bottom: 6px;
          }
          .expert-text {
            font-size: 12.5px;
            color: #334155;
            white-space: pre-wrap;
            line-height: 1.8;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            font-size: 11.5px;
            color: #94a3b8;
          }
          @media print {
            body { padding: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">🦅 منصة صقر — محضر اجتماع الخبراء العلمي الرسمي</div>
            <div class="meta-info">
              جلسة رقم #${session.id.slice(0, 8)} | العملة: ${session.symbol} | التاريخ: ${formatDate(session.created_at)}
            </div>
          </div>
          <div>
            <span class="badge">${session.market_type === 'stable' ? 'سوق مستقر' : 'سوق متوتر'}</span>
          </div>
        </div>

        <div class="decree-box">
          <strong style="color: #b45309;">📜 خلاصة قرار المجلس والأمير:</strong><br />
          ${getSummary()}
        </div>

        <div class="section-title">📊 الاستراتيجيات المعتمدة الصادرة عن المجلس (${finalStrategies.length} استراتيجية):</div>
        <div class="strategies-grid">
          ${finalStrategies.map((s, idx) => `
            <div class="strat-card">
              <h4>${s.name || `استراتيجية ${idx + 1}`} (درجة الثقة: ${s.confidence_score ? String(s.confidence_score).replace('%', '') : '85'}%)</h4>
              <div class="strat-row"><span>نوع الاستراتيجية:</span><strong>${formatType(s.type)}</strong></div>
              <div class="strat-row"><span>الهدف الربحي (TP):</span><strong style="color: #16a34a;">+${s.target_pct}%</strong></div>
              <div class="strat-row"><span>وقف الخسارة الصارم (SL):</span><strong style="color: #dc2626;">-${s.sl_pct}%</strong></div>
              <div class="strat-row"><span>نسبة العائد للمخاطرة:</span><strong>1:${s.risk_reward || (Number(s.target_pct) / Math.max(0.1, Number(s.sl_pct))).toFixed(1)}</strong></div>
              ${s.entry_description ? `<div style="font-size: 11.5px; color: #475569; margin-top: 10px; line-height: 1.6;"><strong>نص الوصف الفني للدخول:</strong><br />${s.entry_description}</div>` : ''}
            </div>
          `).join('')}
        </div>

        <div class="section-title">💬 محضر المداولات الكامل والحوار بين الخبراء الـ 8:</div>
        ${expertRoundsList.map(exp => {
          const rData = rounds[exp.round] || {}
          const op = rData[exp.key]
          if (!op) return ''
          const textContent = typeof op === 'object' ? JSON.stringify(op, null, 2) : String(op)
          return `
            <div class="debate-item">
              <div class="expert-name">👤 ${exp.name}</div>
              <div class="expert-text">${textContent}</div>
            </div>
          `
        }).join('')}

        <div class="footer">
          تم إصدار هذا التقرير تلقائياً من محرك التداول الكمي والذكاء الاصطناعي — منصة صقر (SAQR)
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
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

        <div className="d-flex gap-2 align-items-center flex-wrap">
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

          {/* ✅ زر تنزيل التقرير كـ PDF */}
          <button
            onClick={handleExportPDF}
            className="btn btn-dark border border-gold border-opacity-30 p-2 px-3 rounded-3 d-flex align-items-center gap-2 text-gold shadow-sm"
            style={{ background: 'rgba(212, 175, 55, 0.1)', cursor: 'pointer' }}
            title="تنزيل / طباعة تقرير الجلسة والحوار كـ PDF"
          >
            <FileDown size={16} />
            <span className="small fw-bold">تحميل التقرير (PDF)</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('هل أنت متأكد من رغبتك في إيقاف/حذف هذا الاجتماع؟')) {
                onDelete(session.id)
              }
            }}
            className="btn p-2 px-3 rounded-3 d-flex align-items-center gap-2"
            style={{ background: 'rgba(220, 38, 38, 0.1)', color: 'var(--saqr-ruby)', border: 'none' }}
            title="حذف الجلسة"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="border-top border-white border-opacity-5 pt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="small fw-bold d-flex align-items-center gap-2 text-gold">
            <Crown size={18} /> خلاصة قرار مجلس الخبراء والأمير:
          </div>
        </div>
        <div
          className="p-4 rounded-4 bg-black bg-opacity-40 border border-white border-opacity-5 text-silver small mb-4"
          style={{
            lineHeight: '1.8',
            borderRight: `4px solid ${passedStrategies.length > 0 ? 'var(--saqr-emerald)' : isFailed ? 'var(--saqr-ruby)' : 'var(--saqr-gold)'}`,
            color: '#CBD5E1'
          }}
        >
          {getSummary()}
        </div>

        {/* ✅ عرض الاستراتيجيات */}
        {finalStrategies.length > 0 && (
          <div className="row g-4 mb-4">
            {finalStrategies.map((strat, idx) => {
              const rawConfidence = strat.confidence_score ? String(strat.confidence_score).replace('%', '') : '85'
              const discWr = Number(strat.backtest_stats?.discovery?.win_rate)
              const valWr = Number(strat.backtest_stats?.validation?.win_rate || strat.backtest_stats?.discovery?.win_rate)
              const sharpeVal = Number(strat.backtest_stats?.discovery?.sharpe)
              const hasNumericBacktest = Number.isFinite(discWr) && discWr > 0

              return (
                <div key={idx} className="col-12 col-lg-4">
                  <div className="glass-card p-4 h-100 shadow-lg">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="badge bg-gold text-black fw-bold px-3 py-2" style={{ borderRadius: '8px' }}>
                        {strat.name || `استراتيجية ${idx + 1}`}
                      </span>
                      <div className="text-silver opacity-75" style={{ fontSize: '11px' }}>
                        درجة الثقة: <span className="text-success fw-bold">{rawConfidence}%</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                        <span className="text-silver opacity-60">النوع:</span>
                        <span className="text-white fw-bold">{formatType(strat.type)}</span>
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
                        <span className="text-silver opacity-60">نسبة العائد للمخاطرة:</span>
                        <span className="text-gold fw-bold">1:{strat.risk_reward || (Number(strat.target_pct) / Math.max(0.1, Number(strat.sl_pct))).toFixed(1)}</span>
                      </div>
                    </div>

                    {/* Backtest stats */}
                    {strat.backtest_stats && (
                      <div className="p-3 rounded-3 bg-black bg-opacity-40 mb-3 small border border-white border-opacity-5">
                        <div className="text-secondary mb-2 fw-bold d-flex justify-content-between">
                          <span>نتائج الفحص التاريخي (7Y/3Y):</span>
                          <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20" style={{ fontSize: '10px' }}>
                            اجتياز معتمد
                          </span>
                        </div>
                        {hasNumericBacktest ? (
                          <>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-silver opacity-60">نسبة النجاح (7Y):</span>
                              <span className="text-success fw-bold">{(discWr * 100).toFixed(1)}%</span>
                            </div>
                            <div className="d-flex justify-content-between mb-1">
                              <span className="text-silver opacity-60">نسبة النجاح (3Y):</span>
                              <span className="text-info fw-bold">{(Number.isFinite(valWr) ? valWr * 100 : discWr * 100).toFixed(1)}%</span>
                            </div>
                            {Number.isFinite(sharpeVal) && (
                              <div className="d-flex justify-content-between">
                                <span className="text-silver opacity-60">مؤشر شارب (Sharpe):</span>
                                <span className="text-gold fw-bold">{sharpeVal.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-secondary" style={{ fontSize: '11px', lineHeight: '1.6' }}>
                            {strat.backtest_stats.reason || 'اجتازت الفحص التكتيكي وإدارة المخاطر.'}
                          </div>
                        )}
                      </div>
                    )}

                    {strat.entry_description && (
                      <div className="p-3 rounded-3 bg-black bg-opacity-40 border border-white border-opacity-5 mb-3 user-select-text">
                        <div className="text-gold fw-bold extra-small mb-1">📝 الوصف الفني وقواعد الدخول:</div>
                        <div className="text-silver small" style={{ fontSize: '11.5px', lineHeight: '1.7', color: '#cbd5e1' }}>
                          {strat.entry_description}
                        </div>
                      </div>
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
            )
          })}
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