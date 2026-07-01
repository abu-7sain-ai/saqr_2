import React, { useState, useEffect } from 'react'
import { workerService } from '../../workers/services/workerService'

const CloningModal = ({ isOpen, onClose, strategy, onConfirm }) => {
  const [activeTab, setActiveTab] = useState('portfolio')
  const [availableBuddies, setAvailableBuddies] = useState([])
  const [buddySearch, setBuddySearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    portfolioType: 'fixed',
    portfolioValue: 500,
    tradeSizeType: 'percent_allocation',
    tradeSizeValue: 10,
    maxTrades: 0,
    tpType: 'recommended',
    tpValue: '',
    slType: 'trailing_recommended',
    slValue: 0.5,
    expiryType: 'end_of_day',
    expiryMinutes: '',
    buddyId: ''
  })

  useEffect(() => {
    if (isOpen) {
      const fetchBuddies = async () => {
        try {
          const resp = await workerService.getWorkers()
          setAvailableBuddies(Array.isArray(resp) ? resp : [])
        } catch (err) {
          console.error('CloningModal: Fetch error', err)
        }
      }
      fetchBuddies()
    }
  }, [isOpen])

  if (!isOpen || !strategy) return null

  const handleSave = () => {
    try {
      const finalData = {
        ...formData,
        name: strategy?.name || `موظف ${new Date().getTime()}`
      }
      onConfirm(finalData)
    } catch (err) {
      console.error('Error in handleSave:', err)
    }
  }

  const renderTab = (id, label) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`btn flex-grow-1 p-3 d-flex flex-column align-items-center gap-1 border-0 ${
        activeTab === id
          ? 'text-gold border-bottom border-gold border-2 bg-dark'
          : 'text-secondary bg-transparent'
      }`}
    >
      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{label}</span>
    </button>
  )

  const activeStrategyName = strategy?.name || 'مجهول'

  return (
    <>
      <div className="cloning-overlay-resilient">
        <div className="cloning-container-resilient shadow-lg">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-white border-opacity-10">
            <h5 className="m-0 text-gold fw-bold">⚙️ استنساخ الموظف</h5>
            <button onClick={onClose} className="btn text-secondary p-0 border-0 fs-4">
              ×
            </button>
          </div>

          <div className="px-3 py-2 bg-black bg-opacity-30 small text-secondary border-bottom border-white border-opacity-5">
            الاستراتيجية المختارة: <span className="text-silver fw-bold">{activeStrategyName}</span>
          </div>

          {/* Tabs Bar */}
          <div className="d-flex border-bottom border-white border-opacity-10 bg-black bg-opacity-20">
            {renderTab('portfolio', 'المحفظة')}
            {renderTab('sizing', 'البنود')}
            {renderTab('risk', 'الأهداف')}
            {renderTab('system', 'النظام')}
          </div>

          {/* Body Content */}
          <div className="p-4 overflow-auto" style={{ maxHeight: '60vh', minHeight: '300px' }}>
            {activeTab === 'portfolio' && (
              <div>
                <label className="text-secondary mb-3 small d-block">نصيب الموظف من المحفظة:</label>
                <div className="d-flex flex-column gap-2 mb-3">
                  {['fixed', 'percent', 'percent_compounding'].map((type) => (
                    <div
                      key={type}
                      onClick={() => setFormData({ ...formData, portfolioType: type })}
                      className={`p-3 rounded-3 border cursor-pointer ${formData.portfolioType === type ? 'border-gold bg-gold bg-opacity-5' : 'border-white border-opacity-10 bg-dark bg-opacity-50'}`}
                    >
                      <div className="fw-bold small text-white">
                        {type === 'fixed'
                          ? 'مبلغ ثابت ($)'
                          : type === 'percent'
                            ? 'نسبة مئوية (%)'
                            : 'نسبة تراكمية (Compounding)'}
                      </div>
                    </div>
                  ))}
                </div>
                <input
                  type="number"
                  className="form-control bg-dark text-white border-gold border-opacity-20"
                  value={formData.portfolioValue}
                  onChange={(e) => setFormData({ ...formData, portfolioValue: e.target.value })}
                />
              </div>
            )}

            {activeTab === 'sizing' && (
              <div>
                <label className="text-secondary mb-3 small d-block">حجم كل صفقة:</label>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <button
                      className={`btn w-100 ${formData.tradeSizeType === 'fixed' ? 'btn-gold' : 'btn-dark'}`}
                      onClick={() => setFormData({ ...formData, tradeSizeType: 'fixed' })}
                    >
                      $ ثابت
                    </button>
                  </div>
                  <div className="col-6">
                    <button
                      className={`btn w-100 ${formData.tradeSizeType === 'percent_allocation' ? 'btn-gold' : 'btn-dark'}`}
                      onClick={() =>
                        setFormData({ ...formData, tradeSizeType: 'percent_allocation' })
                      }
                    >
                      % من نصيبه
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  className="form-control bg-dark text-white border-gold border-opacity-20"
                  value={formData.tradeSizeValue}
                  onChange={(e) => setFormData({ ...formData, tradeSizeValue: e.target.value })}
                />
              </div>
            )}

            {activeTab === 'risk' && (
              <div>
                <div className="mb-4">
                  <label className="text-success small fw-bold d-block mb-3">
                    جني الأرباح (Take Profit):
                  </label>
                  <div className="d-flex gap-2">
                    <button
                      className={`btn btn-sm ${formData.tpType === 'recommended' ? 'btn-success text-dark' : 'btn-dark'}`}
                      onClick={() => setFormData({ ...formData, tpType: 'recommended' })}
                    >
                      توصية العادي
                    </button>
                    <button
                      className={`btn btn-sm ${formData.tpType === 'custom' ? 'btn-success text-dark' : 'btn-dark'}`}
                      onClick={() => setFormData({ ...formData, tpType: 'custom' })}
                    >
                      مخصص
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-danger small fw-bold d-block mb-3">
                    وقف الخسارة (Stop Loss):
                  </label>
                  <div className="d-flex flex-column gap-2">
                    <button
                      className={`btn btn-sm text-end p-3 ${formData.slType === 'trailing_recommended' ? 'btn-danger bg-opacity-20 text-danger' : 'btn-dark'}`}
                      onClick={() => setFormData({ ...formData, slType: 'trailing_recommended' })}
                    >
                      وقف متحرك (0.5%)
                    </button>
                    <button
                      className={`btn btn-sm text-end p-3 ${formData.slType === 'fixed' ? 'btn-danger bg-opacity-20 text-danger' : 'btn-dark'}`}
                      onClick={() => setFormData({ ...formData, slType: 'fixed' })}
                    >
                      وقف ثابت صارم
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div>
                <label className="text-secondary small mb-3 d-block">
                  نظام الصديق المكمل (اختياري):
                </label>
                <div
                  className="bg-dark rounded p-2 mb-3"
                  style={{ maxHeight: '150px', overflowY: 'auto' }}
                >
                  <div
                    className="p-2 border-bottom border-white border-opacity-5 cursor-pointer"
                    onClick={() => setFormData({ ...formData, buddyId: '' })}
                  >
                    <span
                      className={formData.buddyId === '' ? 'text-gold fw-bold' : 'text-secondary'}
                    >
                      مستقل (بدون صديق)
                    </span>
                  </div>
                  {availableBuddies && availableBuddies.length > 0 ? (
                    availableBuddies
                      .filter((b) => b?.name?.toLowerCase().includes(buddySearch.toLowerCase()))
                      .map((buddy) => (
                        <div
                          key={buddy.id}
                          className="p-2 border-bottom border-white border-opacity-5 cursor-pointer"
                          onClick={() => setFormData({ ...formData, buddyId: buddy.id })}
                        >
                          <span
                            className={
                              formData.buddyId === buddy.id ? 'text-gold fw-bold' : 'text-white'
                            }
                          >
                            {buddy.name}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="p-2 text-secondary small italic text-center">
                      لا يوجد موظفون متاحون للربط
                    </div>
                  )}
                </div>
                <label className="text-secondary small mb-2 d-block">مدة الصلاحية:</label>
                <select
                  className="form-select bg-dark text-white border-gold border-opacity-20"
                  value={formData.expiryType}
                  onChange={(e) => setFormData({ ...formData, expiryType: e.target.value })}
                >
                  <option value="recommended">توصية العادي الافتراضية</option>
                  <option value="end_of_day">نهاية اليوم (نيويورك)</option>
                </select>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-top border-white border-opacity-10 d-flex gap-3">
            <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">
              إلغاء
            </button>
            <button onClick={handleSave} className="btn btn-gold flex-grow-1 fw-bold text-dark">
              تأكيد الاستنساخ
            </button>
          </div>
        </div>
      </div>

      <style>{`
          .cloning-overlay-resilient {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.92); backdrop-filter: blur(12px);
            z-index: 99999;
            display: flex; align-items: center; justify-content: center;
          }
          .cloning-container-resilient {
            width: 95%; max-width: 550px;
            background: #0d0d0d; border: 1px solid rgba(212, 175, 55, 0.3);
            border-radius: 12px; overflow: hidden;
          }
          .btn-gold { background: #d4af37 !important; color: #000 !important; border: none; }
          .text-gold { color: #d4af37 !important; }
          .bg-gold { background-color: #d4af37 !important; }
          .border-gold { border-color: #d4af37 !important; }
        `}</style>
      </>
    )
  }

export default CloningModal
