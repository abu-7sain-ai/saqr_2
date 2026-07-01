import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Utensils,
  BarChart3,
  Settings,
  ShieldCheck,
  LogOut,
  Package
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const Sidebar = () => {
  const { signOut } = useAuth()
  const menuItems = [
    { name: 'لوحة التحكم', icon: <LayoutDashboard size={20} />, path: '/dashboard' },
    { name: 'الموظفون', icon: <Users size={20} />, path: '/workers' },
    { name: 'اجتماع الخبراء', icon: <Utensils size={20} />, path: '/kitchen' },
    { name: 'التحليلات', icon: <BarChart3 size={20} />, path: '/analytics' },
    { name: 'الأسواق المتاحة', icon: <Package size={20} />, path: '/assets' },
    { name: 'الإعدادات', icon: <Settings size={20} />, path: '/settings' },
    { name: 'لوحة الإدارة', icon: <ShieldCheck size={20} />, path: '/admin' }
  ]

  return (
    <aside
      className="sidebar fixed-top h-100 glass-panel"
      style={{ width: '280px', borderRadius: '0', borderRight: '1px solid var(--border-subtle)' }}
    >
      <div className="p-4 d-flex flex-column h-100">
        <div className="sidebar-brand mb-5 mt-2 d-flex align-items-center gap-3 px-2">
          <div className="bg-accent-primary p-2 rounded-3 shadow-accent">
            <ShieldCheck className="text-black" size={24} />
          </div>
          <h2
            className="m-0 saqr-title"
            style={{ fontSize: '1.5rem', letterSpacing: '2px', fontWeight: 900 }}
          >
            <span className="text-accent-primary">الصقر</span>
            <span
              className="extra-small d-block opacity-40 text-white fw-medium"
              style={{ marginTop: '-5px' }}
            >
              SYSTEM V3.0
            </span>
          </h2>
        </div>

        <nav className="flex-grow-1 px-1">
          <ul className="list-unstyled">
            {menuItems.map((item) => (
              <li key={item.path} className="mb-3">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `d-flex align-items-center gap-3 p-3 text-decoration-none rounded-4 transition-all ${
                      isActive
                        ? 'active-nav-item text-accent-primary'
                        : 'text-silver opacity-60 hover-opacity-100'
                    }`
                  }
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <span className="icon-wrapper">{item.icon}</span>
                  <span className="fw-bold tracking-wide" style={{ fontSize: '0.9375rem' }}>
                    {item.name}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-top border-white border-opacity-10 pt-4 px-2">
          <button
            onClick={() => signOut()}
            className="btn btn-link text-ruby d-flex align-items-center gap-3 p-3 text-decoration-none border-0 w-100 text-start opacity-50 hover-opacity-100 transition-all"
          >
            <LogOut size={20} />
            <span className="fw-bold">تسجيل الخروج</span>
          </button>
        </div>
      </div>

      <style>{`
        .sidebar { z-index: 1030; }
        .active-nav-item { 
          background: linear-gradient(90deg, rgba(0, 255, 157, 0.1) 0%, transparent 100%);
          border-left: 4px solid var(--accent-primary);
          box-shadow: -10px 0 20px rgba(0, 255, 157, 0.05);
          filter: drop-shadow(0 0 5px rgba(0, 255, 157, 0.2));
        }
        .icon-wrapper { transition: transform 0.3s ease; }
        .active-nav-item .icon-wrapper { transform: scale(1.1); }
        .hover-opacity-100:hover { opacity: 1 !important; background: rgba(255, 255, 255, 0.03); }
        .tracking-wide { letter-spacing: 0.02em; }
      `}</style>
    </aside>
  )
}

export default Sidebar
