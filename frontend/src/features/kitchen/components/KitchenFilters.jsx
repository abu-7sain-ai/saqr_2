import React from 'react'
import { Filter } from 'lucide-react'

const KitchenFilters = ({ currentFilter, onFilterChange }) => {
  return (
    <div className="glass-panel p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
      <div className="d-flex align-items-center gap-2">
        <Filter size={18} className="text-secondary" />
        <span className="small fw-bold text-white">تصفية حسب حالة السوق:</span>
      </div>

      <div
        className="btn-group rounded-pill overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={() => onFilterChange('all')}
          className={`btn btn-sm px-4 ${currentFilter === 'all' ? 'btn-gold' : 'text-silver hover-bg-light'}`}
        >
          الكل
        </button>
        <button
          onClick={() => onFilterChange('stable')}
          className={`btn btn-sm px-4 ${currentFilter === 'stable' ? 'btn-gold' : 'text-silver hover-bg-light'}`}
        >
          سوق مستقر
        </button>
        <button
          onClick={() => onFilterChange('volatile')}
          className={`btn btn-sm px-4 ${currentFilter === 'volatile' ? 'btn-gold' : 'text-silver hover-bg-light'}`}
        >
          سوق متوتر
        </button>
      </div>

      <style>{`
        .hover-bg-light:hover { background: rgba(255,255,255,0.05); }
        .text-silver { color: var(--saqr-silver); }
      `}</style>
    </div>
  )
}

export default KitchenFilters
