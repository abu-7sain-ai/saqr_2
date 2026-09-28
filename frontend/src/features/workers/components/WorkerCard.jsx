import React from 'react'
import {
  Zap,
  Power,
  Play,
  Scissors,
  Copy,
  TrendingUp,
  TrendingDown,
  Trash2,
  Webhook
} from 'lucide-react'
import { workerService } from '../services/workerService'

const WorkerCard = ({
  worker,
  onToggleStatus,
  onOpenWithdraw,
  onOpenClone,
  onDelete,
  onPromote,
  onViewDetail
}) => {
  const profitLoss = (worker.current_capital || 0) - (worker.starting_capital || 0)
  const profitPercentage =
    worker.starting_capital > 0 ? ((profitLoss / worker.starting_capital) * 100).toFixed(2) : '0.00'
  const isProfit = profitLoss >= 0

  const ownerLabels = {
    prince: 'عادي',
    king: 'مطور',
    sniper: 'حقيقي'
  }

  const marketLabels = {
    stable: 'مستقر',
    volatile: 'متوتر'
  }

  const getPairTitle = () => {
    const symbols = worker.user_settings?.symbols || worker.user_settings?.target_symbols
    if (Array.isArray(symbols) && symbols.length > 0) return symbols.join(', ')
    return worker.pair || worker.user_settings?.symbol || 'BTC/USDT'
  }

  const renderPairDisplay = () => {
    const symbols = worker.user_settings?.symbols || worker.user_settings?.target_symbols
    if (Array.isArray(symbols) && symbols.length > 1) {
      const preview = symbols.slice(0, 2).map((s) => s.split('/')[0]).join(', ')
      return `${symbols.length} عملات (${preview}${symbols.length > 2 ? '...' : ''})`
    }
    const rawPair = worker.pair || worker.user_settings?.symbol || 'BTC/USDT'
    if (typeof rawPair === 'string' && rawPair.includes(',')) {
      const list = rawPair.split(',').map((s) => s.trim())
      const preview = list.slice(0, 2).map((s) => s.split('/')[0]).join(', ')
      return `${list.length} عملات (${preview}${list.length > 2 ? '...' : ''})`
    }
    if (rawPair === 'ALL' || worker.user_settings?.symbol === 'ALL') {
      return 'الكل (القائمة البيضاء)'
    }
    return rawPair
  }

  const handlePromoteClick = async (e) => {
    e?.stopPropagation()
    const confirmed = window.confirm(
      `هل أنت متأكد من تحويل الموظف "${worker.name}" إلى حساب حقيقي؟\nسيبدأ الموظف بالتداول بأموال حقيقية على المنصة وفق نفس الإعدادات.`
    )
    if (!confirmed) return
    try {
      if (onPromote) {
        await onPromote(worker.id)
      } else {
        await workerService.promoteWorker(worker.id)
      }
      alert(`✅ تم تحويل الموظف "${worker.name}" إلى حساب حقيقي بنجاح!`)
    } catch (err) {
      alert(`❌ فشل التحويل: ${err.message}`)
    }
  }

  return (
    <div
      className="glass-card p-4 h-100 transition-all border-0 position-relative overflow-hidden d-flex flex-column justify-content-between"
      onClick={() => onViewDetail && onViewDetail(worker)}
      style={{
        cursor: 'pointer',
        background: 'linear-gradient(180deg, rgba(22, 27, 34, 0.75) 0%, rgba(13, 17, 23, 0.85) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Background Ambient Glow */}
      <div
        className={`position-absolute top-0 end-0 p-5 rounded-circle opacity-10 bg-${isProfit ? 'emerald' : 'ruby'}`}
        style={{ filter: 'blur(50px)', marginRight: '-20px', marginTop: '-20px', pointerEvents: 'none' }}
      ></div>

      <div>
        {/* Top Header: Name, Number & Status (No blue box!) */}
        <div className="d-flex justify-content-between align-items-center mb-2.5 position-relative">
          <div className="d-flex align-items-center gap-2 min-w-0">
            <h5 className="m-0 text-white fw-black text-truncate" style={{ fontSize: '18px', maxWidth: '200px' }} title={worker.name}>
              {worker.name}
            </h5>
            <span
              className="badge rounded-pill font-monospace flex-shrink-0"
              style={{
                background: 'rgba(212, 175, 55, 0.15)',
                color: '#ffd700',
                border: '1px solid rgba(212, 175, 55, 0.35)',
                fontSize: '11px',
                padding: '2px 8px'
              }}
            >
              #{worker.number}
            </span>
          </div>

          {/* Running Status Badge */}
          <div className="flex-shrink-0 ms-2">
            <div
              className={`d-inline-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill fw-bold ${
                worker.status === 'running' ? 'text-emerald' : 'text-ruby'
              }`}
              style={{
                background: worker.status === 'running' ? 'rgba(0, 255, 157, 0.12)' : 'rgba(255, 0, 85, 0.12)',
                border: `1px solid ${worker.status === 'running' ? 'rgba(0, 255, 157, 0.35)' : 'rgba(255, 0, 85, 0.35)'}`,
                fontSize: '11.5px',
                whiteSpace: 'nowrap'
              }}
            >
              <span
                className={`rounded-circle ${worker.status === 'running' ? 'bg-emerald pulse' : 'bg-ruby'}`}
                style={{ width: '6px', height: '6px' }}
              ></span>
              <span>{worker.status === 'running' ? 'يعمل' : worker.status === 'stopped' ? 'متوقف' : 'مؤقت'}</span>
            </div>
          </div>
        </div>

        {/* Sub-header tags: Owner | Account Type | Market Environment */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <span
            className="px-2.5 py-0.5 rounded-2 text-silver"
            style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '11.5px', fontWeight: 600 }}
          >
            {ownerLabels[worker.owner] || worker.owner}
          </span>
          {worker.type === 'live' ? (
            <span
              className="px-2.5 py-0.5 rounded-2 fw-bold"
              style={{
                background: 'rgba(212, 175, 55, 0.2)',
                color: '#ffd700',
                border: '1px solid rgba(212, 175, 55, 0.4)',
                fontSize: '11.5px'
              }}
            >
              💰 حقيقي
            </span>
          ) : (
            <span
              className="px-2.5 py-0.5 rounded-2 text-silver opacity-75"
              style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '11.5px', fontWeight: 600 }}
            >
              📝 وهمي
            </span>
          )}
          <span
            className="px-2.5 py-0.5 rounded-2 text-silver opacity-75"
            style={{ background: 'rgba(255, 255, 255, 0.05)', fontSize: '11.5px', fontWeight: 600 }}
          >
            {marketLabels[worker.market_type] || 'مستقر'}
          </span>
        </div>

        {/* Promote Banner if Paper */}
        {worker.type === 'paper' && (
          <div
            onClick={handlePromoteClick}
            className="d-flex align-items-center justify-content-between px-3 py-2 rounded-3 mb-3 transition-all"
            dir="rtl"
            style={{
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.06) 100%)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              cursor: 'pointer'
            }}
            title="اضغط لتحويل الموظف فوراً لحساب حقيقي يتداول بأموال حقيقية"
          >
            <div className="d-flex align-items-center gap-1.5 text-warning fw-bold" style={{ fontSize: '12px' }}>
              <span>⚡</span>
              <span>حساب تجريبي</span>
            </div>
            <span
              className="badge rounded-pill fw-bold text-dark px-2.5 py-1 d-inline-flex align-items-center gap-1"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                fontSize: '11px',
                whiteSpace: 'nowrap'
              }}
            >
              ترقية لحقيقي ⚡
            </span>
          </div>
        )}

        {/* Strategy & Target Pair (2-column layout to prevent any cutoffs) */}
        <div className="row g-2 mb-3">
          <div className="col-6">
            <div
              className="p-2.5 rounded-3 h-100 d-flex flex-column justify-content-center"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <span className="text-secondary mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                الاستراتيجية
              </span>
              <div className="fw-bold text-white text-truncate" style={{ fontSize: '12.5px' }} title={worker.strategy_name}>
                {worker.user_settings?.strategy_source === 'chart' ? (
                  <span className="text-warning d-inline-flex align-items-center gap-1">📈 شارت مباشر</span>
                ) : worker.user_settings?.strategy_source === 'webhook' ? (
                  <span className="text-gold d-inline-flex align-items-center gap-1"><Webhook size={12} /> Webhook</span>
                ) : worker.user_settings?.strategy_source === 'ai_prompt' ? (
                  <span className="text-info d-inline-flex align-items-center gap-1">🪄 ذكاء اصطناعي</span>
                ) : worker.user_settings?.strategy_source === 'nocode' ? (
                  <span className="text-emerald d-inline-flex align-items-center gap-1">🎛️ نو كود</span>
                ) : (
                  worker.user_settings?.expert_signal?.name || worker.strategy_name || 'تلقائي'
                )}
              </div>
            </div>
          </div>

          <div className="col-6">
            <div
              className="p-2.5 rounded-3 h-100 d-flex flex-column justify-content-center"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <span className="text-secondary mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                الزوج / العملات
              </span>
              <div
                className="fw-bold text-gold text-truncate"
                style={{ fontSize: '12.5px' }}
                title={getPairTitle()}
              >
                {renderPairDisplay()}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Highlights (Capital & Performance) */}
        <div
          className="p-3 rounded-3 mb-3"
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.06)'
          }}
        >
          <div className="d-flex justify-content-between align-items-baseline mb-2">
            <span className="text-secondary" style={{ fontSize: '12px', fontWeight: 600 }}>
              السيولة الحالية
            </span>
            <span className="fw-black text-white font-monospace" style={{ fontSize: '20px', letterSpacing: '-0.5px' }}>
              ${worker.current_capital?.toLocaleString() || '0.00'}
            </span>
          </div>
          <div className="d-flex justify-content-between align-items-center pt-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span className="text-secondary" style={{ fontSize: '11.5px', fontWeight: 600 }}>
              الأداء الإجمالي
            </span>
            <div
              className={`d-inline-flex align-items-center gap-1 px-2.5 py-0.5 rounded-pill fw-bold ${
                isProfit ? 'text-emerald' : 'text-ruby'
              }`}
              style={{
                background: isProfit ? 'rgba(0, 255, 157, 0.1)' : 'rgba(255, 0, 85, 0.1)',
                fontSize: '12px'
              }}
            >
              {isProfit ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{isProfit ? '+' : ''}{profitPercentage}%</span>
            </div>
          </div>
        </div>

        {/* Gradual Withdrawal Progress (If active) */}
        {worker.pending_withdrawal_amount > 0 && (
          <div
            className="mb-3 p-2.5 rounded-3 border border-ruby border-opacity-20"
            style={{ background: 'rgba(255, 0, 85, 0.05)' }}
          >
            <div className="d-flex justify-content-between align-items-center mb-1.5">
              <span className="extra-small text-ruby fw-black d-flex align-items-center gap-1">
                <Scissors size={13} /> جاري التسييل التدريجي
              </span>
              <span className="badge text-ruby border border-ruby border-opacity-30 extra-small py-0 px-1.5 rounded-pill">
                {(((worker.withdrawn_amount || 0) / worker.pending_withdrawal_amount) * 100).toFixed(0)}%
              </span>
            </div>
            <div
              className="progress bg-black bg-opacity-50 overflow-hidden"
              style={{ height: '6px', borderRadius: '3px' }}
            >
              <div
                className="progress-bar bg-ruby progress-bar-striped progress-bar-animated"
                role="progressbar"
                style={{
                  width: `${((worker.withdrawn_amount || 0) / worker.pending_withdrawal_amount) * 100}%`
                }}
              ></div>
            </div>
            <div className="d-flex justify-content-between mt-1">
              <span className="extra-small text-secondary" style={{ fontSize: '10px' }}>
                المحرر: ${worker.withdrawn_amount || 0}
              </span>
              <span className="extra-small text-secondary" style={{ fontSize: '10px' }}>
                الهدف: ${worker.pending_withdrawal_amount}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons: Play/Pause + Square Action Icons */}
      <div className="d-flex align-items-center gap-2 mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
        {worker.status === 'running' ? (
          <button
            type="button"
            onClick={() => onToggleStatus(worker.id, 'stopped')}
            className="btn flex-grow-1 fw-bold d-flex align-items-center justify-content-center gap-1.5"
            style={{
              height: '38px',
              fontSize: '12.5px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
              background: 'rgba(255, 0, 85, 0.1)',
              border: '1px solid rgba(255, 0, 85, 0.35)',
              color: '#ff3366'
            }}
          >
            <Power size={14} /> إيقاف العمل
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggleStatus(worker.id, 'running')}
            className="btn flex-grow-1 fw-bold d-flex align-items-center justify-content-center gap-1.5"
            style={{
              height: '38px',
              fontSize: '12.5px',
              borderRadius: '10px',
              whiteSpace: 'nowrap',
              background: 'rgba(0, 255, 157, 0.1)',
              border: '1px solid rgba(0, 255, 157, 0.35)',
              color: '#00ff9d'
            }}
          >
            <Play size={14} /> بدء التشغيل
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenWithdraw(worker)}
          className="btn"
          style={{
            width: '38px',
            height: '38px',
            minWidth: '38px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            color: '#d4af37'
          }}
          title="استقطاع سيولة / تسييل"
          disabled={worker.pending_withdrawal_amount > 0}
        >
          <Scissors size={15} />
        </button>

        <button
          type="button"
          onClick={() => onOpenClone(worker)}
          className="btn"
          style={{
            width: '38px',
            height: '38px',
            minWidth: '38px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(212, 175, 55, 0.35)',
            color: '#d4af37'
          }}
          title="استنساخ الموظف"
        >
          <Copy size={15} />
        </button>

        {worker.user_settings?.strategy_source === 'webhook' && (
          <button
            type="button"
            onClick={async (e) => {
              e.stopPropagation()
              try {
                const info = await workerService.getWebhookUrl(worker.id)
                await navigator.clipboard.writeText(info.webhook_url)
                alert(`تم نسخ رابط Webhook بنجاح:\n${info.webhook_url}\n\nضع هذا الرابط في خانة Webhook URL في تنبيه TradingView.`)
              } catch (err) {
                alert('فشل جلب رابط Webhook: ' + err.message)
              }
            }}
            className="btn"
            style={{
              width: '38px',
              height: '38px',
              minWidth: '38px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 175, 55, 0.35)',
              color: '#d4af37'
            }}
            title="نسخ رابط Webhook لـ TradingView"
          >
            <Webhook size={15} />
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                `هل أنت متأكد من حذف الموظف "${worker.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
              )
            ) {
              onDelete(worker.id)
            }
          }}
          className="btn"
          style={{
            width: '38px',
            height: '38px',
            minWidth: '38px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            background: 'rgba(255, 0, 85, 0.05)',
            border: '1px solid rgba(255, 0, 85, 0.35)',
            color: '#ff3366'
          }}
          title="حذف الموظف"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export default WorkerCard