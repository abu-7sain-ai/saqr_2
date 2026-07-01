import React, { useEffect, useState } from 'react'
import { Search, Bell, User, Zap, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '../../services/supabase'

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [connection, setConnection] = useState({ connected: false, loading: true })
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Check for ANY connected API
        const { data: apis } = await supabase
          .from('market_apis')
          .select('watch_connected, control_connected')
          .or('watch_connected.eq.true,control_connected.eq.true')
          .limit(1)

        const { data: mState } = await supabase
          .from('market_state')
          .select('current_type')
          .eq('id', 1)
          .single()

        setConnection({
          connected: (apis && apis.length > 0) || false,
          loading: false
        })
      } catch (err) {
        setConnection({ connected: false, loading: false })
      }
    }

    const fetchUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
          if (profile) {
            setUserName(profile.full_name || user.email?.split('@')[0] || 'مستخدم')
            setUserRole(profile.role === 'admin' ? 'مسؤول' : 'متداول')
          }
        }
      } catch (_) {}
    }
    fetchStatus()
    fetchUser()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const toggleMobileMenu = () => {
    const sidebar = document.querySelector('.sidebar')
    if (sidebar) {
      sidebar.classList.toggle('show')
      setIsMobileMenuOpen(!isMobileMenuOpen)
    }
  }

  return (
    <nav className="navbar navbar-expand-lg mb-4 p-0 animate-fade-in">
      <div className="container-fluid p-0">
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="d-lg-none d-flex align-items-center justify-content-between w-100 mb-3 px-2">
          <div className="d-flex align-items-center gap-2">
            <Zap className="text-accent-primary" size={24} />
            <h5 className="m-0 text-accent-primary fw-bold">الصقر</h5>
          </div>
          <button
            onClick={toggleMobileMenu}
            className="btn btn-link glass-card p-2 text-accent-primary border-0 shadow-none"
          >
            {isMobileMenuOpen ? <Wifi size={24} className="text-ruby" /> : <Search size={24} />}
            <span className="ms-2 small">القائمة</span>
          </button>
        </div>

        <div className="d-flex align-items-center gap-3 w-100">

          <div className="ms-auto d-flex align-items-center gap-2 gap-md-3">
            {/* Notifications */}
            <button className="btn btn-link glass-card p-2 text-white position-relative hover-bg-light border-0">
              <Bell size={20} />
              <span className="position-absolute top-2 start-75 translate-middle p-1 bg-ruby border border-2 border-dark rounded-circle"></span>
            </button>

            {/* User Profile */}
            <div className="glass-card d-flex align-items-center gap-2 gap-md-3 px-2 px-md-3 py-1 hover-bg-light cursor-pointer border-0">
              <div className="text-end d-none d-md-block">
                <div className="fw-bold small">{userName || 'مستخدم'}</div>
                <div className="small opacity-50" style={{ fontSize: '10px' }}>
                  {userRole}
                </div>
              </div>
              <div
                className="bg-accent-primary rounded-circle d-flex align-items-center justify-content-center shadow-accent"
                style={{ width: '32px', height: '32px' }}
              >
                <User size={18} className="text-black" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .border-gold-subtle { border-color: rgba(197, 160, 89, 0.2) !important; }
        .cursor-pointer { cursor: pointer; }
        .tracking-wider { letter-spacing: 0.05em; }
      `}</style>
    </nav>
  )
}

export default Navbar