import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('🔴 [Saqr ErrorBoundary]:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#050508',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Inter, sans-serif',
            color: '#fff',
            flexDirection: 'column',
            textAlign: 'center',
            padding: '2rem'
          }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '28px',
              padding: '3rem',
              maxWidth: '560px',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🦅</div>
            <h1 style={{ color: '#FFD700', fontWeight: 900, marginBottom: '0.5rem' }}>
              خطأ في التطبيق
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '2rem', direction: 'rtl' }}>
              حدث خطأ تقني. يرجى تحديث الصفحة أو التواصل مع الدعم.
            </p>
            <details
              style={{
                background: 'rgba(255,0,0,0.05)',
                border: '1px solid rgba(255,0,0,0.2)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '2rem',
                textAlign: 'left',
                direction: 'ltr',
                fontSize: '0.75rem',
                color: 'rgba(255,100,100,0.8)'
              }}
            >
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                تفاصيل الخطأ (للمطور)
              </summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #FFF200, #FFD700)',
                color: '#000',
                border: 'none',
                borderRadius: '14px',
                padding: '14px 40px',
                fontWeight: 900,
                fontSize: '1rem',
                cursor: 'pointer',
                letterSpacing: '0.05em'
              }}
            >
              🔄 إعادة تحميل المنصة
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
