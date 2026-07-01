import React, { useState } from 'react'
import {
  PlusCircle,
  Link,
  KeyRound,
  ActivitySquare,
  Server,
  AlertTriangle,
  ShieldCheck,
  Globe
} from 'lucide-react'

const AddMarketTab = () => {
  const [formData, setFormData] = useState({
    name: '',
    type: 'crypto',
    trackingApi: '',
    controlApi: '',
    historyApi: ''
  })

  const [testResult, setTestResult] = useState(null)

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleTest = () => {
    // Add fake test sequence for visual feedback (Since it's UI only Phase 2)
    setTestResult({ status: 'testing', msg: 'جاري اختبار واجهات برمجة التطبيقات...' })
    setTimeout(() => {
      if (formData.trackingApi.length > 5) {
        setTestResult({ status: 'success', msg: 'تم الاتصال بنجاح. جاهز للإضافة.' })
      } else {
        setTestResult({ status: 'error', msg: 'فشل الاتصال: يرجى التحقق من مفتاح المتابعة.' })
      }
    }, 1500)
  }

  const handleSave = () => {
    alert(
      'سيتم برمجة منطق إضافة سوق جديد وقواعد الاتصال بالـ Python Engine في المرحلة السابعة. تم حفظ التصميم شكلياً.'
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="text-gold mb-1">إضافة سوق جديد</h5>
          <p className="text-secondary small m-0">توصيل منصات تداول جديدة للمرحلة السابعة</p>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-8">
          <div className="glass-panel p-4 h-100">
            <form onSubmit={(e) => e.preventDefault()} className="d-flex flex-column gap-4">
              <div>
                <label className="form-label text-silver small mb-2">اسم المنصة</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-control bg-dark text-white border-secondary bg-opacity-50"
                  placeholder="مثال: Kraken, Coinbase..."
                />
              </div>

              <div>
                <label className="form-label text-silver small mb-2">نوع السوق</label>
                <div className="d-flex gap-3">
                  <label className="d-flex align-items-center gap-2 cursor-pointer p-2 glass-card rounded-3 pe-4 ps-3">
                    <input
                      type="radio"
                      className="form-check-input mt-0"
                      name="type"
                      value="crypto"
                      checked={formData.type === 'crypto'}
                      onChange={handleChange}
                    />
                    <span className="text-white small">كريبتو</span>
                  </label>
                  <label className="d-flex align-items-center gap-2 cursor-pointer p-2 glass-card rounded-3 pe-4 ps-3">
                    <input
                      type="radio"
                      className="form-check-input mt-0"
                      name="type"
                      value="stocks"
                      checked={formData.type === 'stocks'}
                      onChange={handleChange}
                    />
                    <span className="text-white small">أسهم</span>
                  </label>
                  <label className="d-flex align-items-center gap-2 cursor-pointer p-2 glass-card rounded-3 pe-4 ps-3">
                    <input
                      type="radio"
                      className="form-check-input mt-0"
                      name="type"
                      value="forex"
                      checked={formData.type === 'forex'}
                      onChange={handleChange}
                    />
                    <span className="text-white small">فوركس</span>
                  </label>
                </div>
              </div>

              <hr className="border-secondary opacity-25" />

              <div>
                <label className="form-label text-gold small mb-3 d-flex align-items-center gap-2">
                  <Server size={18} /> إعدادات Alpaca Paper (للتداول الوهمي)
                </label>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="text-secondary small mb-2 d-block">Alpaca API Key</label>
                    <div className="position-relative">
                      <KeyRound
                        className="position-absolute top-50 start-0 translate-middle-y ms-3 opacity-25"
                        size={16}
                      />
                      <input
                        type="text"
                        name="alpacaKey"
                        className="form-control bg-dark text-white border-secondary bg-opacity-50 ps-5 font-monospace"
                        placeholder="PK..."
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="text-secondary small mb-2 d-block">Alpaca Secret Key</label>
                    <div className="position-relative">
                      <ShieldCheck
                        className="position-absolute top-50 start-0 translate-middle-y ms-3 opacity-25"
                        size={16}
                      />
                      <input
                        type="password"
                        name="alpacaSecret"
                        className="form-control bg-dark text-white border-secondary bg-opacity-50 ps-5 font-monospace"
                        placeholder="••••••••••••"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-secondary opacity-25" />

              <div>
                <label className="form-label text-silver small mb-1 d-flex align-items-center gap-2">
                  <ActivitySquare size={16} className="text-info" /> منصات أخرى - API المتابعة
                  (WebSockets/REST)
                </label>
                <div className="small text-secondary mb-2 opacity-75">
                  يستخدم لمتابعة الأسعار والشموع اليابانية لحظياً بدون صلاحية التداول.
                </div>
                <input
                  type="text"
                  name="trackingApi"
                  value={formData.trackingApi}
                  onChange={handleChange}
                  className="form-control bg-dark text-white border-secondary bg-opacity-50 font-monospace"
                />
              </div>

              <div>
                <label className="form-label text-silver small mb-1 d-flex align-items-center gap-2">
                  <KeyRound size={16} className="text-danger" /> منصات أخرى - API التحكم والتداول
                </label>
                <div className="small text-secondary mb-2 opacity-75">
                  يجب أن يملك صلاحيات أوامر الشراء والبيع (وينصح بالسحب عبر IP محدد).
                </div>
                <input
                  type="text"
                  name="controlApi"
                  value={formData.controlApi}
                  onChange={handleChange}
                  className="form-control bg-dark text-white border-secondary bg-opacity-50 font-monospace"
                />
              </div>

              <div className="d-flex gap-3 mt-2">
                <button
                  onClick={handleTest}
                  disabled={!formData.trackingApi}
                  className="btn btn-outline-info d-flex align-items-center gap-2"
                >
                  <Link size={18} /> اختبار الاتصال
                </button>
                <button
                  onClick={handleSave}
                  className="btn btn-gold d-flex align-items-center gap-2 px-4"
                >
                  <PlusCircle size={18} /> حفظ الإعدادات
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-3 mt-2 border border-${testResult.status === 'success' ? 'success' : testResult.status === 'error' ? 'danger' : 'info'} border-opacity-25 bg-${testResult.status === 'success' ? 'success' : testResult.status === 'error' ? 'danger' : 'info'} bg-opacity-10 text-${testResult.status === 'success' ? 'success' : testResult.status === 'error' ? 'danger' : 'info'} small d-flex align-items-center gap-2`}
                >
                  {testResult.status === 'testing' ? (
                    <div className="spinner-border spinner-border-sm"></div>
                  ) : null}
                  {testResult.msg}
                </div>
              )}
            </form>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="glass-card p-4 h-100 border-gold border-opacity-25">
            <h6 className="text-gold mb-3 d-flex align-items-center gap-2">
              <Globe size={18} /> المنصات المدعومة رسمياً
            </h6>
            <ul className="list-unstyled text-silver small d-flex flex-column gap-3 mb-4">
              <li className="d-flex align-items-center gap-2">
                <span className="text-success">✅</span> Binance (مفعل آلياً)
              </li>
              <li className="d-flex align-items-center gap-2">
                <span className="text-success">✅</span> Alpaca (مفعل آلياً)
              </li>
            </ul>

            <h6 className="text-secondary opacity-75 mb-3 small fw-bold">
              ROADMAP المنصات القادمة:
            </h6>
            <ul className="list-unstyled text-secondary small d-flex flex-column gap-2 opacity-50">
              <li>• Coinbase</li>
              <li>• Kraken</li>
              <li>• OKX</li>
              <li>• Interactive Brokers</li>
            </ul>

            <div className="mt-5 p-3 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-20 text-silver small">
              <div className="text-danger fw-bold mb-2 d-flex align-items-center gap-2">
                <AlertTriangle size={14} /> تحذير أمني
              </div>
              إضافة منصة جديدة غير مختبرة مسبقاً قد يسبب تعارض في طريقة إرسال أوامر الـ Stop Loss من
              قبل الخبراء. ينصح بتفعيل الواجهة بعد المرحلة 7.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AddMarketTab
