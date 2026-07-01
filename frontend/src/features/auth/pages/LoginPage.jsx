import React, { useState } from 'react'
import { ShieldCheck, Mail, Lock, LogIn, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../services/supabase'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [isRegister, setIsRegister] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      if (isRegister) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name
            }
          }
        })
        if (signUpError) throw signUpError
        setSuccessMsg('تم إرسال طلب انضمامك! إذا تم تفعيل التأكيد البريدي، يرجى مراجعة بريدك الإلكتروني.')
        setIsRegister(false)
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (authError) throw authError
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(isRegister ? 'فشل إرسال الطلب: ' + err.message : 'خطأ في الدخول: تأكد من الإيميل والباسورد')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container d-flex align-items-center justify-content-center vh-100 p-3">
      <div className="glass-panel p-5 w-100 animate-fade-in" style={{ maxWidth: '480px' }}>
        <div className="text-center mb-5">
          <div
            className="d-inline-flex align-items-center justify-content-center bg-accent-primary p-3 rounded-circle mb-4 shadow-accent"
          >
            <ShieldCheck size={48} className="text-black" />
          </div>
          <h1 className="text-accent-primary h2 mb-2 saqr-title">منصة الصقر للتداول</h1>
          <p className="text-secondary small">التداول الذكي بمبدأ الحذر أولاً</p>
        </div>

        {successMsg && (
          <div className="alert alert-success bg-success bg-opacity-10 border-success border-opacity-25 text-success small mb-4">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger d-flex align-items-center gap-2 small mb-4 animate-shake">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="d-flex flex-column gap-4">
          {isRegister && (
            <div className="form-group animate-fade-in">
              <label className="small text-secondary mb-2 d-block ms-1">الاسم الكامل</label>
              <div className="position-relative">
                <input
                  type="text"
                  className="form-control glass-card border-0 p-3 text-white"
                  placeholder="الاسم الثلاثي"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="small text-secondary mb-2 d-block ms-1">البريد الإلكتروني</label>
            <div className="position-relative">
              <Mail
                className="position-absolute translate-middle-y top-50 ms-3 opacity-50"
                size={18}
              />
              <input
                type="email"
                className="form-control glass-card border-0 p-3 ps-5 text-white"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="small text-secondary mb-2 d-block ms-1">كلمة المرور</label>
            <div className="position-relative">
              <Lock
                className="position-absolute translate-middle-y top-50 ms-3 opacity-50"
                size={18}
              />
              <input
                type="password"
                className="form-control glass-card border-0 p-3 ps-5 text-white"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {!isRegister && (
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
              <div className="form-check">
                <input
                  className="form-check-input bg-transparent border-secondary"
                  type="checkbox"
                  id="rememberMe"
                />
                <label
                  className="form-check-label small text-silver cursor-pointer"
                  htmlFor="rememberMe"
                >
                  تذكرني
                </label>
              </div>
              <a href="#" className="small text-accent-primary text-decoration-none hover-underline">
                فقدت كلمة المرور؟
              </a>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent w-100 py-3 d-flex align-items-center justify-content-center gap-2 mt-2 shadow-accent"
            disabled={loading}
          >
            <span className="fw-bold">
              {loading ? 'جاري الإرسال...' : isRegister ? 'تقديم طلب انضمام' : 'دخول للمنصة'}
            </span>
            {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="small text-secondary m-0">
            {isRegister ? 'لديك حساب بالفعل؟' : 'ليس لديك حساب؟'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setError(null)
              }}
              className="bg-transparent border-0 text-white fw-semibold d-inline-flex align-items-center gap-1 hover-underline"
            >
              {isRegister ? 'تسجيل الدخول' : 'طلب انضمام'}{' '}
              <ChevronRight size={14} style={{ transform: isRegister ? 'rotate(180deg)' : 'none' }} />
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .login-container {
          background: radial-gradient(circle at center, var(--bg-surface) 0%, var(--bg-deep) 100%);
          position: relative;
          overflow: hidden;
        }
        .login-container::before {
          content: "";
          position: absolute;
          width: 500px;
          height: 500px;
          background: var(--accent-primary);
          filter: blur(150px);
          top: -200px;
          right: -200px;
          opacity: 0.1;
          border-radius: 50%;
        }
        .hover-underline:hover { text-decoration: underline !important; }
      `}</style>
    </div>
  )
}

export default LoginPage
