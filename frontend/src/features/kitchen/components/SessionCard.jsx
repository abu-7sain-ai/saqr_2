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
  FileText,
  Loader2
} from 'lucide-react'
import ExpertOpinion from './ExpertOpinion'

const SessionCard = ({ session, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPdfGenerating, setIsPdfGenerating] = useState(false)

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ✅ Parse expert_opinions
  const opinionsData =
    typeof session.expert_opinions === 'string'
      ? JSON.parse(session.expert_opinions)
      : session.expert_opinions || {}

  const passedStrategies = session.final_decision?.passed || []
  const failedStrategies = session.final_decision?.failed || []
  const finalStrategies = passedStrategies  // اللي عدت الـ backtest

  const rounds = opinionsData.rounds || {}

  // بناء currentOpinions من الجولات المختلفة
  const currentOpinions = {}
  if (rounds['1_dissection']) Object.assign(currentOpinions, rounds['1_dissection'])
  if (rounds['2_hypotheses']) Object.assign(currentOpinions, rounds['2_hypotheses'])
  if (rounds['3_adversarial']) Object.assign(currentOpinions, rounds['3_adversarial'])
  if (rounds['4_refinement']) Object.assign(currentOpinions, rounds['4_refinement'])
  if (rounds['5_stress_test']) Object.assign(currentOpinions, rounds['5_stress_test'])
  if (rounds['6_audit']) Object.assign(currentOpinions, rounds['6_audit'])
  if (rounds['7_standard_decree']) Object.assign(currentOpinions, rounds['7_standard_decree'])

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

  // ✅ استخراج نصوص الخبراء بأمان تام
  const getExpertDialogue = (expertKey, roundKey) => {
    if (rounds?.[roundKey]?.[expertKey]) return rounds[roundKey][expertKey]
    for (const r in rounds) {
      if (rounds[r]?.[expertKey]) return rounds[r][expertKey]
    }
    if (currentOpinions?.[expertKey]) return currentOpinions[expertKey]
    if (opinionsData?.[expertKey]) return opinionsData[expertKey]
    return null
  }

  const stringifyOpinion = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val
    if (typeof val === 'object') {
      if (val.opinion) return String(val.opinion)
      if (val.text) return String(val.text)
      if (val.analysis) return String(val.analysis)
      if (val.hypothesis) return String(val.hypothesis)
      if (val.strategies && Array.isArray(val.strategies)) {
        return val.strategies.map((s, idx) => `• ${s.name || `استراتيجية ${idx+1}`}: الهدف +${s.target_pct}% | الوقف -${s.sl_pct}% | ${s.entry_description || ''}`).join('\n')
      }
      try {
        return JSON.stringify(val, null, 2)
      } catch (e) {
        return String(val)
      }
    }
    return String(val)
  }

  // ✅ تنزيل تقرير الـ PDF مباشرة للجهاز بدون فتح نوافذ
  const handleExportPDF = async (e) => {
    e.stopPropagation()
    if (isPdfGenerating) return

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

    try {
      setIsPdfGenerating(true)

      const allDialogue = []
      for (const exp of expertRoundsList) {
        const raw = getExpertDialogue(exp.key, exp.round)
        if (raw) {
          allDialogue.push({ name: exp.name, text: stringifyOpinion(raw) })
        }
      }

      // Container for PDF generation
      const container = document.createElement('div')
      container.style.position = 'fixed'
      container.style.left = '-9999px'
      container.style.top = '0'
      container.style.width = '790px'
      container.style.padding = '25px'
      container.style.background = '#ffffff'
      container.style.color = '#0f172a'
      container.style.fontFamily = "'Cairo', Tahoma, Arial, sans-serif"
      container.style.direction = 'rtl'
      container.style.textAlign = 'right'
      container.style.lineHeight = '1.7'

      container.innerHTML = `
        <div style="border-bottom: 2px solid #d4af37; padding-bottom: 14px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 19px; font-weight: 800; color: #b45309;">🦅 منصة صقر — محضر اجتماع الخبراء العلمي الرسمي</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">
              جلسة رقم #${session.id.slice(0, 8)} | العملة: ${session.symbol} | التاريخ: ${formatDate(session.created_at)}
            </div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 6px; font-size: 11px; font-weight: bold;">
            ${session.market_type === 'stable' ? 'سوق مستقر' : 'سوق متوتر'}
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-right: 4px solid #d4af37; padding: 14px; border-radius: 6px; margin-bottom: 20px; font-size: 12.5px;">
          <strong style="color: #b45309;">📜 خلاصة قرار المجلس والأمير:</strong><br />
          ${getSummary()}
        </div>

        <div style="font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin: 18px 0 12px 0;">
          📊 الاستراتيجيات المعتمدة الصادرة عن المجلس (${finalStrategies.length} استراتيجية):
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          ${finalStrategies.map((s, idx) => `
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #ffffff;">
              <div style="font-weight: bold; font-size: 13px; color: #0f172a; margin-bottom: 8px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                ${s.name || `استراتيجية ${idx + 1}`} (درجة الثقة: ${s.confidence_score ? String(s.confidence_score).replace('%', '') : '85'}%)
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                <span>النوع:</span><strong>${formatType(s.type)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                <span>الهدف (TP):</span><strong style="color: #16a34a;">+${s.target_pct}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                <span>وقف الخسارة (SL):</span><strong style="color: #dc2626;">-${s.sl_pct}%</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
                <span>نسبة العائد للمخاطرة:</span><strong>1:${s.risk_reward || (Number(s.target_pct) / Math.max(0.1, Number(s.sl_pct))).toFixed(1)}</strong>
              </div>
              ${s.entry_description ? `
                <div style="font-size: 10.5px; color: #475569; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #e2e8f0; line-height: 1.5;">
                  <strong>الوصف الفني وقواعد الدخول:</strong><br />${s.entry_description}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div style="font-size: 14px; font-weight: bold; color: #0f172a; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; margin: 20px 0 12px 0;">
          💬 محضر المداولات الكامل والحوار بين الخبراء الـ 8:
        </div>
        ${allDialogue.length > 0 ? allDialogue.map(d => `
          <div style="margin-bottom: 12px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; page-break-inside: avoid;">
            <div style="font-weight: bold; color: #b45309; font-size: 12px; margin-bottom: 4px;">👤 ${d.name}</div>
            <div style="font-size: 11.5px; color: #334155; white-space: pre-wrap; line-height: 1.7;">${d.text}</div>
          </div>
        `).join('') : '<div style="font-size: 12px; color: #94a3b8; padding: 10px;">لا توجد نصوص مسجلة في هذه الجلسة.</div>'}

        <div style="text-align: center; margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8;">
          تم إصدار هذا التقرير تلقائياً من محرك التداول الكمي والذكاء الاصطناعي — منصة صقر (SAQR)
        </div>
      `

      document.body.appendChild(container)

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `تقرير_اجتماع_الخبراء_${session.symbol.replace(/[\/\\]/g, '_')}_${session.id.slice(0, 6)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }

      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule.default || html2pdfModule

      await html2pdf().set(opt).from(container).save()
      document.body.removeChild(container)
    } catch (err) {
      console.error('PDF export error:', err)
      alert('حدث خطأ أثناء تنزيل الـ PDF: ' + err.message)
    } finally {
      setIsPdfGenerating(false)
    }
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

          {/* ✅ زر تنزيل التقرير كـ PDF مباشرة */}
          <button
            onClick={handleExportPDF}
            disabled={isPdfGenerating}
            className="btn px-3 py-2 rounded-3 d-flex align-items-center gap-2 shadow-sm transition-all"
            style={{
              background: 'linear-gradient(135deg, #d4af37 0%, #f59e0b 100%)',
              color: '#000000',
              fontWeight: '700',
              fontSize: '12.5px',
              border: 'none',
              cursor: isPdfGenerating ? 'wait' : 'pointer'
            }}
            title="تنزيل تقرير الجلسة والحوار كـ PDF مباشرة للجهاز"
          >
            {isPdfGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin text-dark" />
                <span className="text-black fw-bold">جاري تحميل الـ PDF...</span>
              </>
            ) : (
              <>
                <FileDown size={16} className="text-black" />
                <span className="text-black fw-bold">تحميل التقرير (PDF)</span>
              </>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm('هل أنت متأكد من رغبتك في إيقاف/حذف هذا الاجتماع؟')) {
                onDelete(session.id)
              }
            }}
            className="btn p-2 px-3 rounded-3 d-flex align-items-center gap-2"
            style={{ background: 'rgba(220, 38, 38, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}
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
                  <div className="glass-card p-4 h-100 shadow-lg" style={{ border: '1px solid rgba(212, 175, 55, 0.2)', background: 'rgba(15, 23, 42, 0.65)' }}>
                    {/* Header: اسم الاستراتيجية ودرجة الثقة بألوان واضحة وفائقة التباين */}
                    <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-white border-opacity-10 gap-2 flex-wrap">
                      <span
                        className="fw-bold px-3 py-1 rounded-3"
                        style={{
                          background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(245, 158, 11, 0.15))',
                          color: '#facc15',
                          border: '1px solid rgba(250, 204, 21, 0.4)',
                          fontSize: '12.5px',
                          letterSpacing: '0.2px'
                        }}
                      >
                        {strat.name || `استراتيجية ${idx + 1}`}
                      </span>
                      <div
                        className="badge px-2 py-1 rounded-pill fw-bold d-flex align-items-center gap-1"
                        style={{
                          background: 'rgba(34, 197, 94, 0.18)',
                          color: '#4ade80',
                          border: '1px solid rgba(74, 222, 128, 0.35)',
                          fontSize: '11px'
                        }}
                      >
                        <span style={{ opacity: 0.85 }}>الثقة:</span>
                        <span style={{ color: '#ffffff', fontWeight: '800' }}>{rawConfidence}%</span>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                        <span className="text-silver opacity-60">النوع:</span>
                        <span className="text-white fw-bold">{formatType(strat.type)}</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                        <span className="text-silver opacity-60">الهدف:</span>
                        <span className="text-success fw-bold" style={{ color: '#4ade80' }}>+{strat.target_pct}%</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-2 border-bottom border-white border-opacity-5 pb-1">
                        <span className="text-silver opacity-60">وقف الخسارة:</span>
                        <span className="text-danger fw-bold" style={{ color: '#f87171' }}>-{strat.sl_pct}%</span>
                      </div>
                      <div className="d-flex justify-content-between small mb-2">
                        <span className="text-silver opacity-60">نسبة العائد للمخاطرة:</span>
                        <span className="text-gold fw-bold" style={{ color: '#facc15' }}>1:{strat.risk_reward || (Number(strat.target_pct) / Math.max(0.1, Number(strat.sl_pct))).toFixed(1)}</span>
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