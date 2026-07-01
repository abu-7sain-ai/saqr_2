import React, { useState } from 'react'
import { ShieldCheck, Mail, Lock, LogIn, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '../../../services/supabase'

const LoginPage = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError) throw authError
      // App.jsx will handle navigation after AuthProvider detects the session
    } catch (err) {
      console.error('Login error:', err)
      setError('خطأ في الدخول: تأكد من الإيميل والباسورد')
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
          <h1 className="text-accent-primary h2 mb-2 saqr-title">منصة الصقر للتدول</h1>
          <p className="text-secondary small">التداول الذكي بمبدأ الحذر أولاً</p>
        </div>

        <form onSubmit={handleSubmit} className="d-flex flex-column gap-4">
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

          {error && (
            <div className="alert alert-danger bg-danger bg-opacity-10 border-danger border-opacity-25 text-danger d-flex align-items-center gap-2 small animate-shake">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-accent w-100 py-3 d-flex align-items-center justify-content-center gap-2 mt-2 shadow-accent"
            disabled={loading}
          >
            <span className="fw-bold">{loading ? 'جاري التحقق...' : 'دخول للمنصة'}</span>
            {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="small text-secondary m-0">
            ليس لديك حساب؟{' '}
            <a
              href="#"
              className="text-white text-decoration-none fw-semibold d-inline-flex align-items-center gap-1"
            >
              طلب انضمام <ChevronRight size={14} />
            </a>
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
