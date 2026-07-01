import React, { useState, useEffect } from 'react'
import { User, Shield, Bell, Save, AlertCircle, CheckCircle, Cpu, UserPlus, X } from 'lucide-react'
import ProfileTab from '../components/ProfileTab'
import NotificationsTab from '../components/NotificationsTab'
import BrainsTab from '../components/BrainsTab'
import { useAuth } from '../../../context/AuthContext'
import { useSettingStore } from '../store/useSettingStore'
import { supabase } from '../../../services/supabase'

const CreateUserModal = ({ onClose }) => {
  const [form, setForm] = useState({ email: '', name: '', password: '' })
  const [status, setStatus] = useState(null) // {type:'success'|'error', msg}
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!form.email || !form.password) {
      setStatus({ type: 'error', msg: 'البريد الإلكتروني وكلمة المرور مطلوبان' })
      return
    }
    setCreating(true)
    setStatus(null)
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email: form.email,
        password: form.password,
        user_metadata: { full_name: form.name },
        email_confirm: true
      })
      if (error) throw error
      setStatus({ type: 'success', msg: `✅ تم إنشاء المستخدم: ${data.user.email}` })
      setForm({ email: '', name: '', password: '' })
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'حدث خطأ أثناء إنشاء المستخدم' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="modal d-block" style={{ background: 'rgba(0,0,0,0.8)', zIndex: 9999 }} onClick={onClose}>
      <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
        <div className="modal-content border-0 rounded-4" style={{ background: '#0e0e1a', border: '1px solid rgba(212,175,55,0.2)' }}>
          <div className="modal-header border-0 pb-0 pt-4 px-4">
            <h6 className="modal-title fw-bold" style={{ color: '#d4af37' }}>
              <UserPlus size={18} className="me-2" />
              إنشاء مستخدم جديد
            </h6>
            <button className="btn p-0 ms-auto" onClick={onClose} style={{ color: '#888' }}>
              <X size={20} />
            </button>
          </div>
          <div className="modal-body px-4 py-3">
            {status && (
              <div className={`alert py-2 mb-3 small ${status.type === 'success' ? 'alert-success bg-success bg-opacity-10 text-success border-success' : 'alert-danger bg-danger bg-opacity-10 text-danger border-danger'}`}>
                {status.msg}
              </div>
            )}
            <div className="mb-3">
              <label className="small text-secondary mb-1 d-block">البريد الإلكتروني *</label>
              <input
                type="email"
                className="form-control bg-dark text-white border-secondary"
                placeholder="user@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="small text-secondary mb-1 d-block">الاسم</label>
              <input
                type="text"
                className="form-control bg-dark text-white border-secondary"
                placeholder="اسم المستخدم"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="mb-3">
              <label className="small text-secondary mb-1 d-block">كلمة المرور *</label>
              <input
                type="password"
                className="form-control bg-dark text-white border-secondary"
                placeholder="كلمة مرور قوية"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-0 d-flex gap-2">
            <button className="btn btn-outline-secondary flex-grow-1" onClick={onClose}>إلغاء</button>
            <button
              className="btn flex-grow-1 fw-bold"
              style={{ background: '#d4af37', color: '#000' }}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? <span className="spinner-border spinner-border-sm me-1" /> : <UserPlus size={16} className="me-1" />}
              {creating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const { user } = useAuth()
  const { fetchProfile, saveAllSettings, loading, saving, error, success, clearStatus } =
    useSettingStore()

  useEffect(() => {
    if (user) {
      fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const handleSave = async () => {
    if (user) {
      await saveAllSettings(user.id)
      // Auto clear success message after 5 seconds
      setTimeout(clearStatus, 5000)
    }
  }

  const tabs = [
    { id: 'profile', label: 'إعدادات الحساب', icon: <User size={18} /> },
    { id: 'notifications', label: 'التنبيهات', icon: <Bell size={18} /> },
    { id: 'brains', label: 'العقول والذكاء', icon: <Cpu size={18} /> }
  ]

  return (
    <div className="container-fluid p-0 animate-fade-in">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="m-0 saqr-title text-gold">إعدادات الصقر</h4>
          <p className="small text-secondary m-0">تحكم في هويتك الرقمية ومفاتيح منصات التداول</p>
        </div>
        <div className="d-flex gap-2">
<button
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-gold px-4 d-flex align-items-center gap-2 shadow-sm"
          >
            {saving ? (
              <div className="spinner-border spinner-border-sm" role="status"></div>
            ) : (
              <Save size={18} />
            )}
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>

      {/* Status Alerts */}
      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-3 bg-danger bg-opacity-10 border-danger text-danger mb-4 shadow-sm">
          <AlertCircle size={20} />
          <span>خطأ: {error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success d-flex align-items-center gap-3 bg-success bg-opacity-10 border-success text-success mb-4 shadow-sm animate-fade-in">
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      <div className="row g-4">
        {/* Navigation Sidebar */}
        <div className="col-12 col-md-3">
          <div className="glass-panel p-2">
            <div className="nav flex-column nav-pills gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-link text-start d-flex align-items-center gap-3 p-3 transition-all ${activeTab === tab.id ? 'bg-gold text-dark fw-bold shadow-sm' : 'text-silver hover-bg-light'}`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 p-3 rounded-3 glass-card border-start border-gold border-3 opacity-75">
            <div className="small text-gold mb-1 fw-bold">نصيحة أمنية</div>
            <p className="extra-small text-secondary m-0">
              قم بتغيير مفاتيح الـ API فوراً إذا شعرت بأي نشاط غير معتاد. الصقر لا يطلب مفاتيح السحب
              أبداً.
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="col-12 col-md-9">
          <div className="glass-panel p-4 min-vh-50">
            {loading ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3">
                <div className="spinner-border text-gold" role="status"></div>
                <div className="text-secondary small">جاري تحميل إعداداتك...</div>
              </div>
            ) : (
              <>
                {activeTab === 'profile' && <ProfileTab />}
                                {activeTab === 'notifications' && <NotificationsTab />}
                {activeTab === 'brains' && <BrainsTab />}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .min-vh-50 { min-height: 50vh; }
        .transition-all { transition: all 0.2s ease-in-out; }
        .hover-bg-light:hover { background: rgba(255,255,255,0.05); }
        .extra-small { font-size: 0.75rem; }
      `}</style>

    </div>
  )
}

export default SettingsPage