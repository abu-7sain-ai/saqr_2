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
    // ✅ FIX: subscribe للـ realtime عشان الموظفين الجدد يظهروا تلقائياً
    const subscription = workerService.subscribeToWorkers(
      useWorkerStore.getState().handleRealtimeUpdate
    )
    return () => {
      subscription?.unsubscribe()
    }
  }, [fetchWorkers])

  const [activeWorkerForWithdraw, setActiveWorkerForWithdraw] = React.useState(null)
  const [activeWorkerForClone, setActiveWorkerForClone] = React.useState(null)

  const handleWithdrawConfirm = async (workerId, amount, mode) => {
    try {
      await useWorkerStore.getState().requestLiquidation(workerId, amount, mode)
      setActiveWorkerForWithdraw(null)
      fetchWorkers() // Refresh data
      alert('تم استلام طلب التسييل بنجاح وسيتم التنفيذ تدريجياً مع إغلاق الصفقات.')
    } catch (e) {
      alert('خطأ أثناء طلب الاستقطاع: ' + e.message)
    }
  }

  const handleCloneConfirm = async (config) => {
    try {
      await workerService.cloneWorker(config) // Fixed payload passing
      setActiveWorkerForClone(null)
      fetchWorkers() // Refresh data
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
    </div>
  )
}

export default WorkersPage
