import React from 'react'
import { Search, Filter } from 'lucide-react'

const WorkerFilters = ({ filters, onSetFilter }) => {
  return (
    <div
      className="glass-panel p-4 mb-5 border-0"
      style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '24px' }}
    >
      <div className="row g-4 align-items-center">
        <div className="col-12 col-md-6 col-lg-5">
          <div
            className="input-group glass-card border-0"
            style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '16px' }}
          >
            <span className="input-group-text bg-transparent border-0 px-4">
              <Search size={22} className="text-gold opacity-50" />
            </span>
            <input
              type="text"
              className="form-control bg-transparent border-0 text-white fw-bold py-3"
              placeholder="ابحث عن اسم أو رقم الموظف..."
              value={filters.search}
              onChange={(e) => onSetFilter('search', e.target.value)}
            />
          </div>
        </div>
        <div className="col-6 col-md-3 col-lg-3">
          <div
            className="glass-card d-flex align-items-center px-4"
            style={{ borderRadius: '16px', background: 'rgba(255,255,255,0.03)' }}
          >
            <Filter size={20} className="text-gold opacity-50 me-3" />
            <select
              className="form-select border-0 bg-transparent text-silver fw-bold py-3 fs-6"
              style={{ cursor: 'pointer' }}
              value={filters.status}
              onChange={(e) => onSetFilter('status', e.target.value)}
            >
              <option value="all" className="bg-dark">جميع الحالات</option>
              <option value="running" className="bg-dark">يعمل الآن</option>
              <option value="stopped" className="bg-dark">متوقف</option>
              <option value="paused" className="bg-dark">مؤقت</option>
            </select>
          </div>
        </div>
        <div className="col-6 col-md-3 col-lg-4 text-end">
          <div className="d-flex align-items-center justify-content-end gap-3">
            <span className="text-silver opacity-50 small fw-bold text-uppercase tracking-wider">
              فلترة الفئات:
            </span>
            <div className="d-flex gap-2">
              {['all', 'prince', 'king', 'sniper'].map((owner) => (
                <button
                  key={owner}
                  onClick={() => onSetFilter('owner', owner)}
                  className={`badge-premium fs-6 py-2 px-3 ${filters.owner === owner ? 'text-gold border-gold' : 'text-silver opacity-25 border-white border-opacity-10'}`}
                >
                  {owner === 'all'
                    ? 'الكل'
                    : owner === 'prince'
                      ? 'عادي'
                      : owner === 'king'
                        ? 'مطور'
                        : 'حقيقي'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkerFilters
