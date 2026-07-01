import React, { useState, useEffect } from 'react'
import {
  Package,
  LayoutGrid,
  Plus,
  RefreshCcw,
  Search,
  Filter,
  TrendingUp,
  Globe,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Activity
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import InventoryPage from './InventoryPage'
import MarketsPage from './MarketsPage'

const AssetsPage = () => {
  const [activeTab, setActiveTab] = useState('markets') // Focus only on markets
  const [stats, setStats] = useState({
    activeMarkets: 0,
    totalTrades: 0
  })

  useEffect(() => {
    fetchGlobalStats()
  }, [])

  const fetchGlobalStats = async () => {
    try {
      const { count: marketCount } = await supabase
        .from('markets')
        .select('*', { count: 'exact', head: true, eq: { is_active: true } })

      setStats({
        activeMarkets: marketCount || 0,
        totalTrades: 0 // Placeholder
      })
    } catch (err) {
      console.error('Error fetching global stats:', err)
    }
  }

  return (
    <div className="container-fluid p-0 animate-fade-in" style={{ background: 'transparent' }}>
      {/* Premium Header */}
      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-end mb-2">
          <div>
            <h1
              className="text-gold m-0 mb-1"
              style={{ fontSize: '1.75rem', textShadow: '0 0 30px rgba(255, 215, 0, 0.2)' }}
            >
              الأسواق المتاحة
            </h1>
            <p className="text-silver fw-medium m-0 fs-5" style={{ opacity: 0.9 }}>
              إدارة الأسواق والقوائم البيضاء والمؤشرات القيادية للذكاء الاصطناعي
            </p>
          </div>
          <div className="d-flex gap-3">
            <div
              className="glass-card px-4 py-3 d-flex align-items-center gap-3"
              style={{
                background: 'rgba(0, 255, 204, 0.05)',
                borderColor: 'rgba(0, 255, 204, 0.2)'
              }}
            >
              <div className="text-emerald d-flex flex-column">
                <span className="x-small text-silver opacity-50 text-uppercase fw-bold">
                  الحالة التشغيلية
                </span>
                <span className="fw-bold fs-5 d-flex align-items-center gap-2">
                  <Activity size={18} /> النظام متصل
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="row g-4 mb-5">
        <div className="col-12 col-md-6">
          <div
            className="glass-card p-4 border-start border-4 border-emerald"
            style={{ background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.05), transparent)' }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-silver small fw-bold opacity-75 text-uppercase mb-1 tracking-wider">
                  الأسواق النشطة
                </p>
                <h1 className="text-white m-0 fw-black" style={{ fontSize: '1.5rem' }}>
                  {stats.activeMarkets}
                </h1>
              </div>
              <div
                className="bg-emerald bg-opacity-20 p-3 rounded-4 text-emerald"
                style={{ boxShadow: '0 0 20px rgba(0, 255, 204, 0.2)' }}
              >
                <Globe size={32} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div
            className="glass-card p-4 border-start border-4 border-info"
            style={{ background: 'linear-gradient(135deg, rgba(0, 204, 255, 0.05), transparent)' }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <p className="text-silver small fw-bold opacity-75 text-uppercase mb-1 tracking-wider">
                  سلامة المحفظة
                </p>
                <h1 className="text-white m-0 fw-black" style={{ fontSize: '1.5rem' }}>
                  %100
                </h1>
              </div>
              <div
                className="bg-info bg-opacity-20 p-3 rounded-4 text-info"
                style={{ boxShadow: '0 0 20px rgba(0, 204, 255, 0.2)' }}
              >
                <ShieldCheck size={32} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Page Content */}
      <div className="assets-content">
        <MarketsPage />
      </div>

      <style>{`
        .w-fit-content { width: fit-content; }
        .fw-black { font-weight: 900; }
        .hover-bg-white-5:hover { background: rgba(255,255,255,0.05); }
        .shadow-gold { box-shadow: 0 10px 30px rgba(212, 175, 55, 0.15); }
        .x-small { font-size: 0.7rem; }
      `}</style>
    </div>
  )
}

export default AssetsPage
