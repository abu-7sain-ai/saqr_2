import React, { useState } from 'react'
import { ShieldCheck, Users, Settings, Filter } from 'lucide-react'
import UsersManagementTab from '../components/UsersManagementTab'
import SystemSettingsTab from '../components/SystemSettingsTab'

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="container-fluid p-4 animate-fade-in pb-5 mb-5">
      <div className="d-flex justify-content-between align-items-end mb-4 border-bottom border-secondary border-opacity-25 pb-3">
        <div>
          <h2 className="text-white fw-bold d-flex align-items-center gap-3">
            <ShieldCheck size={32} className="text-gold" />
            <span>لوحة الإدارة</span>
            <span className="badge bg-danger bg-opacity-25 text-danger fs-6 rounded-pill border border-danger">
              Admin Only
            </span>
          </h2>
          <p className="text-secondary m-0 mt-2">
            إدارة المستخدمين وإعدادات أمان النظام الخاصة بالصقر
          </p>
        </div>
      </div>

      <div className="row">
        {/* Sidebar Navigation for Admin Settings */}
        <div className="col-12 col-md-3 col-lg-2 mb-4">
          <div className="nav flex-column nav-pills gap-2" role="tablist">
            <button
              className={`nav-link text-start d-flex align-items-center gap-3 p-3 rounded-3 transition-all ${activeTab === 'users' ? 'active bg-gold text-dark fw-bold' : 'text-silver hover-bg-light border border-white border-opacity-10'}`}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} /> إدارة المستخدمين
            </button>
            <button
              className={`nav-link text-start d-flex align-items-center gap-3 p-3 rounded-3 transition-all ${activeTab === 'system' ? 'active bg-gold text-dark fw-bold' : 'text-silver hover-bg-light border border-white border-opacity-10'}`}
              onClick={() => setActiveTab('system')}
            >
              <Settings size={18} /> إعدادات النظام
            </button>
          </div>
        </div>

        {/* Dynamic Content Area */}
        <div className="col-12 col-md-9 col-lg-10">
          <div className="glass-panel p-4 h-100">
            {activeTab === 'users' && <UsersManagementTab />}
            {activeTab === 'system' && <SystemSettingsTab />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
