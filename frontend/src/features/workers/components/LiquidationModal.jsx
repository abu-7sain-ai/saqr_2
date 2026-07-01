import React, { useState } from 'react'
import { DollarSign, AlertTriangle, RefreshCw, X } from 'lucide-react'
import { useWorkerStore } from '../store/useWorkerStore'

const LiquidationModal = ({ show, onHide, worker }) => {
  const [amount, setAmount] = useState(0)
  const [mode, setMode] = useState('aggressive')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const requestLiquidation = useWorkerStore(state => state.requestLiquidation)

  if (!show || !worker) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await requestLiquidation(worker.id, parseFloat(amount), mode)
      onHide()
    } catch (err) {
      alert('فشل طلب التسييل: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className="saqr-modal-overlay">
        <div className="saqr-modal-container glass-panel shadow-lg animate-fade-in">
          <div className="d-flex justify-content-between align-items-center p-4 border-bottom border-white border-opacity-10">
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-primary bg-opacity-10 rounded-3 text-primary">
                <RefreshCw size={24} />
              </div>
              <h5 className="m-0 fw-bold text-white">طلب تسييل تدريجي</h5>
            </div>
            <button onClick={onHide} className="btn text-secondary p-2 hover-text-white border-0 transition-all">
              <X size={24} />
            </button>
          </div>

          <div className="p-4">
            <div className="worker-summary mb-4 p-3 rounded-4 bg-dark bg-opacity-30 border border-white border-opacity-5">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary small">الموظف:</span>
                <span className="fw-bold text-white">{worker.name}</span>
              </div>
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-secondary small">رأس المال الحالي:</span>
                <span className="fw-bold text-gold">${worker.current_capital?.toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="form-label text-silver small fw-bold mb-2">المبلغ المطلوب تحريره ($)</label>
                <div className="input-group">
                  <span className="input-group-text bg-dark border-secondary text-secondary">
                    <DollarSign size={18} />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={worker.current_capital}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="form-control bg-dark border-secondary text-white p-3"
                    placeholder="0.00"
                  />
                </div>
                <div className="form-text extra-small text-secondary mt-2 opacity-75">
                  سيتم استقطاع هذا المبلغ تدريجياً من الصفقات المغلقة.
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-silver small fw-bold mb-3">آلية التسييل</label>
                <div className="d-flex flex-column gap-3">
                  <div 
                    className={`p-3 rounded-4 border cursor-pointer transition-all ${mode === 'aggressive' ? 'border-primary bg-primary bg-opacity-5 shadow-sm' : 'border-white border-opacity-5 bg-dark'}`}
                    onClick={() => setMode('aggressive')}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className={`mt-1 rounded-circle border d-flex align-items-center justify-content-center ${mode === 'aggressive' ? 'border-primary' : 'border-secondary'}`} style={{ width: 20, height: 20 }}>
                        {mode === 'aggressive' && <div className="bg-primary rounded-circle" style={{ width: 10, height: 10 }}></div>}
                      </div>
                      <div>
                        <div className={`fw-bold small ${mode === 'aggressive' ? 'text-primary' : 'text-white'}`}>تحرير في كل الأحوال (Aggressive)</div>
                        <p className="extra-small text-secondary m-0 mt-1">
                          يتم سحب كامل قيمة الصفقة (رأس المال + الربح) عند إغلاقها حتى الوصول للمبلغ المطلوب.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div 
                    className={`p-3 rounded-4 border cursor-pointer transition-all ${mode === 'profit_only' ? 'border-emerald bg-emerald bg-opacity-5 shadow-sm' : 'border-white border-opacity-5 bg-dark'}`}
                    onClick={() => setMode('profit_only')}
                  >
                    <div className="d-flex align-items-start gap-3">
                      <div className={`mt-1 rounded-circle border d-flex align-items-center justify-content-center ${mode === 'profit_only' ? 'border-emerald' : 'border-secondary'}`} style={{ width: 20, height: 20 }}>
                        {mode === 'profit_only' && <div className="bg-emerald rounded-circle" style={{ width: 10, height: 10 }}></div>}
                      </div>
                      <div>
                        <div className={`fw-bold small ${mode === 'profit_only' ? 'text-emerald' : 'text-white'}`}>تحرير الأرباح فقط (Profit Only)</div>
                        <p className="extra-small text-secondary m-0 mt-1">
                          يتم سحب صافي الأرباح فقط من الصفقات الناجحة. رأس المال الأساسي يعاد استثماره.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-3 bg-warning bg-opacity-5 border border-warning border-opacity-10 d-flex gap-3 mb-4">
                <AlertTriangle className="text-warning flex-shrink-0" size={20} />
                <p className="extra-small text-secondary m-0">
                  هذا الإجراء لا يوقف الموظف. سيستمر في العمل بما تبقى من رأس مال غير مستهدف للتسييل.
                </p>
              </div>

              <div className="d-flex gap-3 pt-2">
                <button 
                  type="submit" 
                  className="btn btn-gold flex-grow-1 py-3 fw-bold text-dark rounded-3"
                  disabled={isSubmitting || amount <= 0}
                >
                  {isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : 'تأكيد طلب التسييل'}
                </button>
                <button 
                  type="button"
                  onClick={onHide} 
                  className="btn btn-outline-secondary px-4 border-0 rounded-3"
                  disabled={isSubmitting}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
          .saqr-modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.85);
            backdrop-filter: blur(12px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .saqr-modal-container {
            width: 100%;
            max-width: 500px;
            border-radius: 24px;
            overflow: hidden;
            background: var(--saqr-surface);
          }
          .extra-small { font-size: 0.75rem; }
          .text-emerald { color: #10b981; }
          .bg-emerald { background-color: #10b981; }
          .border-emerald { border-color: #10b981 !important; }
          .cursor-pointer { cursor: pointer; }
        `}</style>
    </>
  )
}

export default LiquidationModal
