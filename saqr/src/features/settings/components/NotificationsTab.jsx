import React from 'react'
import { Bell, Send, MessageSquare, Info, ShieldCheck, HelpCircle } from 'lucide-react'
import { useSettingStore } from '../store/useSettingStore'

const NotificationsTab = () => {
  const { notificationsForm, setFormField } = useSettingStore()

  const handleChange = (e) => {
    setFormField('notifications', e.target.name, e.target.value)
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <h5 className="text-white mb-1">تنبيهات الصقر (Telegram)</h5>
        <p className="small text-secondary m-0">
          اربط حسابك بالبوت الرسمي لتلقي تقارير الأداء اللحظية
        </p>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <div className="glass-card p-4 border-gold border-opacity-10">
            <div className="d-flex align-items-center gap-3 mb-4">
              <div className="bg-primary bg-opacity-10 p-3 rounded-circle">
                <Send className="text-primary" size={24} />
              </div>
              <div>
                <h6 className="m-0 text-white">إعدادات الربط المباشر</h6>
                <div className="small text-secondary">
                  بوت الصقر: <span className="text-gold">@SaqrTrading_Bot</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label text-silver small mb-2 d-flex align-items-center gap-2">
                <MessageSquare size={16} className="text-primary" /> معرف الدردشة (Telegram Chat ID)
              </label>
              <input
                type="text"
                name="telegramChatId"
                value={notificationsForm.telegramChatId}
                onChange={handleChange}
                className="form-control bg-dark border-secondary bg-opacity-50 text-white p-3 font-monospace"
                placeholder="مثال: 123456789"
              />
              <div className="extra-small text-secondary mt-2 d-flex align-items-center gap-2">
                <ShieldCheck size={14} className="text-success" /> يتم استخدامه لإرسال التنبيهات لك
                فقط.
              </div>
            </div>

            <hr className="border-secondary opacity-25" />

            <div className="d-flex flex-column gap-3 mt-4">
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="alertEntry"
                  checked
                  readOnly
                />
                <label className="form-check-label text-silver small" htmlFor="alertEntry">
                  تنبيهات دخول الصفقات
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="alertExit"
                  checked
                  readOnly
                />
                <label className="form-check-label text-silver small" htmlFor="alertExit">
                  تنبيهات إغلاق الصفقات (الربح/الخسارة)
                </label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="alertDaily"
                  defaultChecked
                />
                <label className="form-check-label text-silver small" htmlFor="alertDaily">
                  تقرير الأداء اليومي والتلخيص
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* How to get ID Sidebar */}
        <div className="col-12 col-xl-5">
          <div className="glass-panel p-4 border-info border-opacity-10">
            <h6 className="text-info mb-3 d-flex align-items-center gap-2">
              <HelpCircle size={18} /> كيف أحصل على الـ ID الخاص بي؟
            </h6>
            <div className="d-flex flex-column gap-3">
              <div className="d-flex gap-3">
                <div
                  className="badge bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 24, height: 24 }}
                >
                  1
                </div>
                <div className="small text-silver">
                  ابحث عن بوت باسم <code>@userinfobot</code> في تلغرام.
                </div>
              </div>
              <div className="d-flex gap-3">
                <div
                  className="badge bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 24, height: 24 }}
                >
                  2
                </div>
                <div className="small text-silver">
                  أرسل له أي رسالة، وسيقوم بالرد عليك بـ ID الخاص بك مباشرة.
                </div>
              </div>
              <div className="d-flex gap-3">
                <div
                  className="badge bg-info bg-opacity-20 text-info rounded-circle d-flex align-items-center justify-content-center"
                  style={{ width: 24, height: 24 }}
                >
                  3
                </div>
                <div className="small text-silver">
                  انسخ الرقم والصقه في الخانة المجاورة، ثم اضغط "حفظ" بالأعلى.
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-3 bg-info bg-opacity-5 border border-info border-opacity-10">
              <div className="extra-small text-info d-flex align-items-center gap-2 mb-2">
                <Info size={14} /> ملاحظة هامة
              </div>
              <p className="extra-small text-secondary m-0">
                يجب عليك بدء الدردشة مع بوت الصقر أولاً (ضغط Start) لكي يتمكن من إرسال الرسائل لك.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .extra-small { font-size: 0.75rem; }
        .font-monospace { font-family: 'Courier New', Courier, monospace; }
        .form-check-input:checked { background-color: var(--saqr-gold); border-color: var(--saqr-gold); }
      `}</style>
    </div>
  )
}

export default NotificationsTab
