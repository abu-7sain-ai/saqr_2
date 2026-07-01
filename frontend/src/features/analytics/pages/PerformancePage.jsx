import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Zap,
  Shield,
  Cpu,
  Activity,
  Server,
  AlertCircle,
  Filter,
  Calendar,
  DollarSign,
  Percent
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../context/AuthContext'

const PerformancePage = () => {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    workerType: 'all',
    displayMode: 'both', // $, %, both
    showTrimmed: true
  })

  useEffect(() => {
    if (user) {
      fetchAnalytics()
    }
  }, [user])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1/analytics/performance?user_id=${user.id}`
      )
      const json = await resp.json()
      setData(json)
    } catch (err) {
      console.error('Analytics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading)
    return (
      <div className="d-flex flex-column align-items-center justify-content-center min-vh-50 gap-3">
        <div className="spinner-border text-accent-primary" role="status"></div>
        <div className="text-secondary small">جاري تحليل الأداء الاستراتيجي...</div>
      </div>
    )

  const summary = data?.summary || {}
  const health = data?.system_health || {}
  const tokens = data?.token_usage || {}
  const matrix = data?.monthly_matrix || { months: [], matrix: [] }

  return (
    <div className="container-fluid p-0 animate-fade-in pb-5">
      {/* 1. Header & Filters */}
      <div className="d-flex justify-content-between align-items-end mb-5 gap-4 flex-wrap">
        <div>
          <h2 className="m-0 saqr-title-premium text-accent-primary">الأداء والتحليلات</h2>
          <p className="small text-secondary mt-1">نظرة عميقة وشاملة لنتائج "الصقر" التشغيلية</p>
        </div>

        <div className="glass-panel p-3 d-flex gap-3 align-items-center flex-wrap">
          <div className="d-flex align-items-center gap-2 border-end border-white border-opacity-10 pe-3">
            <Calendar size={16} className="text-accent-primary" />
            <input
              type="date"
              className="form-control form-control-sm bg-dark border-0 text-white"
            />
            <span className="text-secondary small">إلى</span>
            <input
              type="date"
              className="form-control form-control-sm bg-dark border-0 text-white"
            />
          </div>

          <select
            className="form-select form-select-sm bg-dark border-0 text-white w-auto"
            value={filters.workerType}
            onChange={(e) => setFilters({ ...filters, workerType: e.target.value })}
          >
            <option value="all">كل الموظفين</option>
            <option value="standard">عادي</option>
            <option value="advanced">مطور</option>
            <option value="hunter">قناص</option>
          </select>

          <div className="btn-group btn-group-sm bg-dark p-1 rounded-3">
            <button
              className={`btn btn-sm ${filters.displayMode === 'dollar' ? 'btn-accent' : 'text-secondary'}`}
              onClick={() => setFilters({ ...filters, displayMode: 'dollar' })}
            >
              <DollarSign size={14} />
            </button>
            <button
              className={`btn btn-sm ${filters.displayMode === 'percent' ? 'btn-accent' : 'text-secondary'}`}
              onClick={() => setFilters({ ...filters, displayMode: 'percent' })}
            >
              <Percent size={14} />
            </button>
            <button
              className={`btn btn-sm ${filters.displayMode === 'both' ? 'btn-accent' : 'text-secondary'}`}
              onClick={() => setFilters({ ...filters, displayMode: 'both' })}
            >
              كلاهما
            </button>
          </div>
        </div>
      </div>

      {/* 1. General Summary Cards */}
      <div className="row g-4 mb-5">
        <div className="col-12 col-md-3">
          <div className="stat-card-premium">
            <div className="small text-secondary fw-bold mb-2">إجمالي الربح/الخسارة</div>
            <div
              className={`h2 fw-black m-0 ${summary.total_pl >= 0 ? 'text-emerald' : 'text-ruby'}`}
            >
              {summary.total_pl >= 0 ? '+' : ''}
              {summary.total_pl?.toFixed(2)}$
            </div>
            <div className="small opacity-50 mt-1">({summary.total_pl_pct || 0}%)</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="stat-card-premium border-emerald border-opacity-20">
            <div className="small text-secondary fw-bold mb-2">أفضل موظف أداءً</div>
            <div className="h5 text-white fw-bold m-0">{summary.best_worker?.name}</div>
            <div className="text-emerald small mt-1">+{summary.best_worker?.pl?.toFixed(2)}$</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="stat-card-premium border-ruby border-opacity-20">
            <div className="small text-secondary fw-bold mb-2">أسوأ موظف أداءً</div>
            <div className="h5 text-white fw-bold m-0">{summary.worst_worker?.name}</div>
            <div className="text-ruby small mt-1">{summary.worst_worker?.pl?.toFixed(2)}$</div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="stat-card-premium">
            <div className="small text-secondary fw-bold mb-2">إحصائيات التنفيذ</div>
            <div className="h3 text-white fw-black m-0">
              {summary.trades_count} <span className="fs-6 fw-normal text-secondary">صفقة</span>
            </div>
            <div className="text-accent-primary small mt-1">نسبة النجاح: {summary.win_rate}%</div>
          </div>
        </div>
      </div>

      {/* 2. Monthly Comparison Matrix */}
      <div className="glass-panel p-4 mb-5">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="text-white fw-bold m-0">جدول مقارنة الأشهر</h5>
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary btn-sm">آخر 3 أشهر</button>
            <button className="btn btn-outline-secondary btn-sm active">آخر 6 أشهر</button>
            <button className="btn btn-outline-secondary btn-sm">مخصص</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-dark table-hover align-middle m-0 border-0">
            <thead>
              <tr className="text-secondary small">
                <th className="border-0 bg-transparent py-3">الموظف</th>
                {matrix.months.map((m) => (
                  <th key={m} className="border-0 bg-transparent text-center">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.matrix.map((row, idx) => (
                <tr key={idx} className="border-white border-opacity-5">
                  <td className="border-0 bg-transparent fw-bold text-secondary">{row.worker_name}</td>
                  {matrix.months.map((m) => {
                    const val = row.data[m] || 0
                    return (
                      <td
                        key={m}
                        className={`border-0 bg-transparent text-center py-3 ${val > 0 ? 'text-emerald' : val < 0 ? 'text-ruby' : 'text-secondary'}`}
                      >
                        {val !== 0 &&
                          (filters.displayMode === 'dollar' || filters.displayMode === 'both') &&
                          `${val > 0 ? '+' : ''}${val}$`}
                        {val !== 0 && filters.displayMode === 'both' && <br />}
                        {val !== 0 &&
                          (filters.displayMode === 'percent' || filters.displayMode === 'both') &&
                          `+0.0%`}
                        {val === 0 && '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3 & 4. Worker Level & Trade Level */}
      <div className="row g-5 mb-5">
        <div className="col-12 col-xl-7">
          <h5 className="text-accent-primary fw-bold mb-4 d-flex align-items-center gap-2">
            <Users size={20} /> مستوى الموظفين
          </h5>
          <div className="d-flex flex-column gap-3">
            {data?.workers_detailed?.map((worker) => (
              <div key={worker.id} className="glass-card p-4 border-white border-opacity-5">
                <div className="d-flex justify-content-between mb-3 pb-3 border-bottom border-white border-opacity-5">
                  <div>
                    <div className="fw-bold text-white h6 m-0">{worker.name}</div>
                    <div className="small text-secondary">
                      {worker.status === 'running' ? '🟢 نشط' : '⚫ متوقف'} | رأس المال: $
                      {worker.starting_capital}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-emerald fw-bold">+0.00$</div>
                    <div className="extra-small text-secondary">+0.0%</div>
                  </div>
                </div>
                <div className="row g-3 text-center">
                  <div className="col-3 border-end border-white border-opacity-5">
                    <div className="extra-small text-secondary mb-1">الصفقات</div>
                    <div className="small fw-bold text-white">0</div>
                  </div>
                  <div className="col-3 border-end border-white border-opacity-5">
                    <div className="extra-small text-secondary mb-1">النجاح</div>
                    <div className="small fw-bold text-emerald">0%</div>
                  </div>
                  <div className="col-3 border-end border-white border-opacity-5">
                    <div className="extra-small text-secondary mb-1">أفضل ربح</div>
                    <div className="small fw-bold text-emerald">+$0.0</div>
                  </div>
                  <div className="col-3">
                    <div className="extra-small text-secondary mb-1">أسوأ خسارة</div>
                    <div className="small fw-bold text-ruby">-$0.0</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="col-12 col-xl-5">
          <h5 className="text-accent-primary fw-bold mb-4 d-flex align-items-center gap-2">
            <Activity size={20} /> مستوى الصفقات
          </h5>
          <div className="glass-panel p-0 overflow-hidden">
            <div className="table-responsive" style={{ maxHeight: '600px' }}>
              <table className="table table-dark table-hover align-middle m-0 border-0 small">
                <thead className="sticky-top bg-dark">
                  <tr className="text-secondary opacity-75">
                    <th className="p-3 border-0">الزوج / الموظف</th>
                    <th className="p-3 border-0">الربح/الخسارة</th>
                    <th className="p-3 border-0">المدة</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_trades?.map((trade) => (
                    <tr key={trade.id} className="border-white border-opacity-5">
                      <td className="p-3 border-0">
                        <div className="fw-bold text-white">{trade.pair}</div>
                        <div className="extra-small text-secondary opacity-75">
                          {trade.worker_name}
                        </div>
                      </td>
                      <td className="p-3 border-0">
                        <div className={trade.result >= 0 ? 'text-emerald' : 'text-ruby'}>
                          {trade.result >= 0 ? '+' : ''}
                          {trade.result}$
                        </div>
                        <div className="extra-small opacity-50">+0.0%</div>
                      </td>
                      <td className="p-3 border-0 text-secondary">
                        {trade.exit_at ? '4.2 ساعة' : 'نشطة الآن'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 6 & 7. Tokens & System Health */}
      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="glass-panel p-4 h-100">
            <h5 className="text-white fw-bold mb-4 d-flex align-items-center gap-2">
              <Zap size={20} className="text-accent-primary" /> داشبورد التوكنات
            </h5>
            <div className="d-flex flex-column gap-3">
              {Object.entries(tokens)
                .filter(([k]) => k !== 'total_cost')
                .map(([model, info]) => (
                  <div
                    key={model}
                    className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-dark bg-opacity-50"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2 bg-accent-primary bg-opacity-10 rounded-3 text-accent-primary fw-bold small">
                        {model.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-white small fw-bold">
                          {info.tokens?.toLocaleString()} توكن
                        </div>
                        <div className="extra-small text-secondary">هذا الشهر</div>
                      </div>
                    </div>
                    <div className="text-accent-primary fw-bold">${info.cost?.toFixed(2)}</div>
                  </div>
                ))}
              <div className="mt-2 pt-3 border-top border-white border-opacity-10 d-flex justify-content-between align-items-center">
                <span className="text-secondary fw-bold">الإجمالي التقديري</span>
                <span className="h4 text-accent-primary fw-black m-0">${tokens.total_cost?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-6">
          <div
            className="glass-panel p-4 h-100 border-gold border-opacity-10"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.05) 0%, transparent 100%)'
            }}
          >
            <h5 className="text-white fw-bold mb-4 d-flex align-items-center gap-2">
              <Server size={20} className="text-info" /> صحة المنظومة (System Health)
            </h5>
            <div className="row g-4 mb-4">
              <div className="col-6">
                <div className="p-3 rounded-4 bg-dark bg-opacity-50 text-center">
                  <div className="extra-small text-secondary mb-2">CPU Usage</div>
                  <div
                    className={`h4 fw-black ${health.cpu_usage > 80 ? 'text-ruby' : 'text-info'}`}
                  >
                    {health.cpu_usage}%
                  </div>
                  <div className="progress mt-2 bg-black" style={{ height: '4px' }}>
                    <div
                      className={`progress-bar ${health.cpu_usage > 80 ? 'bg-ruby' : 'bg-info'}`}
                      style={{ width: `${health.cpu_usage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="col-6">
                <div className="p-3 rounded-4 bg-dark bg-opacity-50 text-center">
                  <div className="extra-small text-secondary mb-2">RAM Usage</div>
                  <div
                    className={`h4 fw-black ${health.ram_usage > 85 ? 'text-ruby' : 'text-info'}`}
                  >
                    {health.ram_usage}%
                  </div>
                  <div className="progress mt-2 bg-black" style={{ height: '4px' }}>
                    <div
                      className={`progress-bar ${health.ram_usage > 85 ? 'bg-ruby' : 'bg-info'}`}
                      style={{ width: `${health.ram_usage}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex flex-column gap-2">
              <div className="d-flex justify-content-between small px-2">
                <span className="text-secondary">موظفون نشطون الآن:</span>
                <span className="text-white fw-bold">{health.active_workers}</span>
              </div>
              <div className="d-flex justify-content-between small px-2">
                <span className="text-secondary">Network Load:</span>
                <span className="text-white fw-bold">{health.network_load}%</span>
              </div>
              <div className="mt-3 p-3 rounded-3 bg-ruby bg-opacity-10 border border-ruby border-opacity-20 text-ruby small d-flex align-items-center gap-2">
                <AlertCircle size={16} /> تنبيهات السيرفر مفعلة عبر تليجرام
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .stat-card-premium {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          padding: 24px;
          border-radius: 24px;
          height: 100%;
          transition: all 0.3s;
        }
        .stat-card-premium:hover { transform: translateY(-5px); background: rgba(255, 255, 255, 0.05); }
        .fw-black { font-weight: 900 !important; }
        .text-emerald { color: #10b981 !important; }
        .text-ruby { color: #ef4444 !important; }
        .extra-small { font-size: 0.7rem; }
        .tracking-wide { letter-spacing: 1px; }
      `}</style>
    </div>
  )
}

export default PerformancePage
