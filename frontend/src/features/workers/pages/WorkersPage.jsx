import React, { useEffect } from 'react'
import { Plus, Search, Filter, RefreshCcw, Trash2 } from 'lucide-react'
import { useWorkerStore } from '../store/useWorkerStore'
import WorkerCard from '../components/WorkerCard'
import WorkerFilters from '../components/WorkerFilters'
import LiquidationModal from '../components/LiquidationModal'
import CloningModal from '../components/CloningModal'
import { workerService } from '../services/workerService'

const WorkersPage = () => {
  const {
    workers,
    fetchWorkers,
    getFilteredWorkers,
    loading,
    error,
    filters,
    setFilter,
    updateStatus,
    deleteAllStoppedWorkers
  } = useWorkerStore()

  useEffect(() => {
    fetchWorkers()
    const subscription = workerService.subscribeToWorkers(
      useWorkerStore.getState().handleRealtimeUpdate
    )
    return () => {
      subscription?.unsubscribe()
    }
  }, [fetchWorkers])

  const [activeWorkerForWithdraw, setActiveWorkerForWithdraw] = React.useState(null)
  const [activeWorkerForClone, setActiveWorkerForClone] = React.useState(null)
  const [selectedWorker, setSelectedWorker] = React.useState(null)

  const handleWithdrawConfirm = async (workerId, amount, mode) => {
    try {
      await useWorkerStore.getState().requestLiquidation(workerId, amount, mode)
      setActiveWorkerForWithdraw(null)
      fetchWorkers()
      alert('تم استلام طلب التسييل بنجاح وسيتم التنفيذ تدريجياً مع إغلاق الصفقات.')
    } catch (e) {
      alert('خطأ أثناء طلب الاستقطاع: ' + e.message)
    }
  }

  const handleCloneConfirm = async (config) => {
    try {
      await workerService.cloneWorker(config)
      setActiveWorkerForClone(null)
      fetchWorkers()
      alert(
        `تم استنساخ الموظف بنجاح! النسخة الجديد تحمل اسم "${config.name}" وهي في وضع التوقف حالياً.`
      )
    } catch (e) {
      alert('خطأ أثناء الاستنساخ: ' + e.message)
    }
  }

  const filteredWorkers = getFilteredWorkers()

  return (
    <div className="container-fluid p-0 animate-fade-in" style={{ background: 'transparent' }}>
      <div className="d-flex justify-content-between align-items-end mb-5 flex-wrap gap-4">
        <div>
          <h1 className="m-0 text-accent-primary fw-black">إدارة الموظفين</h1>
          <p className="text-secondary fs-5 opacity-75 fw-medium mt-2">
            تحكم كامل في أسطول روبوتات التداول الذكية الخاصة بك
          </p>
        </div>
        <div className="d-flex gap-3">
          <button
            onClick={fetchWorkers}
            className="btn btn-outline-accent px-4 py-3 rounded-4 d-flex align-items-center gap-3"
          >
            <RefreshCcw size={20} className={loading ? 'spin' : ''} /> تحديث القائمة
          </button>
          <button
            onClick={() => {
              if (window.confirm('هل أنت متأكد من حذف جميع الموظفين المتوقفين؟ لا يمكن التراجع!')) {
                deleteAllStoppedWorkers()
              }
            }}
            className="btn btn-outline-ruby px-4 py-3 rounded-4 d-flex align-items-center gap-3"
          >
            <Trash2 size={20} /> مسح المتوقفين
          </button>
        </div>
      </div>

      <WorkerFilters filters={filters} onSetFilter={setFilter} />

      {error && (
        <div className="alert alert-danger bg-danger bg-opacity-10 border-danger text-danger">
          خطأ في جلب البيانات: {error}
        </div>
      )}

      {loading && filteredWorkers.length === 0 ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-accent-primary" role="status">
            <span className="visually-hidden">جاري التحميل...</span>
          </div>
        </div>
      ) : (
        <div className="row g-4">
          {filteredWorkers.map((worker) => (
            <div key={worker.id} className="col-12 col-md-6 col-xl-4">
              <WorkerCard
                worker={worker}
                onToggleStatus={updateStatus}
                onOpenWithdraw={setActiveWorkerForWithdraw}
                onOpenClone={setActiveWorkerForClone}
                onDelete={useWorkerStore.getState().deleteWorker}
                onPromote={useWorkerStore.getState().promoteWorker}
                onViewDetail={setSelectedWorker}
              />
            </div>
          ))}

          {!loading && filteredWorkers.length === 0 && (
            <div className="col-12 text-center py-5">
              <div className="text-secondary mb-3 small">لا يوجد موظفين يطابقون البحث</div>
              <button
                onClick={() => {
                  setFilter('search', '')
                  setFilter('status', 'all')
                  setFilter('owner', 'all')
                }}
                className="btn btn-link text-accent-primary text-decoration-none"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          )}
        </div>
      )}

      <LiquidationModal
        show={!!activeWorkerForWithdraw}
        onHide={() => setActiveWorkerForWithdraw(null)}
        worker={activeWorkerForWithdraw}
      />

      <CloningModal
        isOpen={!!activeWorkerForClone}
        onClose={() => setActiveWorkerForClone(null)}
        strategy={activeWorkerForClone}
        onConfirm={handleCloneConfirm}
      />

      <style>{`
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hover-translate-y:hover { transform: translateY(-5px); }
        .transition-all { transition: all 0.3s ease; }
      `}</style>

      {selectedWorker && (
        <div
          className="modal d-block"
          style={{ background: 'rgba(0,0,0,0.75)', zIndex: 9999 }}
          onClick={() => setSelectedWorker(null)}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content bg-dark text-white border-secondary">
              <div className="modal-header border-secondary">
                <h6 className="modal-title fw-bold">📋 سجل الموظف: {selectedWorker.name}</h6>
                <button className="btn-close btn-close-white" onClick={() => setSelectedWorker(null)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">الحالة</div>
                      <div className={`fw-bold ${selectedWorker.status === 'running' ? 'text-success' : 'text-warning'}`}>
                        {selectedWorker.status === 'running' ? '🟢 يعمل' : '🟡 موقوف'}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">النوع</div>
                      <div className="fw-bold">{selectedWorker.type === 'paper' ? '📝 تجريبي' : '💰 حقيقي'}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">رأس المال الأولي</div>
                      <div className="fw-bold text-accent-primary">${parseFloat(selectedWorker.starting_capital || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">رأس المال الحالي</div>
                      <div className="fw-bold text-accent-primary">${parseFloat(selectedWorker.current_capital || 0).toFixed(2)}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">إجمالي الربح/الخسارة</div>
                      <div className={`fw-bold ${parseFloat(selectedWorker.total_profit_loss) >= 0 ? 'text-success' : 'text-danger'}`}>
                        ${parseFloat(selectedWorker.total_profit_loss || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">نوع السوق</div>
                      <div className="fw-bold">{selectedWorker.market_type === 'stable' ? '🟦 مستقر' : '🟥 متوتر'}</div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">الاستراتيجية</div>
                      <div className="small">{selectedWorker.user_settings?.expert_signal?.entry_description || 'لا يوجد وصف'}</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">هدف الربح</div>
                      <div className="fw-bold text-success">{selectedWorker.user_settings?.expert_signal?.target_pct || selectedWorker.user_settings?.tpValue || '-'}%</div>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">وقف الخسارة</div>
                      <div className="fw-bold text-danger">{selectedWorker.user_settings?.expert_signal?.sl_pct || selectedWorker.user_settings?.slValue || '-'}%</div>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="glass-card p-3">
                      <div className="small text-secondary mb-1">تاريخ الإنشاء</div>
                      <div className="small">{new Date(selectedWorker.created_at).toLocaleString('ar-EG')}</div>
                    </div>
                  </div>
                  {selectedWorker.last_run_at && (
                    <div className="col-12">
                      <div className="glass-card p-3">
                        <div className="small text-secondary mb-1">آخر تشغيل</div>
                        <div className="small">{new Date(selectedWorker.last_run_at).toLocaleString('ar-EG')}</div>
                      </div>
                    </div>
                  )}

                  {/* ── تفاصيل الحساب المالي ── */}
                  <div className="col-12">
                    <div className="glass-card p-3" style={{ border: '1px solid rgba(212,175,55,0.2)' }}>
                      <div className="small fw-bold mb-3" style={{ color: '#d4af37' }}>
                        💰 تفاصيل الحساب المالي
                      </div>
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">رأس المال الأولي</div>
                            <div className="small fw-bold" style={{ color: '#d4af37' }}>
                              ${parseFloat(selectedWorker.starting_capital || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">رأس المال الحالي</div>
                            <div className="small fw-bold" style={{ color: '#d4af37' }}>
                              ${parseFloat(selectedWorker.current_capital || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">إجمالي الربح/الخسارة</div>
                            <div className={`small fw-bold ${parseFloat(selectedWorker.total_profit_loss || 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                              {parseFloat(selectedWorker.total_profit_loss || 0) >= 0 ? '+' : ''}
                              ${parseFloat(selectedWorker.total_profit_loss || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">نسبة العائد الإجمالي</div>
                            {(() => {
                              const start = parseFloat(selectedWorker.starting_capital || 0)
                              const pl = parseFloat(selectedWorker.total_profit_loss || 0)
                              const pct = start > 0 ? ((pl / start) * 100).toFixed(2) : '0.00'
                              return (
                                <div className={`small fw-bold ${pl >= 0 ? 'text-success' : 'text-danger'}`}>
                                  {pl >= 0 ? '+' : ''}{pct}%
                                </div>
                              )
                            })()}
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">المبلغ المحرر</div>
                            <div className="small fw-bold text-white">
                              ${parseFloat(selectedWorker.released_amount || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">نوع الحساب</div>
                            <div className="small fw-bold text-white">
                              {selectedWorker.type === 'paper' ? '📝 تجريبي (Paper)' : '💰 حقيقي (Live)'}
                            </div>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="p-2 rounded-3" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="extra-small text-secondary mb-1">آلية التسييل</div>
                            <div className="small fw-bold text-white">
                              {selectedWorker.user_settings?.liquidationMode === 'aggressive'
                                ? '⚡ عدوانية (Aggressive)'
                                : selectedWorker.user_settings?.liquidationMode === 'profit_only'
                                ? '💸 الأرباح فقط (Profit Only)'
                                : '-'}
                            </div>
                          </div>
                        </div>
                        {selectedWorker.pending_withdrawal && parseFloat(selectedWorker.pending_withdrawal) > 0 && (() => {
                          const target = parseFloat(selectedWorker.pending_withdrawal)
                          const withdrawn = parseFloat(selectedWorker.released_amount || 0)
                          const pct = Math.min((withdrawn / target) * 100, 100).toFixed(1)
                          return (
                            <div className="col-12">
                              <div className="p-3 rounded-3" style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)' }}>
                                <div className="d-flex justify-content-between mb-2">
                                  <div className="extra-small fw-bold" style={{ color: '#d4af37' }}>طلب سحب معلق</div>
                                  <div className="extra-small text-white fw-bold">{pct}%</div>
                                </div>
                                <div className="progress mb-2" style={{ height: 8, background: 'rgba(255,255,255,0.08)' }}>
                                  <div
                                    className="progress-bar"
                                    style={{ width: `${pct}%`, background: '#d4af37', borderRadius: 4 }}
                                  />
                                </div>
                                <div className="d-flex justify-content-between extra-small text-secondary">
                                  <span>محرر: <span className="text-white">${withdrawn.toFixed(2)}</span></span>
                                  <span>المستهدف: <span className="text-white">${target.toFixed(2)}</span></span>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkersPage