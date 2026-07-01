import React, { useState, useEffect } from 'react'
import { workerService } from '../services/workerService'

const CloningModal = ({ isOpen, onClose, strategy, onConfirm }) => {
  const [activeTab, setActiveTab] = useState('portfolio')
  const [availableBuddies, setAvailableBuddies] = useState([])
  const [buddySearch, setBuddySearch] = useState('')
  const [availableBalance, setAvailableBalance] = useState(0)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

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
    buddyId: '',
    targetType: 'paper',
    notes: ''
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

      const fetchBalance = async () => {
        setIsLoadingBalance(true)
        try {
          const bal = await workerService.getAvailableBalance()
          setAvailableBalance(bal)
        } catch (err) {
          console.error('CloningModal: Balance error', err)
        } finally {
          setIsLoadingBalance(false)
        }
      }
      fetchBalance()
    }
  }, [isOpen])

  if (!isOpen || !strategy) return null

  const handleSave = () => {    
    const finalData = {
    name: strategy?.name || `موظف ${Date.now()}`,
    session_id: strategy?.kitchen_session_id || null,
    expert_signal: strategy?.user_settings?.expert_signal || {},
    settings: {
      ...formData,
      workerType: strategy?.type || 'paper',
      marketType: strategy?.market_type || 'stable',
      symbol: strategy?.user_settings?.symbol || 'BTC/USDT',
      portfolioValue: formData.portfolioValue,
      buddyId: formData.buddyId || null,
    }
  }
  onConfirm(finalData)
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
      <span className="extra-small fw-bold">{label}</span>
    </button>
  )

  const activeStrategyName = strategy?.name || 'مجهول'

  return (
    <div className="cr-overlay">
      <div className="cr-container shadow-lg">
        <div className="d-flex justify-content-between align-items-center p-3 border-bottom border-white border-opacity-10">
          <h5 className="m-0 text-gold fw-bold">⚙️ استنساخ الموظف</h5>
          <button onClick={onClose} className="btn text-secondary p-0 border-0 fs-4">
            ×
          </button>
        </div>
        <div className="px-3 py-2 bg-black bg-opacity-30 small text-secondary border-bottom border-white border-opacity-5 d-flex justify-content-between align-items-center">
          <div>
            الاستراتيجية المختارة: <span className="text-silver fw-bold">{activeStrategyName}</span>
          </div>
          <div className="d-flex gap-2">
            <button 
              onClick={() => setFormData({ ...formData, targetType: 'paper' })}
              className={`btn btn-sm py-0 px-2 extra-small border ${formData.targetType === 'paper' ? 'btn-info border-info' : 'btn-dark border-secondary opacity-50'}`}
            >
              Paper
            </button>
            <button 
              onClick={() => setFormData({ ...formData, targetType: 'live' })}
              className={`btn btn-sm py-0 px-2 extra-small border ${formData.targetType === 'live' ? 'btn-warning border-warning' : 'btn-dark border-secondary opacity-50'}`}
            >
              Live
            </button>
          </div>
        </div>
        <div className="d-flex border-bottom border-white border-opacity-10 bg-black bg-opacity-20">
          {renderTab('portfolio', 'المحفظة')}
          {renderTab('sizing', 'البنود')}
          {renderTab('risk', 'الأهداف')}
          {renderTab('system', 'النظام')}
          {renderTab('advanced', 'متقدم')}
        </div>
        <div className="p-4 overflow-auto" style={{ maxHeight: '60vh', minHeight: '300px' }}>
          {activeTab === 'portfolio' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <label className="text-secondary small m-0">نصيب الموظف من المحفظة:</label>
                <div className="text-gold extra-small fw-bold border border-gold border-opacity-20 px-2 py-1 rounded bg-gold bg-opacity-5">
                  {isLoadingBalance ? 'جاري التحقق...' : `الرصيد المتاح: $${availableBalance.toLocaleString()}`}
                </div>
              </div>
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
                          : 'نسبة تراكمية'}
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

              <div className="mt-4 pt-3 border-top border-white border-opacity-5">
                <label className="text-secondary mb-2 small d-block">الحد الأقصى للصفقات المتزامنة:</label>
                <div className="d-flex align-items-center gap-3">
                  <input
                    type="number"
                    className="form-control bg-dark text-white border-gold border-opacity-20"
                    value={formData.maxTrades}
                    onChange={(e) => setFormData({ ...formData, maxTrades: parseInt(e.target.value) || 0 })}
                  />
                  <div className="extra-small text-secondary" style={{ minWidth: '100px' }}>
                    {formData.maxTrades === 0 ? 'لا يوجد حد' : `${formData.maxTrades} صفقات`}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'risk' && (
            <div>
              <div className="mb-4">
                <label className="text-emerald small fw-bold d-block mb-3">جني الأرباح:</label>
                <div className="d-flex gap-2">
                  <button
                    className={`btn btn-sm ${formData.tpType === 'recommended' ? 'btn-gold' : 'btn-dark'}`}
                    onClick={() => setFormData({ ...formData, tpType: 'recommended' })}
                  >
                    توصية العادي
                  </button>
                  <button
                    className={`btn btn-sm ${formData.tpType === 'custom' ? 'btn-gold' : 'btn-dark'}`}
                    onClick={() => setFormData({ ...formData, tpType: 'custom' })}
                  >
                    مخصص
                  </button>
                </div>
              </div>
              <div>
                <label className="text-ruby small fw-bold d-block mb-3">وقف الخسارة:</label>
                <div className="d-flex flex-column gap-2">
                  <button
                    className={`btn btn-sm text-end p-3 ${formData.slType === 'trailing_recommended' ? 'bg-ruby bg-opacity-10 text-ruby border-ruby' : 'bg-dark'}`}
                    style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}
                    onClick={() => setFormData({ ...formData, slType: 'trailing_recommended' })}
                  >
                    وقف متحرك (0.5%)
                  </button>
                  <button
                    className={`btn btn-sm text-end p-3 ${formData.slType === 'fixed' ? 'bg-ruby bg-opacity-10 text-ruby border-ruby' : 'bg-dark'}`}
                    style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}
                    onClick={() => setFormData({ ...formData, slType: 'fixed' })}
                  >
                    وقف ثابت
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'system' && (
            <div>
              <label className="text-secondary small mb-3 d-block">نظام الصديق المكمل:</label>
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
                    مستقل
                  </span>
                </div>
                {availableBuddies?.map((buddy) => (
                  <div
                    key={buddy.id}
                    className="p-2 border-bottom border-white border-opacity-5 cursor-pointer"
                    onClick={() => setFormData({ ...formData, buddyId: buddy.id })}
                  >
                    <span
                      className={formData.buddyId === buddy.id ? 'text-gold fw-bold' : 'text-white'}
                    >
                      {buddy.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-top border-white border-opacity-5">
                <label className="text-secondary mb-3 small d-block">صلاحية التوصيات:</label>
                <div className="d-flex flex-column gap-2">
                  <div 
                    onClick={() => setFormData({ ...formData, expiryType: 'end_of_day' })}
                    className={`p-2 rounded border cursor-pointer small ${formData.expiryType === 'end_of_day' ? 'border-gold text-gold bg-gold bg-opacity-5' : 'border-white border-opacity-5 text-secondary'}`}
                  >
                    نهاية اليوم التداولي
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <div 
                      onClick={() => setFormData({ ...formData, expiryType: 'minutes' })}
                      className={`p-2 rounded border cursor-pointer small flex-grow-1 ${formData.expiryType === 'minutes' ? 'border-gold text-gold bg-gold bg-opacity-5' : 'border-white border-opacity-5 text-secondary'}`}
                    >
                      دقائق محددة
                    </div>
                    {formData.expiryType === 'minutes' && (
                      <input
                        type="number"
                        placeholder="دقيقة"
                        className="form-control form-control-sm bg-dark text-white border-gold border-opacity-20 w-25"
                        value={formData.expiryMinutes}
                        onChange={(e) => setFormData({ ...formData, expiryMinutes: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'advanced' && (
            <div>
              <label className="text-secondary small mb-3 d-block">ملاحظات إضافية:</label>
              <textarea
                className="form-control bg-dark text-white border-gold border-opacity-20"
                rows="4"
                placeholder="اكتب ملاحظات لتمييز هذا الموظف..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
              <div className="mt-4 p-3 rounded bg-warning bg-opacity-5 border border-warning border-opacity-10">
                <div className="d-flex align-items-center gap-2 text-warning extra-small fw-bold mb-2">
                  <span role="img" aria-label="warning">⚠️</span> تنبيه الأمان
                </div>
                <p className="extra-small text-secondary m-0">
                  سيتم إنشاء الموظف في وضع "التوقف" (Stopped) افتراضياً كما ينص الدستور. 
                  يجب تفعيله يدوياً بعد التأكد من كافة الإعدادات.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-top border-white border-opacity-10 d-flex gap-3">
          <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">
            إلغاء
          </button>
          <button onClick={handleSave} className="btn btn-gold flex-grow-1 fw-bold text-dark">
            تأكيد الاستنساخ
          </button>
        </div>
      </div>
      <style>{`
        .cr-overlay { 
          position: fixed; 
          top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0,0,0,0.95); 
          backdrop-filter: blur(24px) saturate(200%); 
          z-index: 99999; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
        }
        .cr-container { 
          width: 95%; 
          max-width: 550px; 
          background: var(--saqr-surface); 
          border: 1px solid var(--glass-border); 
          border-radius: 20px; 
          overflow: hidden; 
          box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 20px rgba(255, 215, 0, 0.1);
        }
      `}</style>
    </div>
  )
}

export default CloningModal
