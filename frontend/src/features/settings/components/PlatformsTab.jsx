import React, { useState } from 'react'
import {
  Shield,
  Key,
  Eye,
  EyeOff,
  Info,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { useSettingStore } from '../store/useSettingStore'

const PlatformsTab = () => {
  const { platformsForm, setFormField, testPlatformConnection, platformsStatus } = useSettingStore()
  const [visibleFields, setVisibleFields] = useState({})

  const toggleVisibility = (field) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const handleChange = (e) => {
    setFormField('platforms', e.target.name, e.target.value)
  }

  const PlatformCard = ({ id, name, link, fields }) => {
    const status = platformsStatus[id] || { connected: false, message: '', testing: false }
    const isPaper = platformsForm[`${id}IsPaper`]

    const handleTogglePaper = () => {
      setFormField('platforms', `${id}IsPaper`, !isPaper)
    }

    return (
      <div className="glass-card p-4 border-gold border-opacity-10 mb-4 h-100 position-relative overflow-hidden">
        {/* Connection Status Ribbon */}
        <div
          className={`position-absolute top-0 end-0 px-3 py-1 extra-small fw-bold ${status.connected ? 'bg-success text-white' : 'bg-secondary bg-opacity-25 text-silver'}`}
          style={{ transform: 'rotate(0deg)', borderBottomLeftRadius: '10px' }}
        >
          {status.connected ? 'متصل' : 'غير متصل'}
        </div>

        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="bg-white bg-opacity-5 p-2 rounded-3">
              <Shield className="text-gold" size={24} />
            </div>
            <div>
              <h6 className="m-0 text-white">{name}</h6>
              <div className="extra-small text-secondary mt-1">
                {isPaper ? (
                  <span className="text-warning">وضع التداول الوهمي نشط</span>
                ) : (
                  <span className="text-emerald">وضع التداول الحقيقي</span>
                )}
              </div>
            </div>
          </div>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="btn btn-link btn-sm text-gold text-decoration-none d-flex align-items-center gap-1 opacity-75 hover-opacity-100 transition-all"
          >
            <ExternalLink size={14} /> جلب المفاتيح
          </a>
        </div>

        {/* Paper/Live Toggle Switch */}
        <div className="mb-4 p-2 rounded-3 bg-white bg-opacity-5 d-flex align-items-center justify-content-between">
          <span className="small text-silver ms-2">نوع الحساب</span>
          <div className="d-flex gap-1 p-1 bg-black bg-opacity-50 rounded-pill shadow-inner">
            <button
              onClick={() => setFormField('platforms', `${id}IsPaper`, true)}
              className={`btn btn-sm rounded-pill px-3 py-1 transition-all border-0 ${isPaper ? 'bg-gold text-black fw-bold' : 'text-silver'}`}
            >
              وهمي (Paper)
            </button>
            <button
              onClick={() => setFormField('platforms', `${id}IsPaper`, false)}
              className={`btn btn-sm rounded-pill px-3 py-1 transition-all border-0 ${!isPaper ? 'bg-gold text-black fw-bold' : 'text-silver'}`}
            >
              حقيقي (Live)
            </button>
          </div>
        </div>

        <div className="d-flex flex-column gap-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label className="form-label text-silver extra-small mb-2 d-flex justify-content-between align-items-center">
                <span>{field.label}</span>
                <button
                  onClick={() => toggleVisibility(field.name)}
                  className="btn btn-link border-0 p-0 text-secondary hover-text-gold transition-all"
                  title={visibleFields[field.name] ? 'إخفاء' : 'إظهار'}
                >
                  {visibleFields[field.name] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </label>
              <div className="position-relative">
                <Key
                  className="position-absolute top-50 start-0 translate-middle-y ms-3 opacity-25"
                  size={16}
                />
                <input
                  type={visibleFields[field.name] ? 'text' : 'password'}
                  name={field.name}
                  value={platformsForm[field.name]}
                  onChange={handleChange}
                  autoComplete="off"
                  className="form-control bg-dark border-secondary bg-opacity-50 text-white ps-5 font-monospace small"
                  placeholder={field.placeholder}
                />
              </div>
            </div>
          ))}

          {/* Permissions Checkboxes */}
          <div className="row g-2 mt-1">
            <div className="col-6">
              <div
                className={`p-2 rounded-3 border transition-all cursor-pointer d-flex align-items-center gap-2 ${platformsForm[`${id}Watch`] ? 'border-gold bg-gold bg-opacity-10' : 'border-secondary border-opacity-20 bg-white bg-opacity-5'}`}
                onClick={() =>
                  setFormField('platforms', `${id}Watch`, !platformsForm[`${id}Watch`])
                }
              >
                <div
                  className={`p-1 rounded-circle ${platformsForm[`${id}Watch`] ? 'bg-gold text-black' : 'bg-secondary bg-opacity-20 text-silver'}`}
                >
                  <Eye size={12} />
                </div>
                <span className="extra-small text-silver">مراقبة (Watch)</span>
              </div>
            </div>
            <div className="col-6">
              <div
                className={`p-2 rounded-3 border transition-all cursor-pointer d-flex align-items-center gap-2 ${platformsForm[`${id}Control`] ? 'border-emerald bg-emerald bg-opacity-10' : 'border-secondary border-opacity-20 bg-white bg-opacity-5'}`}
                onClick={() =>
                  setFormField('platforms', `${id}Control`, !platformsForm[`${id}Control`])
                }
              >
                <div
                  className={`p-1 rounded-circle ${platformsForm[`${id}Control`] ? 'bg-emerald text-white' : 'bg-secondary bg-opacity-20 text-silver'}`}
                >
                  <RefreshCw size={12} />
                </div>
                <span className="extra-small text-silver">تداول (Control)</span>
              </div>
            </div>
          </div>

          <div className="mt-2 d-flex gap-2">
            <button
              onClick={() => testPlatformConnection(id)}
              disabled={status.testing}
              className={`btn btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-2 transition-all ${status.connected ? 'btn-outline-success' : 'btn-outline-gold'}`}
            >
              {status.testing ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : status.connected ? (
                <CheckCircle size={14} />
              ) : (
                <RefreshCw size={14} />
              )}
              {status.testing ? 'جاري الاختبار...' : 'اختبار الاتصال'}
            </button>

            <button
              onClick={async () => {
                if (window.confirm('هل أنت متأكد من رغبتك في حذف إعدادات هذه المنصة؟')) {
                  // Logic to clear fields and save
                  setFormField('platforms', `${id}Key`, '')
                  setFormField('platforms', `${id}Secret`, '')
                  setFormField('platforms', `${id}Watch`, false)
                  setFormField('platforms', `${id}Control`, false)
                  alert(
                    'تم تفريغ الحقول. يرجى الضغط على "حفظ التغييرات" في الأعلى لإتمام الحذف من قاعدة البيانات.'
                  )
                }
              }}
              className="btn btn-sm btn-outline-danger p-2 px-3"
              title="حذف الإعدادات"
            >
              <XCircle size={16} />
            </button>
          </div>

          {status.message && (
            <div
              className={`mt-2 extra-small p-2 rounded-2 d-flex align-items-start gap-2 ${status.connected ? 'text-success bg-success bg-opacity-10' : 'text-danger bg-danger bg-opacity-10'}`}
            >
              {status.connected ? (
                <CheckCircle size={14} className="mt-1 flex-shrink-0" />
              ) : (
                <XCircle size={14} className="mt-1 flex-shrink-0" />
              )}
              <span>{status.message}</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h5 className="text-white mb-1">منصات التداول والأسواق</h5>
          <p className="small text-secondary m-0">
            اربط حساباتك بمنصات التداول العالمية لبدء التنفيذ الآلي
          </p>
        </div>
        {Object.values(platformsForm).some((val) => val === true) && (
          <div className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-20 p-2 px-3 small d-flex align-items-center gap-2">
            <AlertTriangle size={14} /> وضع التداول الوهمي (Paper) نشط لبعض المنصات
          </div>
        )}
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <PlatformCard
            id="binance"
            name="Binance Futures / Spot"
            link="https://www.binance.com/en/my/settings/api-management"
            fields={[
              { name: 'binanceKey', label: 'Binance API Key', placeholder: 'Key...' },
              { name: 'binanceSecret', label: 'Binance API Secret', placeholder: 'Secret...' }
            ]}
          />
        </div>

        <div className="col-12 col-xl-6">
          <PlatformCard
            id="alpaca"
            name="Alpaca Paper (أسهم وكريبتو)"
            link="https://app.alpaca.markets/paper/dashboard/overview"
            fields={[
              { name: 'alpacaKey', label: 'Alpaca API Key', placeholder: 'PK...' },
              { name: 'alpacaSecret', label: 'Alpaca API SecretKey', placeholder: 'Secret...' }
            ]}
          />
        </div>
      </div>

      <div className="mt-4 p-3 rounded-3 bg-white bg-opacity-5 border border-white border-opacity-10 d-flex align-items-start gap-3">
        <div className="p-2 bg-info bg-opacity-10 rounded-2">
          <Info className="text-info" size={20} />
        </div>
        <div className="small text-secondary">
          <strong className="text-white d-block mb-1">توضيح بخصوص الأمان</strong>
          يتم تخزين المفاتيح في قاعدة بيانات مشفرة. زر العين يسمح لك بمشاهدة المفتاح للتأكد، ولكن
          عند الحفظ يتم إرسال المفاتيح عبر قناة مؤمنة. يجب الضغط على <b>حفظ التغييرات</b> في الأعلى
          لاعتماد المفاتيح الجديدة.
        </div>
      </div>

      <style>{`
        .extra-small { font-size: 0.75rem; }
        .hover-text-gold:hover { color: var(--saqr-gold) !important; }
        .hover-opacity-100:hover { opacity: 1 !important; }
        .font-monospace { font-family: 'Courier New', Courier, monospace; letter-spacing: 1px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default PlatformsTab
