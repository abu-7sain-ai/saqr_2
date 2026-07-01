import React, { useState, useEffect } from 'react'
import { User, Shield, Bell, Save, AlertCircle, CheckCircle, Cpu } from 'lucide-react'
import ProfileTab from '../components/ProfileTab'
import PlatformsTab from '../components/PlatformsTab'
import NotificationsTab from '../components/NotificationsTab'
import BrainsTab from '../components/BrainsTab'
import { useAuth } from '../../../context/AuthContext'
import { useSettingStore } from '../store/useSettingStore'

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
    { id: 'platforms', label: 'منصات التداول', icon: <Shield size={18} /> },
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
                {activeTab === 'platforms' && <PlatformsTab />}
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
