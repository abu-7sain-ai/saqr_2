import React, { useState } from 'react'
import { X, RefreshCw, AlertTriangle, TrendingUp, Scissors } from 'lucide-react'

const WithdrawModal = ({ isOpen, onClose, worker, onConfirm }) => {
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawMode, setWithdrawMode] = useState('aggressive') // 'aggressive' or 'profit_only'

  if (!isOpen || !worker) return null

  const maxAvailable = worker.current_capital || 0

  const handleConfirm = () => {
    const amount = parseFloat(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح')
      return
    }
    if (amount > maxAvailable) {
      alert('لا يمكنك سحب مبلغ أكبر من رأس माल الموظف الحالي')
      return
    }
    onConfirm(worker.id, amount, withdrawMode)
  }

  return (
    <div className="modal-overlay">
      <div
        className="glass-panel modal-content-custom animate-slide-up d-flex flex-column"
        style={{ maxWidth: '600px' }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center p-4 border-bottom border-danger border-opacity-25">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-danger bg-opacity-20 p-2 rounded text-danger">
              <Scissors size={24} />
            </div>
            <div>
              <h5 className="m-0 text-white fw-bold">استقطاع سيولة (تسييل تدريجي)</h5>
              <div className="small shadow-sm text-secondary mt-1">{worker.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn border-0 text-secondary hover-text-danger p-0 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 d-flex flex-column gap-4">
          <div className="alert bg-black bg-opacity-30 border-warning border-opacity-25 text-silver small m-0 d-flex gap-2 align-items-start">
            <AlertTriangle className="text-warning flex-shrink-0 mt-1" size={16} />
            <div>
              <strong>آلية التسييل الآمن:</strong> هذا الخيار لن يوقف الموظف أو يغلق صفقاته المفتوحة
              بخسارة. سيقوم الموظف بسحب الأموال المطلوبة تدريجياً فور إغلاق صفقاته وتجميدها في (رصيد
              محرر) حتى يصل للرقم المستهدف.
            </div>
          </div>

          <div>
            <label className="text-silver mb-2 d-block small fw-bold">
              المبلغ المطلوب سحبه ($):
            </label>
            <div className="input-group">
              <input
                type="number"
                className="form-control bg-dark text-white border-white border-opacity-10 shadow-none focus-border-danger py-2 fs-5"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`أقصى حد: $${maxAvailable.toLocaleString()}`}
              />
              <button
                className="btn btn-outline-danger"
                onClick={() => setWithdrawAmount(maxAvailable)}
              >
                الكل (MAX)
              </button>
            </div>
          </div>

          <div>
            <label className="text-silver mb-3 fw-bold d-block small">
              استراتيجية تحرير الأموال:
            </label>

            <div className="d-flex flex-column gap-3">
              <label
                className={`glass-card p-3 cursor-pointer d-flex gap-3 align-items-start transition-all ${withdrawMode === 'aggressive' ? 'border-danger bg-danger bg-opacity-10' : 'border-white border-opacity-10'}`}
              >
                <input
                  type="radio"
                  className="form-check-input mt-1"
                  checked={withdrawMode === 'aggressive'}
                  onChange={() => setWithdrawMode('aggressive')}
                />
                <div>
                  <div className="fw-bold text-white mb-1 d-flex gap-2">
                    <RefreshCw
                      size={16}
                      className={withdrawMode === 'aggressive' ? 'text-danger' : ''}
                    />
                    تسييل شامل (على كل حال)
                  </div>
                  <div className="small text-secondary" style={{ lineHeight: '1.6' }}>
                    أي صفقة يتم إغلاقها (بخسارة أو ربح)، سيتم سحب كامل قيمتها للرصيد المحرر وتُخصم
                    من المحفظة حتى الوصول للهدف. هذا الخيار أسرع لتوفير الكاش.
                  </div>
                </div>
              </label>

              <label
                className={`glass-card p-3 cursor-pointer d-flex gap-3 align-items-start transition-all ${withdrawMode === 'profit_only' ? 'border-success bg-success bg-opacity-10' : 'border-white border-opacity-10'}`}
              >
                <input
                  type="radio"
                  className="form-check-input mt-1"
                  checked={withdrawMode === 'profit_only'}
                  onChange={() => setWithdrawMode('profit_only')}
                />
                <div>
                  <div className="fw-bold text-white mb-1 d-flex gap-2">
                    <TrendingUp
                      size={16}
                      className={withdrawMode === 'profit_only' ? 'text-success' : ''}
                    />
                    تسييل بالأرباح فقط
                  </div>
                  <div className="small text-secondary" style={{ lineHeight: '1.6' }}>
                    لن يتم المساس برأس المال الأساسي للموظف. سيتم تحرير (صافي الأرباح) فقط من
                    الصفقات الناجحة وتحويلها للرصيد المحرر. هذا الخيار بطيء ولكنه آمن للاستثمار
                    المستمر.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-black bg-opacity-50 border-top border-white border-opacity-10 mt-auto d-flex gap-3">
          <button
            onClick={onClose}
            className="btn border border-secondary text-secondary hover-bg-dark flex-grow-1"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-danger flex-grow-1 d-flex gap-2 align-items-center justify-content-center shadow"
            disabled={!withdrawAmount}
          >
            <Scissors size={18} /> البدء بطلب التسييل
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
          z-index: 2000; display: flex; align-items: center; justify-content: center;
        }
        .modal-content-custom {
          background: linear-gradient(180deg, #1e1515 0%, #0A0A0A 100%);
          border: 1px solid rgba(220, 53, 69, 0.2);
          border-radius: 12px; width: 95%; max-height: 95vh;
        }
        .focus-border-danger:focus { border-color: var(--bs-danger) !important; box-shadow: 0 0 0 0.25rem rgba(220,53,69,0.25) !important; }
        .hover-bg-dark:hover { background-color: rgba(255,255,255,0.05); }
        .hover-text-danger:hover { color: var(--bs-danger) !important; }
      `}</style>
    </div>
  )
}

export default WithdrawModal
