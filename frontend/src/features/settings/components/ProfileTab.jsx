import React from 'react'
import { User, Mail, Award, Info } from 'lucide-react'
import { useSettingStore } from '../store/useSettingStore'

const ProfileTab = () => {
  const { profileForm, setFormField } = useSettingStore()

  const handleChange = (e) => {
    setFormField('profile', e.target.name, e.target.value)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h5 className="text-white mb-1">إعدادات الحساب</h5>
        <p className="small text-secondary m-0">إدارة معلوماتك الأساسية ورتبة التداول</p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-md-8">
          <div className="d-flex flex-column gap-4">
            {/* Full Name */}
            <div>
              <label className="form-label text-silver small mb-2 d-flex align-items-center gap-2">
                <User size={16} className="text-gold" /> الاسم المتكامل
              </label>
              <input
                type="text"
                name="full_name"
                value={profileForm.full_name}
                onChange={handleChange}
                className="form-control bg-dark border-secondary bg-opacity-50 text-white p-3"
                placeholder="مثلاً: صقر الجزيرة"
              />
            </div>

            {/* Email (Read Only for now as per Supabase Auth standard) */}
            <div>
              <label className="form-label text-silver small mb-2 d-flex align-items-center gap-2 opacity-75">
                <Mail size={16} /> البريد الإلكتروني (أساسي)
              </label>
              <input
                type="email"
                value={profileForm.email}
                disabled
                className="form-control bg-dark border-secondary bg-opacity-25 text-secondary p-3 cursor-not-allowed"
              />
              <div className="extra-small text-secondary mt-1 d-flex align-items-center gap-1">
                <Info size={12} /> البريد مرتبط بحساب Auth الخاص بك ولا يمكن تغييره حالياً.
              </div>
            </div>

            {/* Role / Bio */}
            <div>
              <label className="form-label text-silver small mb-2 d-flex align-items-center gap-2">
                <Award size={16} className="text-gold" /> رتبة المستخدم / المسمى
              </label>
              <select
                name="role"
                value={profileForm.role}
                onChange={handleChange}
                className="form-select bg-dark border-secondary bg-opacity-50 text-white p-3"
              >
                <option value="تريدر">تريدر (مبتدئ)</option>
                <option value="محترف">متداول محترف</option>
                <option value="إدمن">مدير النظام (Admin)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="col-12 col-md-4">
          <div className="glass-card p-4 text-center d-flex flex-column align-items-center justify-content-center h-100 border-gold border-opacity-10">
            <div className="avatar-placeholder mb-3">
              <div
                className="bg-gold bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 80, height: 80 }}
              >
                <User size={40} className="text-gold" />
              </div>
            </div>
            <h6 className="text-white mb-1">{profileForm.full_name || 'مستخدم جديد'}</h6>
            <span className="badge bg-gold bg-opacity-10 text-gold border border-gold border-opacity-20 px-3 py-2 mb-3">
              {profileForm.role}
            </span>
            <div className="small text-secondary">عضو منذ أبريل 2026</div>
          </div>
        </div>
      </div>

      <style>{`
        .cursor-not-allowed { cursor: not-allowed; }
        .extra-small { font-size: 0.75rem; }
      `}</style>
    </div>
  )
}

export default ProfileTab