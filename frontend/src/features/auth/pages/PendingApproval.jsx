import React from 'react'
import { Clock, ShieldAlert, LogOut } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'

const PendingApproval = () => {
  const { signOut } = useAuth()

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-darker p-3">
      <div
        className="glass-panel p-5 text-center shadow-lg animate-fade-in"
        style={{ maxWidth: '500px', borderTop: '4px solid #ffc107' }}
      >
        <div className="d-inline-flex align-items-center justify-content-center bg-warning bg-opacity-10 p-4 rounded-circle mb-4">
          <Clock size={64} className="text-warning" />
        </div>

        <h3 className="text-white fw-bold mb-3">الحساب قيد المراجعة</h3>
        <p className="text-secondary mb-5 fs-5">
          تم استلام طلب انضمامك بنجاح. حسابك الآن قيد التدقيق الإداري من قبل "الإدمن".
          <br />
          <br />
          سنقوم بتفعيل حسابك فور التأكد من صلاحياتك. يرجى العودة لاحقاً.
        </p>

        <div className="d-grid gap-3">
          <button
            className="btn btn-outline-secondary py-3 d-flex align-items-center justify-content-center gap-2"
            onClick={signOut}
          >
            <LogOut size={18} /> تسجيل الخروج والعودة لاحقاً
          </button>
        </div>

        <div className="mt-5 pt-4 border-top border-white border-opacity-5 d-flex align-items-center justify-content-center gap-2 text-warning opacity-75">
          <ShieldAlert size={16} />
          <span className="small">نظام الصقر - الحذر أولاً</span>
        </div>
      </div>
    </div>
  )
}

export default PendingApproval
