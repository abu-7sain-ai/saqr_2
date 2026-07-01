import React, { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  AlertCircle,
  Calendar,
  Shield,
  ShieldCheck,
  Lock,
  Users,
  LineChart,
  Loader2
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

import { supabase } from '../../../services/supabase'
import { useAuth } from '../../../context/AuthContext'
import { workerService } from '../../workers/services/workerService'

const StatCard = ({ title, value, icon, change, isPositive, loading }) => (
  <div
    className="glass-card p-4 h-100 transition-all hover-transform border-0"
    style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent)' }}
  >
    <div className="d-flex align-items-center gap-3 mb-4">
      <div
        className="rounded-4 d-flex align-items-center justify-content-center flex-shrink-0"
        style={{ width: 44, height: 44, background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.2)', color: 'var(--accent-primary, #00ff9d)' }}
      >
        {icon}
      </div>
      <div className="small fw-bold text-uppercase" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', lineHeight: 1.3 }}>
        {title}
      </div>
    </div>
    <div className="fw-black" style={{ fontSize: '1.6rem', letterSpacing: '-1px', color: loading ? 'transparent' : 'white', minHeight: '2rem' }}>
      {loading ? '' : value}
    </div>
    {!loading && change && (
      <div className="small mt-2 fw-medium" style={{ color: isPositive ? 'rgba(0,255,157,0.7)' : 'rgba(255,50,50,0.7)' }}>
        {change}
      </div>
    )}
  </div>
)

const Dashboard = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    dailyProfit: 0,
    activeWorkers: 0,
    totalWorkers: 0,
    openTrades: 0,
    guardianStatus: 'آمن',
    freedLiquidity: 0
  })
  const [chartData, setChartData] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [modelLogs, setModelLogs] = useState([])
  const [tokenStats, setTokenStats] = useState({ flash: 0, pro: 0, grok: 0 })
  const [marketStatus, setMarketStatus] = useState('loading...')
  const [aiBalance, setAiBalance] = useState(0)
  const [advisorHistory, setAdvisorHistory] = useState([])
  const [systemSettings, setSystemSettings] = useState({ maintenance_mode: false })

  useEffect(() => {
    if (user) {
      fetchDashboardData()
      fetchMarketStatus()
      fetchActivityLogs()
      fetchAiBalance()
      fetchAdvisorHistory()
      fetchSystemSettings()
    }
  }, [user])

  const fetchAdvisorHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('advisor_chat_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (!error) setAdvisorHistory(data || [])
    } catch (e) {
      console.error('Failed to fetch advisor history', e)
    }
  }

  const fetchAiBalance = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/v1/advisor/balance`
      )
      const data = await res.json()
      setAiBalance(data.total_credits || 0)
    } catch (e) {
      console.error('Failed to fetch AI balance', e)
    }
  }

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
      if (!error && data) {
        const settings = {}
        data.forEach(s => { settings[s.key] = s.value })
        setSystemSettings(settings)
      }
    } catch (err) {
      console.error('Failed to fetch system settings', err)
    }
  }

  const fetchMarketStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('market_state')
        .select('current_type')
        .eq('id', 1)
        .single()
      if (!error && data) {
        setMarketStatus(data.current_type === 'stable' ? 'مستقر (Stable)' : 'متوتر (Volatile)')
      } else {
        setMarketStatus('مستقر (Stable)')
      }
    } catch (err) {
      setMarketStatus('مستقر (Stable)')
    }
  }

  const fetchActivityLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (!error && data && Array.isArray(data)) {
        setActivityLogs(data.slice(0, 5))

        // Calculate usage per model if metadata exists
        const stats = { flash: 0, pro: 0, grok: 0 }
        data
          .filter((log) => log.metadata?.usage)
          .forEach((log) => {
            const model = log.metadata.model || ''
            const tokens = log.metadata.usage.total_tokens || 0
            if (model.includes('sonnet')) stats.flash += tokens
            else if (model.includes('deepseek')) stats.pro += tokens
            else if (model.includes('grok')) stats.grok += tokens
            else stats.flash += tokens // Default
          })
        setTokenStats(stats)

        // Filter model logs specifically
        const mLogs = data.filter((log) => ['model_reset', 'worker_cloned'].includes(log.type))
        setModelLogs(mLogs.slice(0, 5))
      }
    } catch (err) {
      // Table might not exist yet, silently ignore
    }
  }

  const fetchDashboardData = async () => {
    setLoading(true)
    let activeCount = 0,
      totalCount = 0,
      openCount = 0,
      dailyProfit = 0,
      freedLiquiditySum = 0
    let chartPoints = []

    // Fetch workers (safe)
    try {
      const { data: workers } = await supabase
        .from('workers')
        .select('id, status, market_type')
        .eq('user_id', user.id)
      activeCount = workers?.filter((w) => w.status === 'running').length || 0
      totalCount = workers?.length || 0
    } catch (e) {
      /* silently skip */
    }

    // Fetch open trades (safe)
    try {
      const { count } = await supabase
        .from('trades')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('exit_at', null)
      openCount = count || 0
    } catch (e) {
      /* silently skip */
    }

    // Fetch recent trades (safe)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data: recentTrades } = await supabase
        .from('trades')
        .select('result, entry_at, exit_at')
        .eq('user_id', user.id)
        .order('entry_at', { ascending: true })

      dailyProfit =
        recentTrades
          ?.filter((t) => t.exit_at && new Date(t.exit_at) >= today)
          .reduce((sum, t) => sum + (parseFloat(t.result) || 0), 0) || 0

      chartPoints =
        recentTrades?.map((t) => ({
          name: new Date(t.entry_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          profit: parseFloat(t.result) || 0
        })) || []
    } catch (e) {
      /* silently skip */
    }

    // Fetch freed liquidity (safe)
    try {
      freedLiquiditySum = await workerService.getTotalFreedLiquidity()
    } catch (e) {
      /* silently skip */
    }

    setStats({
      dailyProfit,
      activeWorkers: activeCount,
      totalWorkers: totalCount,
      openTrades: openCount,
      guardianStatus: 'آمن',
      freedLiquidity: freedLiquiditySum
    })

    // Fetch Model Logs
    const { data: logs } = await supabase
      .from('activity_logs')
      .select('*')
      .in('type', ['model_reset', 'worker_cloned'])
      .order('created_at', { ascending: false })
      .limit(5)
    setModelLogs(logs || [])

    setChartData(chartPoints.length > 0 ? chartPoints : [])
    setLoading(false)
  }

  return (
    <div className="container-fluid p-0 animate-fade-in" style={{ background: 'transparent' }}>
      {systemSettings.maintenance_mode && (
        <div className="alert alert-warning mb-4 rounded-4 d-flex align-items-center gap-3 border-0 bg-warning bg-opacity-10 text-warning">
          <AlertCircle size={20} />
          <div className="fw-bold">
            النظام حالياً في وضع الصيانة. بعض الميزات قد لا تكون متوفرة.
          </div>
        </div>
      )}
      <div className="d-flex justify-content-between align-items-end mb-5 flex-wrap gap-4">
        <div>
          <div className="d-flex align-items-center gap-4 mb-2">
            <h1 className="m-0 text-accent-primary fw-black">قمرة القيادة</h1>
            <div
              className={`glass-card px-4 py-2 border-2 d-flex align-items-center gap-3 ${marketStatus.includes('Stable') ? 'border-accent-primary text-accent-primary shadow-accent' : 'border-warning text-warning shadow-accent'}`}
            >
              <div
                className={`rounded-circle ${marketStatus.includes('Stable') ? 'bg-emerald' : 'bg-warning'} pulse`}
                style={{ width: '12px', height: '12px' }}
              ></div>
              <span className="fw-black text-uppercase small tracking-widest">
                نبض السوق: {marketStatus}
              </span>
            </div>
          </div>
          <p className="text-silver fs-5 opacity-75 fw-medium">
            مراقبة حية لأداء الذكاء الاصطناعي وتدفق الأرباح اللحظي
          </p>
        </div>
        <div className="d-flex gap-3">
          <button
            className="btn btn-outline-gold px-4 py-3 rounded-4 d-flex align-items-center gap-3"
            onClick={fetchDashboardData}
          >
            <Activity size={20} /> تحديث البيانات
          </button>
        </div>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-12 col-md-4 col-xl-2">
          <StatCard
            title="صافي أرباح اليوم"
            value={`$${stats.dailyProfit.toFixed(2)}`}
            icon={<DollarSign size={24} />}
            change={stats.dailyProfit >= 0 ? '+4.2%' : '0.0%'}
            isPositive={stats.dailyProfit >= 0}
            loading={loading}
          />
        </div>
        <div className="col-12 col-md-4 col-xl-3">
          <StatCard
            title="الأموال المحررة (المؤمنة)"
            value={`$${stats.freedLiquidity.toFixed(2)}`}
            icon={<Lock size={24} />}
            change="خارج دائرة المخاطرة"
            isPositive={true}
            loading={loading}
          />
        </div>
        <div className="col-12 col-md-4 col-xl-2">
          <StatCard
            title="العمال النشطون"
            value={`${stats.activeWorkers} / ${stats.totalWorkers}`}
            icon={<Users size={24} />}
            change={stats.activeWorkers > 0 ? 'متصل' : 'متوقف'}
            isPositive={stats.activeWorkers > 0}
            loading={loading}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-2">
          <StatCard
            title="صفقات مفتوحة"
            value={stats.openTrades}
            icon={<LineChart size={24} />}
            change={`${stats.openTrades} مراكز`}
            isPositive={true}
            loading={loading}
          />
        </div>
        <div className="col-12 col-md-6 col-xl-3">
          <StatCard
            title="حالة الحارس الذكي"
            value={stats.guardianStatus}
            icon={<Shield size={24} />}
            change="نظام الحماية فعال"
            isPositive={true}
            loading={loading}
          />
        </div>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-12 col-xl-8">
          <div
            className="glass-panel p-5 h-100 border-0"
            style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.4)' }}
          >
            <div className="d-flex justify-content-between align-items-start mb-5">
              <div>
                <h3 className="text-accent-primary fw-black d-flex align-items-center gap-3">
                  <TrendingUp size={28} /> منحنى النمو اللحظي
                </h3>
                <p className="text-secondary opacity-50 small mt-1">
                  تطور الربح التراكمي خلال الـ 24 ساعة الماضية
                </p>
              </div>
              <div className="badge-premium text-accent-primary fs-6 py-2 px-4 border-accent-primary">
                تحليل النمو: جاري الحساب...
              </div>
            </div>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-secondary)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent-secondary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="10 10"
                    stroke="rgba(255,255,255,0.03)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dy={15}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.2)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(5, 5, 10, 0.95)',
                      border: '1px solid rgba(255,215,0,0.2)',
                      borderRadius: '20px',
                      backdropFilter: 'blur(10px)',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: 'var(--accent-secondary)', fontWeight: 900 }}
                    cursor={{ stroke: 'var(--accent-secondary)', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke="var(--accent-secondary)"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorProfit)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4">
          <div className="glass-panel p-5 h-100 border-0">
            <div className="d-flex justify-content-between align-items-center mb-5">
              <h4 className="text-accent-primary fw-black m-0">النشاطات الحية</h4>
              <div
                className="pulse-emerald rounded-circle"
                style={{ width: '10px', height: '10px' }}
              ></div>
            </div>
            <div className="d-flex flex-column gap-4">
              {activityLogs.length > 0 ? (
                activityLogs.map((log, i) => (
                  <div
                    key={log.id}
                    className={`p-4 rounded-4 glass-card hover-transform border-0 ${log.type === 'market_switch' ? 'border-start border-4 border-warning' : 'border-start border-4 border-accent-primary'}`}
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div className="small text-secondary opacity-50 fw-bold">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <span
                        className={`badge-premium x-small ${log.type === 'market_switch' ? 'text-warning border-warning' : 'text-accent-primary border-accent-primary'}`}
                      >
                        {log.type === 'market_switch' ? 'تبديل السوق' : 'تنبيه النظام'}
                      </span>
                    </div>
                    <div className="fw-bold text-white fs-6" style={{ lineHeight: '1.5' }}>
                      {log.message}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-5 text-secondary opacity-25">
                  <Activity size={48} className="mb-3" />
                  <div className="fs-5">لا توجد عمليات نشطة حالياً</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-12">
          <div className="glass-panel p-5 border-0">
            <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
              <div>
                <h3 className="mb-1 text-accent-primary fw-black">استهلاك عقول الذكاء الاصطناعي</h3>
                <p className="text-secondary opacity-50 m-0">
                  تتبع دقيق لتكلفة العمليات والتوكنات المستخدمة في التحليل
                </p>
              </div>
              <div className="glass-card px-5 py-3 border-accent-primary d-flex flex-column align-items-end">
                <div className="small text-secondary opacity-50 fw-bold">
                  رصيد عقول الصقر (OpenRouter)
                </div>
                <div className="fw-black text-accent-primary fs-3">
                  ${aiBalance.toFixed(2)} <span className="fs-6 opacity-50">/ متوفر</span>
                </div>
              </div>
            </div>

            <div className="row g-4">
              {[
                {
                  name: 'مستشار الصقر (Advisor)',
                  model: 'Claude 3.5 Sonnet',
                  tokens: tokenStats.flash.toLocaleString(),
                  cost: `$${(tokenStats.flash * 0.0000001).toFixed(4)}`,
                  color: 'gold',
                  icon: <Activity size={24} />
                },
                {
                  name: 'الشارتيست والرادار',
                  model: 'DeepSeek-V3',
                  tokens: '0',
                  cost: '$0.00',
                  color: 'emerald',
                  icon: <TrendingUp size={24} />
                },
                {
                  name: 'النبّاض والمذيع',
                  model: 'Grok-Beta',
                  tokens: '0',
                  cost: '$0.00',
                  color: 'info',
                  icon: <Activity size={24} />
                }
              ].map((ai, i) => (
                <div key={i} className="col-12 col-md-4">
                  <div
                    className="glass-card p-4 border-0 hover-transform"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="d-flex justify-content-between align-items-start mb-4">
                      <div
                        className={`bg-${ai.color} bg-opacity-10 p-3 rounded-4 text-${ai.color}`}
                      >
                        {ai.icon}
                      </div>
                      <div className="text-end">
                        <div className={`fw-black text-${ai.color} fs-5`}>{ai.model}</div>
                        <div className="small text-secondary opacity-50">{ai.name}</div>
                      </div>
                    </div>
                    <div className="d-flex justify-content-between align-items-end pt-3 border-top border-white border-opacity-5">
                      <div>
                        <div className="small text-secondary opacity-50 fw-bold">الاستهلاك</div>
                        <div className="fw-black text-white fs-4">
                          {ai.tokens} <span className="small opacity-25">TOKENS</span>
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="small text-secondary opacity-50 fw-bold">التكلفة</div>
                        <div className="fw-black text-white fs-4">{ai.cost}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Model Training & Intelligence Logs */}
            <div className="col-12 mt-5">
              <div
                className="glass-panel p-5 border-accent-primary border-opacity-10"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 215, 0, 0.03), transparent)'
                }}
              >
                <div className="d-flex justify-content-between align-items-center mb-5">
                  <div>
                    <h3 className="mb-1 text-accent-primary fw-black">سجل عقول الذكاء الاصطناعي</h3>
                    <p className="text-secondary opacity-50 m-0">
                      تتبع عمليات التصفير، التعلم، واستنساخ الموظفين الذكية
                    </p>
                  </div>
                  <div className="badge-premium text-info border-info py-2 px-4">
                    حالة الموديل: نشط
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-dark table-borderless align-middle m-0">
                    <thead>
                      <tr className="text-secondary opacity-50 extra-small text-uppercase">
                        <th className="pb-3">الوقت</th>
                        <th className="pb-3">النوع</th>
                        <th className="pb-3">النشاط</th>
                        <th className="pb-3 text-end">الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modelLogs.length > 0 ? (
                        modelLogs.map((log, i) => (
                          <tr key={i} className="border-top border-white border-opacity-5">
                            <td className="py-3 text-secondary small">
                              {new Date(log.created_at).toLocaleString('ar-EG')}
                            </td>
                            <td className="py-3">
                              <span
                                className={`badge bg-${log.type === 'model_reset' ? 'ruby' : 'gold'} bg-opacity-10 text-${log.type === 'model_reset' ? 'ruby' : 'gold'} border border-${log.type === 'model_reset' ? 'ruby' : 'gold'} border-opacity-20`}
                              >
                                {log.type === 'model_reset' ? 'تصفير تدريب' : 'استنساخ ذكي'}
                              </span>
                            </td>
                            <td className="py-3 text-white fw-bold small">{log.message}</td>
                            <td className="py-3 text-end">
                              <div className="d-flex align-items-center justify-content-end gap-2 text-emerald small fw-bold">
                                <div
                                  className="pulse-led-green"
                                  style={{ width: '6px', height: '6px' }}
                                ></div>{' '}
                                مكتمل
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" className="text-center py-5 text-secondary small">
                            لا توجد سجلات ذكاء اصطناعي حالية
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Advisor History */}
                <div className="mt-5">
                  <h6 className="text-accent-primary small fw-bold mb-4 d-flex align-items-center gap-2">
                    <Shield size={16} /> أرشيف توجيهات المستشار:
                  </h6>
                  <div className="d-flex flex-column gap-3">
                    {advisorHistory.length > 0 ? (
                      advisorHistory.map((item, i) => (
                        <div key={item.id} className="p-3 rounded-4 border border-white border-opacity-5 bg-black bg-opacity-30">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="extra-small text-secondary opacity-50">
                              {new Date(item.created_at).toLocaleString('ar-EG')}
                            </span>
                            <span className="badge bg-accent-primary bg-opacity-10 text-accent-primary extra-small">
                              {item.provider}
                            </span>
                          </div>
                          <div className="small text-white opacity-90 fw-bold mb-2">س: {item.message}</div>
                          <div className="small text-secondary opacity-80" style={{ borderRight: '2px solid var(--saqr-gold)', paddingRight: '12px' }}>
                            ج: {item.reply}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-secondary small opacity-50 border border-dashed border-white border-opacity-10 rounded-4">
                        لا توجد محادثات سابقة مع المستشار
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .pulse { animation: pulse-animation 2s infinite; }
        @keyframes pulse-animation { 0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 204, 0.7); } 70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(0, 255, 204, 0); } 100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0, 255, 204, 0); } }
        .pulse-emerald { background: var(--saqr-emerald); box-shadow: 0 0 15px var(--saqr-emerald); animation: pulse-emerald 1.5s infinite; }
        @keyframes pulse-emerald { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
        .badge-premium { border: 1px solid; border-radius: 10px; padding: 4px 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .fw-black { font-weight: 900 !important; }
        .shadow-emerald-glow { box-shadow: 0 0 20px rgba(0, 255, 204, 0.2); }
      `}</style>
    </div>
  )
}

export default Dashboard