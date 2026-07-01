import React from 'react'
import {
  Activity,
  Shield,
  Crosshair,
  Zap,
  DollarSign,
  Power,
  Pause,
  Play,
  Scissors,
  Copy,
  TrendingUp,
  TrendingDown,
  Trash2
} from 'lucide-react'

const WorkerCard = ({
  worker,
  onToggleStatus,
  onOpenWithdraw,
  onOpenClone,
  onDelete,
  onPromote
}) => {
  const getIcon = (owner) => {
    switch (owner) {
      case 'prince':
        return <Shield size={24} />
      case 'king':
        return <Zap size={24} />
      case 'sniper':
        return <Crosshair size={24} />
      default:
        return <Activity size={24} />
    }
  }

  const getOwnerColor = (owner) => {
    switch (owner) {
      case 'prince':
        return 'info'
      case 'king':
        return 'gold'
      case 'sniper':
        return 'ruby'
      default:
        return 'silver'
    }
  }

  const profitLoss = (worker.current_capital || 0) - (worker.starting_capital || 0)
  const profitPercentage =
    worker.starting_capital > 0 ? ((profitLoss / worker.starting_capital) * 100).toFixed(2) : '0.00'
  const isProfit = profitLoss >= 0

  const typeLabels = {
    paper: 'وهمي',
    live: 'حقيقي'
  }

  const ownerLabels = {
    prince: 'عادي',
    king: 'مطور',
    sniper: 'حقيقي'
  }

  const marketLabels = {
    stable: 'مستقر',
    volatile: 'متوتر'
  }

  return (
    <div
      className="glass-card p-4 h-100 transition-all hover-transform border-0 position-relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent)',
        border: '1px solid rgba(255, 215, 0, 0.1) !important'
      }}
    >
      {/* Background Glow */}
      <div
        className={`position-absolute top-0 end-0 p-5 rounded-circle opacity-10 bg-${isProfit ? 'emerald' : 'ruby'}`}
        style={{ filter: 'blur(60px)', marginRight: '-30px', marginTop: '-30px' }}
      ></div>

      <div className="d-flex justify-content-between align-items-start mb-4 position-relative">
        <div className="d-flex align-items-center gap-3">
          <div
            className={`bg-${getOwnerColor(worker.owner)} bg-opacity-10 p-3 rounded-4 shadow-gold-sm text-${getOwnerColor(worker.owner)}`}
          >
            {getIcon(worker.owner)}
          </div>
          <div>
            <h4 className="m-0 text-white fw-black text-uppercase">{worker.name}</h4>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="badge-premium x-small text-gold border-gold opacity-50">
                #{worker.number}
              </span>
              <span className="small text-silver opacity-50 fw-bold">
                {ownerLabels[worker.owner] || worker.owner} |{' '}
                {typeLabels[worker.type] || worker.type}
              </span>
            </div>
          </div>
        </div>
        <div
          className={`badge-premium px-3 py-1 ${worker.status === 'running' ? 'text-emerald border-emerald' : 'text-ruby border-ruby opacity-50'}`}
        >
          <div className="d-flex align-items-center gap-2">
            <div
              className={`rounded-circle ${worker.status === 'running' ? 'bg-emerald pulse' : 'bg-ruby'}`}
              style={{ width: '8px', height: '8px' }}
            ></div>
            {worker.status === 'running' ? 'يعمل' : worker.status === 'stopped' ? 'متوقف' : 'مؤقت'}
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4 position-relative">
        <div className="col-6">
          <div className="small text-silver opacity-50 fw-bold text-uppercase tracking-wider mb-1">
            بيئة التداول
          </div>
          <div className="fw-black text-gold fs-6">
            {marketLabels[worker.market_type] || 'مستقر'}
          </div>
        </div>
        <div className="col-6 text-end">
          <div className="small text-silver opacity-50 fw-bold text-uppercase tracking-wider mb-1">
            الاستراتيجية
          </div>
          <div className="fw-black text-white fs-6 text-truncate">
            {worker.strategy_name || 'NEURAL_ALPHA'}
          </div>
        </div>
      </div>

      <div
        className="glass-panel p-4 rounded-4 mb-4 border-0"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <span className="small text-silver opacity-50 fw-bold">السيولة الحالية</span>
          <span className="fw-black text-white fs-4">
            ${worker.current_capital?.toLocaleString()}
          </span>
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <span className="small text-silver opacity-50 fw-bold">الأداء الإجمالي</span>
          <div
            className={`d-flex align-items-center gap-2 fw-black fs-5 ${isProfit ? 'text-emerald' : 'text-ruby'}`}
          >
            {isProfit ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            {isProfit ? '+' : ''}
            {profitPercentage}%
          </div>
        </div>
      </div>

      {worker.pending_withdrawal_amount > 0 && (
        <div
          className="mb-4 p-4 rounded-4 border border-ruby border-opacity-20"
          style={{ background: 'rgba(255, 0, 85, 0.05)' }}
        >
          <div className="d-flex justify-content-between align-items-center mb-3">
            <span className="small text-ruby fw-black d-flex align-items-center gap-2">
              <Scissors size={16} /> جاري التسييل التدريجي
            </span>
            <span className="badge-premium text-ruby border-ruby small">
              {(((worker.withdrawn_amount || 0) / worker.pending_withdrawal_amount) * 100).toFixed(
                0
              )}
              %
            </span>
          </div>
          <div
            className="progress bg-black bg-opacity-50 overflow-hidden"
            style={{ height: '8px', borderRadius: '4px' }}
          >
            <div
              className="progress-bar bg-ruby progress-bar-striped progress-bar-animated"
              role="progressbar"
              style={{
                width: `${((worker.withdrawn_amount || 0) / worker.pending_withdrawal_amount) * 100}%`
              }}
            ></div>
          </div>
          <div className="d-flex justify-content-between mt-2">
            <span className="x-small text-silver opacity-50">
              المحرر: ${worker.withdrawn_amount || 0}
            </span>
            <span className="x-small text-silver opacity-50">
              الهدف: ${worker.pending_withdrawal_amount}
            </span>
          </div>
        </div>
      )}

      <div className="d-flex gap-3 mt-2">
        {worker.status === 'running' ? (
          <button
            onClick={() => onToggleStatus(worker.id, 'stopped')}
            className="btn btn-outline-ruby flex-grow-1 py-3 fw-black d-flex align-items-center justify-content-center gap-2"
          >
            <Power size={18} /> إيقاف العمل
          </button>
        ) : (
          <button
            onClick={() => onToggleStatus(worker.id, 'running')}
            className="btn btn-outline-emerald flex-grow-1 py-3 fw-black d-flex align-items-center justify-content-center gap-2"
          >
            <Play size={18} /> بدء التشغيل
          </button>
        )}
        <div className="d-flex gap-2">
          <button
            onClick={() => onOpenWithdraw(worker)}
            className="btn btn-outline-gold p-3 rounded-4"
            title="استقطاع سيولة"
            disabled={worker.pending_withdrawal_amount > 0}
          >
            <Scissors size={20} />
          </button>
          <button
            onClick={() => onOpenClone(worker)}
            className="btn btn-outline-gold p-3 rounded-4"
            title="استنساخ / ترقية للحقيقي"
          >
            <Copy size={20} />
          </button>
          <button
            onClick={() => {
              if (
                window.confirm(
                  `هل أنت متأكد من حذف الموظف "${worker.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                )
              ) {
                onDelete(worker.id)
              }
            }}
            className="btn btn-outline-ruby p-3 rounded-4"
            title="حذف الموظف"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`⚠️ تحذير: أنت على وشك تسييل كامل أرصدة الموظف "${worker.name}". هل تريد المتابعة؟`)) {
                onToggleStatus(worker.id, 'liquidating')
              }
            }}
            className="btn btn-outline-ruby p-3 rounded-4"
            title="تسييل فوري للمراكز"
          >
            <Power size={20} className="text-ruby" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default WorkerCard
