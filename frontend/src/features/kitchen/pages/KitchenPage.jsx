import React, { useEffect, useState } from 'react'
import {
  LayoutDashboard,
  ShieldCheck,
  Activity,
  Zap,
  Users,
  RefreshCcw,
  Server,
  AlertTriangle,
  CheckCircle2,
  Info,
  Utensils,
  History,
  PlayCircle,
  Target,
  TrendingUp,
  Clock,
  Terminal,
  ShieldAlert,
  Shield,
  Cpu,
  Globe,
  ArrowUpRight,
  Trash2
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { kitchenService } from '../services/kitchenService'
import MeetingModal from '../components/MeetingModal'
import SessionCard from '../components/SessionCard'
import KitchenFilters from '../components/KitchenFilters'
import MeetingSimulation from '../components/MeetingSimulation'
import CloningModal from '../../workers/components/CloningModal'
import { useKitchenStore } from '../store/useKitchenStore'
import { workerService } from '../../workers/services/workerService'
import AdvisorChat from '../components/AdvisorChat'


const KitchenPage = () => {
  const { 
    sessions, 
    fetchSessions, 
    isLoading: storeLoading, 
    createSession: storeCreateSession,
    deleteSession: storeDeleteSession,
    deleteAllSessions: storeDeleteAllSessions,
    getFilteredSessions,
    filters,
    setFilter
  } = useKitchenStore()

  const [activeTab, setActiveTab] = useState('factory')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeSession, setActiveSession] = useState(null)
  const [isAdvisorChatOpen, setIsAdvisorChatOpen] = useState(false)

  // Dashboard states
  const [snapshot, setSnapshot] = useState('')
  const [healthData, setHealthData] = useState({
    overall: 'جاري الفحص...',
    api: '...',
    db: 'Stable'
  })
  const [hrReport, setHrReport] = useState({ running: 0, total: 0, topPerformer: 'N/A' })
  const [safetyScore, setSafetyScore] = useState(0)

  // Cloning states
  const [isCloningModalOpen, setIsCloningModalOpen] = useState(false)
  const [cloningStrategy, setCloningStrategy] = useState(null)
  
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' })

  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 5000)
  }

  const fetchData = async () => {
    try {
      await fetchSessions()
      const normalizedSessions = getFilteredSessions().map((s) => ({
          ...s,
          status: s.status || s.expert_opinions?.status || 'pending',
          symbol: s.symbol || s.expert_opinions?.symbol || 'BTCUSDT'
        }))
      
      // Detect failures to show toast
      normalizedSessions.forEach(s => {
        const oldS = sessions.find(os => os.id === s.id)
        if (s.status === 'failed' && oldS && oldS.status !== 'failed') {
          showToast(`⚠️ فشل في الجلسة ${s.id.slice(0, 4)}: ${s.expert_opinions?.error || 'خطأ غير معروف'}`, 'error')
        }
      })

      const processing = normalizedSessions.find((s) => !['completed', 'failed'].includes(s.status))
      setActiveSession(processing || null)

      const { data: workers } = await supabase.from('workers').select('*')
      if (workers) {
        const running = workers.filter((w) => w.status === 'running').length
        const top = workers.length > 0
            ? workers.reduce((prev, current) => prev.total_profit_loss > current.total_profit_loss ? prev : current, workers[0])
            : null

        setHrReport({
          running,
          total: workers.length,
          topPerformer: top ? top.name : 'N/A'
        })
      }

      // Fetch real market status
      const { data: mState } = await supabase.from('market_state').select('current_type').eq('id', 1).single()
      
      // Fetch Backend Health
      let apiStatus = 'Disconnected'
      try {
        const defaultBackend = window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`
        const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || defaultBackend
        const healthResp = await fetch(`${BACKEND_URL}/health`)
        if (healthResp.ok) apiStatus = 'Connected'
      } catch (err) {
        apiStatus = 'Disconnected'
      }

      if (mState) {
        setSafetyScore(mState.current_type === 'stable' ? 92 : 45)
        setHealthData(prev => ({
          ...prev,
          overall: mState.current_type === 'stable' ? 'مستقر' : 'متوتر',
          api: apiStatus
        }))
      } else {
        setHealthData(prev => ({ ...prev, api: apiStatus }))
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
    }
  }

  useEffect(() => {
    fetchData()
    // Poll for session updates every 5 seconds
    const interval = setInterval(() => {
      fetchData()
    }, 5000)

    const openCloningHandler = (e) => {
      setCloningStrategy(e.detail.strategy)
      setIsCloningModalOpen(true)
    }
    window.addEventListener('open-cloning-modal', openCloningHandler)

    return () => {
      clearInterval(interval)
      window.removeEventListener('open-cloning-modal', openCloningHandler)
    }
  }, [])

  const handleStartSession = async (config) => {
    if (!config.symbol) {
      showToast('الرجاء التأكد من اختيار السوق والعملة أولاً قبل بدء الاجتماع.', 'error')
      return
    }

    setIsModalOpen(false)
    setLoading(true)
    try {
      // ✅ FIX: بنبعت worker_settings منفصلة عشان الـ backend يحفظها في الجلسة
      const { data, error } = await storeCreateSession({
        symbol: config.symbol,
        timeframe: config.timeframe || '4h',
        market_type: config.marketType || 'stable',
        worker_settings: {
          capital:           config.capital,
          workerType:        'paper',           // default paper حتى يتغير يدوياً
          marketType:        config.marketType || 'stable',
          tradeSizingType:   config.tradeSizingType,
          tradeSizingValue:  config.tradeSizingValue,
          maxOpenTradesType: config.maxOpenTradesType,
          maxOpenTradesValue:config.maxOpenTradesValue,
          liquidityType:     config.liquidityType,
          tpType:            config.tpType,
          tpValue:           config.tpValue,
          slType:            config.slType,
          slValue:           config.slValue,
          expiryType:        config.expiryType,
          expiryValue:       config.expiryValue,
          portfolioShareType:config.portfolioShareType,
          issuersType:       config.issuersType,
          angle:             config.angle,
          buddyId:           config.buddyId,
          baseWorkerId:      config.baseWorkerId,
          selectionCriteria: config.selectionCriteria,
          marketId:          config.marketId,
        }
      })
      if (error) throw new Error(error)

      // ✅ FIX: backend بيرجع { session_id, status } — نحوله لـ object بـ .id عشان MeetingSimulation
      const sessionObj = data?.id ? data : { ...data, id: data?.session_id }
      setActiveSession(sessionObj)
      showToast('✅ تم بدء الاجتماع العلمي بنجاح!', 'success')
      fetchData()
    } catch (err) {
      const msg = err.message || 'خطأ غير معروف'
      showToast(
        msg.includes('network') || msg.includes('timeout') || msg.includes('ECONNREFUSED')
          ? '❌ تعذّر الاتصال بالـ Backend. تأكد من تشغيله ثم حاول مجدداً.'
          : `❌ فشل بدء الاجتماع: ${msg}`,
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCloningConfirm = async (formData) => {
    setIsCloningModalOpen(false)
    setLoading(true)
    try {
      // ✅ FIX: استخدم workerService.cloneWorker() اللي بيكلم /api/v1/workers/clone
      const payload = {
        session_id: cloningStrategy?.session_id || cloningStrategy?.id || '',
        name: formData.name || cloningStrategy?.name || 'موظف جديد',
        settings: {
          ...formData,
          symbol: cloningStrategy?.symbol || 'BTC/USDT',
          workerType: formData.workerType || 'paper',
          marketType: formData.marketType || 'stable',
          capital: formData.portfolioValue || 1000,
        },
        expert_signal: {
          name:    cloningStrategy?.name,
          type:    cloningStrategy?.type,
          entry:   cloningStrategy?.entry_description,
          targets: cloningStrategy?.target_pct,
          sl:      cloningStrategy?.sl_pct,
          symbol:  cloningStrategy?.symbol || 'BTC/USDT',
        }
      }

      const result = await workerService.cloneWorker(payload)
      showToast(`✅ تم استنساخ الموظف "${result.name}" بنجاح!`, 'success')
      fetchData()
    } catch (err) {
      showToast('❌ خطأ في الاستنساخ: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (activeSession?.id === sessionId) setActiveSession(null)
    const { success, error } = await storeDeleteSession(sessionId)
    if (!success) {
      alert('فشل في حذف الجلسة: ' + error)
    }
  }

  const handleDeleteAllSessions = async () => {
    if (!window.confirm('هل أنت متأكد من مسح جميع الاجتماعات المنتهية؟')) return
    const { success, error } = await storeDeleteAllSessions()
    if (!success) {
      alert('خطأ في مسح السجل: ' + error)
    }
  }

  return (
    <div className="container-fluid p-0 animate-fade-in mb-5 bg-black min-vh-100 text-white">
      {/* Top Navigation / Header */}
      <div className="d-flex justify-content-between align-items-center mb-5 px-2">
        <div>
          <h2 className="m-0 saqr-title-premium text-gold d-flex align-items-center gap-3">
            <div className="p-3 bg-gold bg-opacity-10 rounded-4 border border-gold border-opacity-20 shadow-gold">
              <Utensils size={32} />
            </div>
            <span>اجتماع الخبراء</span>
          </h2>
          <p className="small text-secondary mt-2 opacity-50 fw-medium">
            Saqr Strategy Engine v2.0 | Pure Dark Mode
          </p>
        </div>
        <div className="d-flex gap-3 align-items-center">
          {activeSession && (
            <button
              onClick={() => {
                if (window.confirm('هل تريد فعلاً إلغاء الجلسة الحالية وبدء جلسة جديدة؟')) {
                  handleDeleteSession(activeSession.id)
                }
              }}
              className="btn btn-outline-ruby px-4 py-3 rounded-pill fw-bold"
            >
              إلغاء الجلسة الحالية
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-gold-premium px-5 py-3 rounded-pill fw-bold shadow-gold-lg"
          >
            عـقـد اجتـمـاع جـديـد
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="row g-0">
        <div className="col-12 col-lg-3 pe-lg-4 mb-4">
          <div className="d-flex flex-column gap-2 sticky-top pt-2" style={{ top: '20px' }}>
            <button
              onClick={() => setActiveTab('factory')}
              className={`side-tab ${activeTab === 'factory' ? 'active' : ''}`}
            >
              <Terminal size={18} /> مصنع الاستراتيجيات
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`side-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} /> مركز العمليات (Advisor)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`side-tab ${activeTab === 'history' ? 'active' : ''}`}
            >
              <History size={18} /> سجل الاجتماعات
            </button>

          </div>
        </div>

        <div className="col-12 col-lg-9">
          {/* CONTENT AREA */}
          {activeTab === 'factory' && (
            <div className="animate-fade-in">
              {activeSession && (
                <div className="mb-5">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="badge bg-gold text-dark p-2">جلسة نشطة حالياً</span>
                  </div>
                  <MeetingSimulation session={activeSession} onDelete={handleDeleteSession} />
                </div>
              )}

              <div className="d-flex align-items-center justify-content-between mb-4 mt-2">
                <h5 className="text-silver fw-bold m-0 d-flex align-items-center gap-2">
                  <Clock size={20} className="text-gold" /> التدفقات الحية
                </h5>
                <button
                  onClick={fetchData}
                  className="btn btn-icon p-2 text-secondary hover-gold transition-all"
                >
                  <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <KitchenFilters 
                currentFilter={filters.marketType} 
                onFilterChange={(val) => setFilter('marketType', val)} 
              />

              {getFilteredSessions().length > 0 ? (
                getFilteredSessions()
                  .filter((s) => s.status !== 'completed' || s === sessions[0])
                  .map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onDelete={handleDeleteSession}
                    />
                  ))
              ) : (
                <div className="empty-state p-5 text-center rounded-5 border border-dashed border-gold border-opacity-10">
                  <PlayCircle size={48} className="text-gold opacity-20 mb-3" />
                  <h6 className="text-secondary">لا توجد محركات تعمل الآن</h6>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="animate-fade-in">
              {/* Executive Summary Row */}
              <div className="row g-4 mb-4">
                <div className="col-12 col-md-4">
                  <div className="executive-card">
                    <div className="d-flex justify-content-between mb-3">
                      <span className="text-secondary small fw-bold">مؤشر أمان السوق</span>
                      <ShieldCheck size={16} className="text-success" />
                    </div>
                    <div className="d-flex align-items-end gap-2">
                      <div className="h1 m-0 fw-black text-success">{safetyScore}%</div>
                      <div className="mb-2 text-secondary small">درجة الثقة</div>
                    </div>
                    <div className="progress mt-3 bg-dark bg-opacity-50" style={{ height: '6px' }}>
                      <div className="progress-bar bg-success" style={{ width: '94%' }}></div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="executive-card">
                    <div className="d-flex justify-content-between mb-3">
                      <span className="text-secondary small fw-bold">القوة العاملة</span>
                      <Users size={16} className="text-gold" />
                    </div>
                    <div className="d-flex align-items-end gap-2">
                      <div className="h1 m-0 fw-black text-white">{hrReport.running}</div>
                      <div className="mb-2 text-secondary small">من أصل {hrReport.total} نشطين</div>
                    </div>
                    <div className="mt-3 small text-secondary">
                      أفضل أداء: <span className="text-gold">{hrReport.topPerformer}</span>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-md-4">
                  <div className="executive-card">
                    <div className="d-flex justify-content-between mb-3">
                      <span className="text-secondary small fw-bold">البنية التحتية</span>
                      <Server size={16} className="text-info" />
                    </div>
                    <div className="d-flex align-items-end gap-2">
                      <div className="h1 m-0 fw-black text-info">مستقرة</div>
                    </div>
                    <div className="mt-3 small text-secondary d-flex justify-content-between">
                      <span>زمن الاستجابة:</span>
                      <span className="text-info">{healthData.api}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Central Report */}
              <div className="executive-card border-gold border-opacity-10 bg-gold bg-opacity-5">
                <div className="d-flex align-items-start gap-4 p-2">
                  <div className="p-3 bg-dark bg-opacity-50 rounded-4 border border-gold border-opacity-20 text-gold shadow-sm">
                    <ShieldCheck size={32} />
                  </div>
                  <div className="flex-grow-1">
                    <h5 className="text-white fw-bold mb-2">المستشار الفني (The Advisor)</h5>
                    {snapshot ? (
                      <div className="animate-fade-in">
                        <p className="text-silver opacity-80" style={{ lineHeight: '1.8' }}>
                          {snapshot}
                        </p>
                        <button
                          onClick={() => setSnapshot('')}
                          className="btn btn-sm btn-outline-gold mt-3 small"
                        >
                          إخفاء التقرير
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-secondary small mb-3">
                          المستشار جاهز لتحليل الوضع الحالي وتقديم تقرير تنفيذي شامل.
                        </p>
                        <button
                          onClick={async () => {
                            setLoading(true)
                            const reportData = await kitchenService.getAdvisorReport()
                            setSnapshot(reportData?.report || 'لا يوجد تحليل متاح حالياً.')
                            setLoading(false)
                          }}
                          className="btn btn-gold-premium px-4 py-2 rounded-pill small fw-bold"
                        >
                          طلـب تحليـل الموقـف
                        </button>
                      </div>
                    )}
                    <div className="d-flex gap-4 mt-4">
                      <div className="d-flex align-items-center gap-2 small text-secondary">
                        <CheckCircle2 size={14} className="text-success" /> القائمة البيضاء: مفعلة
                      </div>
                      <div className="d-flex align-items-center gap-2 small text-secondary">
                        <CheckCircle2 size={14} className="text-success" /> حدود المخاطرة: مراقبة
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Insights List */}
              <div className="mt-5">
                <h6 className="text-secondary small fw-bold mb-4">توصيات سريعة:</h6>
                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <div className="p-3 rounded-4 border border-white border-opacity-5 bg-dark d-flex align-items-center gap-3">
                      <div className="p-2 rounded-3 bg-success bg-opacity-10 text-success">
                        <ArrowUpRight size={18} />
                      </div>
                      <div className="small text-secondary">
                        السوق حالياً مثالي لتجربة "استراتيجية المطور" العدوانية.
                      </div>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="p-3 rounded-4 border border-white border-opacity-5 bg-dark d-flex align-items-center gap-3">
                      <div className="p-2 rounded-3 bg-info bg-opacity-10 text-info">
                        <Info size={18} />
                      </div>
                      <div className="small text-secondary">
                        موظف رقم 4 في وضع الربح، ننصح بمراقبة أهداف الجني.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-fade-in">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="text-silver fw-bold m-0 d-flex align-items-center gap-2">
                  <History size={20} className="text-gold" /> أرشيف الاجتماعات
                </h5>
                <button
                  onClick={handleDeleteAllSessions}
                  className="btn btn-outline-ruby btn-sm px-3 rounded-pill d-flex align-items-center gap-2"
                >
                  <Trash2 size={14} /> مسح السجل
                </button>
              </div>
              
              <KitchenFilters 
                currentFilter={filters.marketType} 
                onFilterChange={(val) => setFilter('marketType', val)} 
              />

              {getFilteredSessions().map((s) => (
                <SessionCard key={s.id} session={s} onDelete={handleDeleteSession} />
              ))}
            </div>
          )}
        </div>
      </div>

      <MeetingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStart={handleStartSession}
      />

      <AdvisorChat isOpen={isAdvisorChatOpen} onClose={() => setIsAdvisorChatOpen(false)} />

      {/* Advisor Floating Toggle */}
      <button
        onClick={() => setIsAdvisorChatOpen(true)}
        className="advisor-toggle-btn shadow-gold-lg animate-fade-in"
      >
        <Shield size={24} />
        <div className="btn-badge">AI</div>
      </button>

      {/* Cloning Modal */}
      {isCloningModalOpen && (
        <CloningModal
          isOpen={isCloningModalOpen}
          onClose={() => setIsCloningModalOpen(false)}
          strategy={cloningStrategy}
          onConfirm={handleCloningConfirm}
        />
      )}

      {/* Premium Toast Notification */}
      {toast.show && (
        <div className={`premium-toast animate-slide-up ${toast.type}`}>
          <div className="d-flex align-items-center gap-3">
            <div className="toast-icon">
              {toast.type === 'error' ? <ShieldAlert size={20} /> : <Info size={20} />}
            </div>
            <div className="toast-content fw-bold small">{toast.message}</div>
            <button onClick={() => setToast({ ...toast, show: false })} className="toast-close">×</button>
          </div>
        </div>
      )}

      <style>{`
        .premium-toast {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 10000;
          background: rgba(15, 15, 15, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 16px;
          padding: 15px 25px;
          color: #fff;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 20px rgba(212, 175, 55, 0.1);
          min-width: 300px;
        }
        .premium-toast.error {
          border-color: rgba(220, 38, 38, 0.4);
          background: rgba(20, 10, 10, 0.95);
        }
        .toast-icon {
          width: 40px;
          height: 40px;
          background: rgba(212, 175, 55, 0.1);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--saqr-gold);
        }
        .error .toast-icon {
          background: rgba(220, 38, 38, 0.1);
          color: var(--saqr-ruby);
        }
        .toast-close {
          background: none;
          border: none;
          color: #666;
          font-size: 20px;
          margin-right: auto;
          padding: 0 5px;
        }
        .advisor-toggle-btn {
          position: fixed;
          bottom: 30px;
          left: 30px;
          width: 65px;
          height: 65px;
          border-radius: 20px;
          background: linear-gradient(135deg, #d4af37, #f1c40f);
          color: #000;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 1000;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 10px 30px rgba(212, 175, 55, 0.4);
        }
        .advisor-toggle-btn:hover { transform: scale(1.1) rotate(5deg); }
        .btn-badge { position: absolute; top: -5px; right: -5px; background: #000; color: #d4af37; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 8px; border: 1px solid #d4af37; }
        
        body { background-color: #000 !important; color: #fff; }
        .saqr-title-premium { font-weight: 900; letter-spacing: -2px; }
        .text-gold { color: var(--saqr-gold-bright) !important; }
        .shadow-gold { filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.3)); }
        .shadow-gold-lg { box-shadow: 0 20px 50px rgba(255, 215, 0, 0.2); }
        
        .side-tab {
           background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); width: 100%;
           padding: 20px 28px; text-align: right; color: var(--saqr-silver); font-weight: 800;
           border-radius: 20px; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
           display: flex; align-items: center; gap: 15px; text-transform: uppercase; letter-spacing: 1px;
           font-size: 0.875rem;
        }
        .side-tab:hover { background: rgba(255, 215, 0, 0.05); color: #fff; transform: translateX(-5px); border-color: rgba(255, 215, 0, 0.1); }
        .side-tab.active { 
          background: linear-gradient(90deg, var(--saqr-gold-bright), #FFF200); 
          color: #000; 
          border-color: var(--saqr-gold-bright); 
          box-shadow: 0 15px 40px rgba(255, 215, 0, 0.3);
          transform: scale(1.02);
        }
        
        .executive-card {
           background: linear-gradient(135deg, rgba(255, 255, 255, 0.05), transparent); 
           border: 1px solid rgba(255, 215, 0, 0.1);
           padding: 30px; border-radius: 28px; transition: all 0.4s;
           box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .executive-card:hover { border-color: var(--saqr-gold-bright); transform: translateY(-5px); background: rgba(255, 215, 0, 0.02); }
        
        .btn-gold-premium { 
          background: linear-gradient(90deg, var(--saqr-gold-bright), #FFF200); 
          color: #000; border: none; transition: all 0.3s;
          font-weight: 900; letter-spacing: 1px;
        }
        .btn-gold-premium:hover { transform: translateY(-3px) scale(1.05); box-shadow: 0 20px 50px rgba(255, 215, 0, 0.4); color: #000; }
        
        .pulse-led-green { width: 10px; height: 10px; background-color: var(--saqr-emerald); border-radius: 50%; box-shadow: 0 0 15px var(--saqr-emerald); animation: pulse 2s infinite; }
        .pulse-led-ruby { width: 10px; height: 10px; background-color: var(--saqr-ruby); border-radius: 50%; box-shadow: 0 0 15px var(--saqr-ruby); animation: pulse 2s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.4; transform: scale(0.8); } }
        
        .fw-black { font-weight: 900 !important; }
        .text-silver { color: #e2e8f0; }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}

export default KitchenPage