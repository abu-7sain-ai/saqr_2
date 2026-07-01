import React, { useEffect, useState, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Search,
  RefreshCw,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  Wifi,
  Settings,
  Eye,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  TrendingUp,
  Globe
} from 'lucide-react'
import { supabase } from '../../../services/supabase'
import { kitchenService } from '../../kitchen/services/kitchenService'

// ─── Market type config ───────────────────────────────────────
const MARKET_TYPES = [
  { value: 'crypto', label: 'كريبتو', icon: '₿', color: '#FFD700' },
  { value: 'stocks', label: 'أسهم أمريكية', icon: '📈', color: '#00FFCC' },
  { value: 'forex', label: 'فوركس', icon: '💱', color: '#CC88FF' }
]

const TYPE_COLOR = { crypto: '#FFD700', stocks: '#00FFCC', forex: '#CC88FF' }
const TYPE_LABEL = { crypto: 'كريبتو', stocks: 'أسهم', forex: 'فوركس' }

// ─── Helpers ──────────────────────────────────────────────────
const emptyForm = () => ({
  name: '',
  type: 'crypto',
  watch_api_key: '',
  watch_api_secret: '',
  control_api_key: '',
  control_api_secret: '',
  historical_api_key: '',
  historical_api_secret: '',
  fetch_api_key: '',
  fetch_api_secret: ''
})
const emptyTest = () => ({
  watch: { ok: null, msg: '' },
  control: { ok: null, msg: '' },
  historical: { ok: null, msg: '' },
  fetch: { ok: null, msg: '' }
})

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const MarketsPage = () => {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [expandedId, setExpandedId] = useState(null) // which market is open

  const fetchMarkets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: e } = await supabase
        .from('markets')
        .select('*, market_apis(*)')
        .order('created_at', { ascending: false })
      if (e) throw e
      setMarkets(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  const deleteMarket = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السوق نهائياً؟')) return
    await supabase.from('markets').delete().eq('id', id)
    fetchMarkets()
  }

  const toggleActive = async (id, current) => {
    await supabase.from('markets').update({ is_active: !current }).eq('id', id)
    fetchMarkets()
  }

  return (
    <div className="container-fluid p-0 animate-fade-in">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
        <div>
          <h2
            className="m-0 saqr-title text-gold d-flex align-items-center gap-3"
            style={{ fontSize: '1.5rem' }}
          >
            <LayoutGrid size={24} /> إدارة الأسواق والقوائم
          </h2>
          <p className="small text-silver opacity-75 m-0 mt-2">
            كل سوق = 3 APIs + قائمتان · الصقر يرى فقط ما هو مسجّل
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn btn-gold d-flex align-items-center gap-2 px-4 py-2 rounded-3"
        >
          <Plus size={18} /> إضافة سوق جديد
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 mb-4 border-ruby d-flex align-items-center gap-3">
          <AlertCircle size={24} className="text-ruby" />
          <span className="text-silver">{error}</span>
        </div>
      )}

      {/* Markets List */}
      {loading ? (
        <div className="text-center py-5">
          <RefreshCcw
            className="text-gold mb-3"
            size={48}
            style={{ animation: 'spin 1s linear infinite' }}
          />
          <div className="text-silver fs-5">جاري تحميل الأسواق...</div>
        </div>
      ) : markets.length === 0 ? (
        <div className="glass-panel text-center py-5 px-4">
          <LayoutGrid className="text-gold mb-4 opacity-25" size={80} />
          <h3 className="text-silver opacity-50">لا توجد أسواق مسجّلة</h3>
          <p className="text-silver opacity-25 mt-2">أضف أول سوق تداول من الزر أعلاه</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-4">
          {markets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              expanded={expandedId === market.id}
              onToggleExpand={() => setExpandedId(expandedId === market.id ? null : market.id)}
              onDelete={() => deleteMarket(market.id)}
              onToggleActive={() => toggleActive(market.id, market.is_active)}
              onRefresh={fetchMarkets}
            />
          ))}
        </div>
      )}

      {/* Add Market Modal */}
      {showAddModal && (
        <AddMarketModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false)
            fetchMarkets()
          }}
        />
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .border-ruby { border-color: var(--saqr-ruby) !important; }
        .market-card-header { cursor: pointer; }
        .market-card-header:hover { background: rgba(255,215,0,0.03); }
        .tag-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:100px; font-size:0.7rem; font-weight:700; border:1px solid currentColor; text-transform:uppercase; }
        .api-section { border-left: 3px solid rgba(255,215,0,0.3); padding-left: 1rem; }
        .test-dot { width:10px; height:10px; border-radius:50%; display:inline-block; }
        .test-dot.ok  { background: var(--saqr-emerald); box-shadow:0 0 8px var(--saqr-emerald); }
        .test-dot.fail{ background: var(--saqr-ruby);    box-shadow:0 0 8px var(--saqr-ruby); }
        .test-dot.idle{ background: rgba(255,255,255,0.2); }
        .symbol-row { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); margin-bottom:8px; }
        .symbol-row:hover { background:rgba(255,215,0,0.04); border-color:rgba(255,215,0,0.2); }
        .type-btn { padding:10px 20px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); background:transparent; color:#999; cursor:pointer; transition:all 0.2s; font-weight:600; }
        .type-btn.selected { border-color: var(--saqr-gold); color: #000; background: var(--saqr-gold); }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MARKET CARD
// ═══════════════════════════════════════════════════════════════
const MarketCard = ({ market, expanded, onToggleExpand, onDelete, onToggleActive, onRefresh }) => {
  const [syncing, setSyncing] = useState(false)
  const api = market.market_apis?.[0]
  const typeColor = TYPE_COLOR[market.type] || '#FFD700'
  const typeLabel = TYPE_LABEL[market.type] || market.type

  const handleSync = async () => {
    if (!window.confirm(`هل تريد بدء مزامنة كاملة لبيانات سوق ${market.name}؟\nسيتم جلب 10 سنوات من البيانات لكل العملات.`)) return
    setSyncing(true)
    try {
      await kitchenService.syncMarket(market.id)
      alert('بدأت المزامنة بنجاح في الخلفية. يمكنك متابعة العمل.')
    } catch (err) {
      alert('فشل بدء المزامنة: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="glass-card" style={{ borderTop: `3px solid ${typeColor}` }}>
      {/* Card Header */}
      <div
        className="market-card-header d-flex align-items-center justify-content-between p-4"
        onClick={onToggleExpand}
      >
        <div className="d-flex align-items-center gap-4">
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: `rgba(${typeColor === '#FFD700' ? '255,215,0' : typeColor === '#00FFCC' ? '0,255,204' : '204,136,255'}, 0.15)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24
            }}
          >
            {market.type === 'crypto' ? '₿' : market.type === 'stocks' ? '📈' : '💱'}
          </div>
          <div>
            <h4 className="text-white fw-bold m-0">{market.name}</h4>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="tag-badge" style={{ color: typeColor }}>
                {typeLabel}
              </span>
              <span className={`tag-badge ${market.is_active ? 'text-emerald' : 'text-ruby'}`}>
                {market.is_active ? '● نشط' : '● متوقف'}
              </span>
              {api && (
                <span className="tag-badge text-silver opacity-50">
                  {
                    [api.watch_connected, api.control_connected, api.historical_connected].filter(
                      Boolean
                    ).length
                  }
                  /3 APIs متصلة
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleSync()
            }}
            disabled={syncing}
            className="btn btn-sm px-3 py-2 rounded-3 fw-bold d-flex align-items-center gap-2"
            style={{ 
              fontSize: '0.8rem',
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
              color: 'var(--saqr-gold)'
            }}
          >
            <RefreshCcw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'جاري البدء...' : 'مزامنة شاملة'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleActive()
            }}
            className={`btn btn-sm px-3 py-2 rounded-3 fw-bold ${market.is_active ? 'btn-outline-ruby' : 'btn-outline-emerald'}`}
            style={{ fontSize: '0.8rem' }}
          >
            {market.is_active ? 'إيقاف' : 'تفعيل'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="btn btn-sm p-2 rounded-3 text-ruby opacity-50"
            style={{ background: 'rgba(255,0,85,0.08)', border: '1px solid rgba(255,0,85,0.2)' }}
          >
            <Trash2 size={16} />
          </button>
          {expanded ? (
            <ChevronUp size={20} className="text-gold" />
          ) : (
            <ChevronDown size={20} className="text-silver" />
          )}
        </div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div className="border-top p-4" style={{ borderColor: 'rgba(255,215,0,0.1)' }}>
          <div className="row g-4">
            {/* Whitelist */}
            <div className="col-12 col-lg-6">
              <SymbolList
                marketId={market.id}
                table="whitelist"
                title="القائمة البيضاء"
                subtitle="يتداول فيها ✅"
                icon={<ShoppingCart size={18} />}
                color="#00FFCC"
                hasReason={false}
              />
            </div>
            {/* Leaders */}
            <div className="col-12 col-lg-6">
              <SymbolList
                marketId={market.id}
                table="market_leaders"
                title="قائمة القياديين"
                subtitle="يراقب الاتجاه فقط 👁️"
                icon={<Eye size={18} />}
                color="#CC88FF"
                hasReason={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SYMBOL LIST (Whitelist / Leaders)
// ═══════════════════════════════════════════════════════════════
const SymbolList = ({ marketId, table, title, subtitle, icon, color, hasReason }) => {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)

  const [bulkInput, setBulkInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from(table)
      .select('*')
      .eq('market_id', marketId)
      .eq('is_active', true)
      .order('created_at')
    setItems(data || [])
    setLoading(false)
  }, [marketId, table])

  useEffect(() => {
    load()
  }, [load])

  // Search logic (using Binance as default for crypto)
  const searchSymbol = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    try {
      // For Crypto, we can search Binance Exchange Info
      const res = await fetch(`https://api.binance.com/api/v3/exchangeInfo`)
      const data = await res.json()
      const symbols = data.symbols
        .filter((s) => s.symbol.includes(query.toUpperCase()))
        .slice(0, 8)
        .map((s) => ({
          symbol: s.symbol,
          base: s.baseAsset,
          name: s.baseAsset,
          logo: `https://bin.bnbstatic.com/static/assets/logos/crypto/${s.baseAsset.toLowerCase()}.png`
        }))
      setSearchResults(symbols)
    } catch (e) {
      console.error('Search failed', e)
    } finally {
      setSearching(false)
    }
  }

  const addOne = async (coin) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const row = {
      market_id: marketId,
      symbol: coin.symbol,
      symbol_name: coin.name,
      metadata: { logo: coin.logo },
      added_by: user?.id,
      is_active: true
    }
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'market_id, symbol' })
    if (error) alert('خطأ: ' + error.message)
    else {
      load()
      setSearchQuery('')
      setSearchResults([])
      setAdding(false)
    }
    setSaving(false)
  }

  const addBulk = async () => {
    if (!bulkInput.trim()) return
    setSaving(true)
    const symbols = bulkInput.split(/[\n, ·.]+/)
      .map(s => s.trim())
      .filter((s) => s.length > 0)
    
    const { data: { user } } = await supabase.auth.getUser()
    const rows = symbols.map((s) => ({
      market_id: marketId,
      symbol: s.toUpperCase(),
      added_by: user?.id,
      is_active: true,
      metadata: {
        logo: `https://bin.bnbstatic.com/static/assets/logos/crypto/${s.split('/')[0].toLowerCase()}.png`
      }
    }))

    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'market_id, symbol' })
    if (error) alert('خطأ: ' + error.message)
    else {
      load()
      setBulkInput('')
      setBulkMode(false)
      setAdding(false)
    }
    setSaving(false)
  }

  const remove = async (id) => {
    await supabase.from(table).update({ is_active: false }).eq('id', id)
    setSelectedIds(prev => prev.filter(sid => sid !== id))
    load()
  }

  const removeSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`هل أنت متأكد من مسح ${selectedIds.length} رمز مختار؟`)) return
    setSaving(true)
    const { error } = await supabase.from(table).update({ is_active: false }).in('id', selectedIds)
    if (error) alert('خطأ: ' + error.message)
    else {
      setSelectedIds([])
      load()
    }
    setSaving(false)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length) setSelectedIds([])
    else setSelectedIds(items.map(i => i.id))
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id])
  }

  const removeAll = async () => {
    if (!window.confirm(`هل أنت متأكد من مسح جميع الرموز في ${title}؟`)) return
    setSaving(true)
    const { error } = await supabase.from(table).update({ is_active: false }).eq('market_id', marketId)
    if (error) alert('خطأ: ' + error.message)
    else load()
    setSaving(false)
  }

  return (
    <div
      className="glass-card p-4 h-100 shadow-sm"
      style={{ borderTop: `2px solid ${color}`, borderRadius: 20 }}
    >
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <div className="d-flex align-items-center gap-3 fw-bold fs-5" style={{ color }}>
            <div className="p-2 rounded-3 bg-white bg-opacity-5">{icon}</div>
            {title}
          </div>
          <div className="text-silver opacity-50 small mt-2">{subtitle}</div>
        </div>
        <div className="d-flex gap-2">
          <button
            onClick={() => {
              setAdding(!adding)
              setBulkMode(false)
            }}
            className="btn btn-sm px-3 py-2 fw-bold d-flex align-items-center gap-2"
            style={{
              background: `rgba(255,255,255,0.05)`,
              border: `1px solid rgba(255,255,255,0.1)`,
              color: '#fff',
              borderRadius: 12
            }}
          >
            <Plus size={16} /> بحث وإضافة
          </button>
          <button
            onClick={() => {
              setAdding(!adding)
              setBulkMode(true)
            }}
            className="btn btn-sm px-3 py-2 fw-bold d-flex align-items-center gap-2"
            style={{
              background: `rgba(${color === '#00FFCC' ? '0,255,204' : '204,136,255'}, 0.1)`,
              border: `1px solid ${color}`,
              color,
              borderRadius: 12
            }}
          >
            <Zap size={16} /> إضافة بالجملة
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={removeSelected}
              disabled={saving}
              className="btn btn-sm px-3 py-2 fw-bold d-flex align-items-center gap-2"
              style={{
                background: 'rgba(255,0,85,0.1)',
                border: '1px solid rgba(255,0,85,0.3)',
                color: 'var(--saqr-ruby)',
                borderRadius: 12
              }}
            >
              <Trash2 size={16} /> مسح المختار ({selectedIds.length})
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={removeAll}
              disabled={saving}
              className="btn btn-sm p-2 rounded-3 text-ruby opacity-75 hover-bg-ruby-10 transition-all border-0"
              title="مسح الكل"
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Add Form (Search) */}
      {adding && !bulkMode && (
        <div className="mb-4 animate-fade-in">
          <div className="position-relative">
            <Search
              className="position-absolute top-50 start-0 translate-middle-y ms-3 opacity-50"
              size={18}
            />
            <input
              className="form-control ps-5 py-3 rounded-4 bg-dark border-secondary"
              placeholder="ابحث عن رمز العملة (مثال: BTC...)"
              value={searchQuery}
              onChange={(e) => searchSymbol(e.target.value)}
            />
            {searching && (
              <RefreshCw
                size={16}
                className="position-absolute top-50 end-0 translate-middle-y me-3 spin text-gold"
              />
            )}
          </div>

          {searchResults.length > 0 && (
            <div
              className="mt-3 glass-panel p-2 shadow-lg animate-slide-up"
              style={{ maxHeight: '250px', overflowY: 'auto' }}
            >
              {searchResults.map((res) => (
                <div
                  key={res.symbol}
                  onClick={() => addOne(res)}
                  className="d-flex align-items-center justify-content-between p-3 rounded-3 hover-bg-white-5 cursor-pointer border-bottom border-white border-opacity-5"
                >
                  <div className="d-flex align-items-center gap-3">
                    <img
                      src={res.logo}
                      alt=""
                      width="24"
                      height="24"
                      className="rounded-circle"
                      onError={(e) =>
                        (e.target.src = 'https://cdn-icons-png.flaticon.com/512/2272/2272825.png')
                      }
                    />
                    <span className="fw-bold text-white">{res.symbol}</span>
                  </div>
                  <Plus size={16} className="text-gold" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Form (Bulk) */}
      {adding && bulkMode && (
        <div className="mb-4 animate-fade-in p-3 rounded-4 bg-white bg-opacity-5 border border-white border-opacity-10">
          <label className="small text-silver mb-2">أدخل الرموز مفصولة بفاصلة أو سطر جديد:</label>
          <textarea
            className="form-control mb-3 bg-dark text-white rounded-3 border-secondary"
            rows="4"
            placeholder="BTC/USDT, ETH/USDT, SOL/USDT..."
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
          />
          <div className="d-flex gap-2">
            <button
              onClick={addBulk}
              disabled={saving}
              className="btn btn-gold flex-fill py-2 fw-bold"
            >
              {saving ? 'جاري الإضافة...' : '✅ إضافة الكل'}
            </button>
            <button onClick={() => setAdding(false)} className="btn btn-outline-gold py-2">
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div
        className="symbol-list-container"
        style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}
      >
        {loading ? (
          <div className="text-center py-5">
            <RefreshCcw className="text-gold spin" size={30} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-5 text-silver opacity-25 d-flex flex-column align-items-center gap-3">
            <X size={40} />
            <span>لا توجد رموز مضافة لهذه القائمة</span>
          </div>
        ) : (
          <div className="d-flex flex-column gap-2">
            {items.length > 0 && (
              <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2 rounded-3 bg-white bg-opacity-5">
                <input 
                  type="checkbox" 
                  className="form-check-input m-0 cursor-pointer" 
                  checked={selectedIds.length === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="small text-secondary fw-bold">تحديد الكل</span>
              </div>
            )}
            {items.map((item) => (
              <div key={item.id} className="symbol-row p-3 rounded-4 transition-all">
                <div className="d-flex align-items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="form-check-input m-0 cursor-pointer" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                  />
                  <div className="symbol-logo-wrapper p-1 rounded-circle bg-white bg-opacity-5">
                    <img
                      src={
                        item.metadata?.logo ||
                        `https://bin.bnbstatic.com/static/assets/logos/crypto/${item.symbol.split('/')[0].toLowerCase()}.png`
                      }
                      alt=""
                      width="32"
                      height="32"
                      className="rounded-circle"
                      onError={(e) =>
                        (e.target.src = 'https://cdn-icons-png.flaticon.com/512/2272/2272825.png')
                      }
                    />
                  </div>
                  <div>
                    <div className="text-white fw-bold fs-6">{item.symbol}</div>
                    <div className="text-silver opacity-40 x-small fw-medium">
                      {item.symbol_name || 'Asset'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="btn btn-sm p-2 rounded-circle hover-bg-ruby-10 text-ruby opacity-40 transition-all border-0"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .cursor-pointer { cursor: pointer; }
        .hover-bg-white-5:hover { background: rgba(255,255,255,0.05); }
        .hover-bg-ruby-10:hover { background: rgba(220, 53, 69, 0.1) !important; opacity: 1 !important; }
        .symbol-logo-wrapper { border: 1px solid rgba(255,255,255,0.1); }
        .spin { animation: rotate 1s linear infinite; }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .x-small { font-size: 0.7rem; }
        .symbol-list-container::-webkit-scrollbar { width: 4px; }
        .symbol-list-container::-webkit-scrollbar-thumb { background: rgba(255, 215, 0, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD MARKET MODAL
// ═══════════════════════════════════════════════════════════════
const AddMarketModal = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState(emptyForm())
  const [testResult, setTest] = useState(emptyTest())
  const [testing, setTesting] = useState(false)
  const [tested, setTested] = useState(false)
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const checkKey = async (exchange, key, secret) => {
    if (!key) return { ok: false, msg: 'لم يتم إدخال المفتاح' }
    try {
      const cleanKey = key.trim()
      const cleanSecret = (secret || '').trim()

      const res = await fetch(`${BACKEND_URL}/api/v1/market/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange, key: cleanKey, secret: cleanSecret, is_paper: false })
      })
      if (!res.ok) return { ok: false, msg: 'فشل الاتصال بالخادم' }
      const data = await res.json()
      return { ok: data.success, msg: data.message || '' }
    } catch (e) {
      return { ok: false, msg: e.message }
    }
  }

  // Real connection test via backend
  const runTest = async () => {
    setTesting(true)
    setTested(false)
    setTest(emptyTest())
    const exchange = form.type === 'stocks' || form.type === 'forex' ? 'alpaca' : 'binance'

    // We use control keys as default if others are empty
    const wKey = form.watch_api_key || form.control_api_key
    const wSec = form.watch_api_secret || form.control_api_secret
    const hKey = form.historical_api_key || form.control_api_key
    const hSec = form.historical_api_key ? form.historical_api_secret : form.control_api_secret

    const [watchRes, controlRes, histRes, fetchRes] = await Promise.all([
      checkKey(exchange, wKey, wSec),
      checkKey(exchange, form.control_api_key, form.control_api_secret),
      checkKey(exchange, hKey, hSec),
      checkKey(
        exchange,
        form.fetch_api_key || form.control_api_key,
        form.fetch_api_secret || form.control_api_secret
      )
    ])

    setTest({ watch: watchRes, control: controlRes, historical: histRes, fetch: fetchRes })
    setTested(true)
    setTesting(false)
  }

  const allOk =
    tested &&
    (testResult.control?.ok ||
      testResult.watch?.ok ||
      testResult.historical?.ok ||
      testResult.fetch?.ok)

  const submit = async () => {
    if (!form.name) return
    setSaving(true)
    const {
      data: { user }
    } = await supabase.auth.getUser()
    const { data: mkt, error: me } = await supabase
      .from('markets')
      .insert([{ name: form.name.trim(), type: form.type, is_active: true, user_id: user?.id }])
      .select()
      .single()

    if (me) {
      alert('خطأ في إنشاء السوق: ' + me.message)
      setSaving(false)
      return
    }

    const { error: ae } = await supabase.from('market_apis').insert([
      {
        market_id: mkt.id,
        user_id: user?.id,
        watch_api_key: form.watch_api_key,
        watch_api_secret: form.watch_api_secret,
        watch_connected: testResult.watch.ok || false,
        control_api_key: form.control_api_key?.trim(),
        control_api_secret: form.control_api_secret?.trim(),
        control_connected: testResult.control.ok || false,
        historical_api_key: form.historical_api_key?.trim(),
        historical_api_secret: form.historical_api_secret?.trim(),
        historical_connected: testResult.historical.ok || false,
        fetch_api_key: form.fetch_api_key?.trim(),
        fetch_api_secret: form.fetch_api_secret?.trim(),
        fetch_connected: testResult.fetch.ok || false,
        last_tested_at: tested ? new Date().toISOString() : null
      }
    ])

    if (ae) {
      alert('تم إنشاء السوق ولكن فشل حفظ مفاتيح الـ API: ' + ae.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onSuccess()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(16px)'
        }}
        onClick={onClose}
      />
      <div
        className="glass-panel animate-fade-in"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          zIndex: 10000
        }}
      >
        {/* Header */}
        <div
          className="p-3 d-flex justify-content-between align-items-center"
          style={{
            borderBottom: '1px solid rgba(255,215,0,0.1)',
            background: 'rgba(255,215,0,0.03)'
          }}
        >
          <h5 className="m-0 text-gold fw-black d-flex align-items-center gap-2">
            <Plus size={20} /> إضافة سوق جديد
          </h5>
          <button
            onClick={onClose}
            className="btn p-1"
            style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-3">
          {/* Platform Name */}
          <div className="mb-4">
            <label className="form-label text-gold small fw-bold text-uppercase opacity-75">
              اسم المنصة
            </label>
            <input
              className="form-control"
              placeholder="مثال: Binance"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>

          {/* Type */}
          <div className="mb-4">
            <label className="form-label text-gold small fw-bold text-uppercase opacity-75">
              النوع
            </label>
            <div className="d-flex gap-2 flex-wrap">
              {MARKET_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => set('type', t.value)}
                  className={`type-btn ${form.type === t.value ? 'selected' : ''}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Watch */}
          <ApiSection
            title="API المتابعة"
            desc="اختياري - سيستخدم مفتاح التحكم إذا تُرك فارغاً"
            icon={<Wifi size={14} />}
            color="#00FFCC"
            status={testResult.watch?.ok}
            hasSecret
            keyVal={form.watch_api_key}
            onKey={(v) => set('watch_api_key', v)}
            secVal={form.watch_api_secret}
            onSec={(v) => set('watch_api_secret', v)}
          />
          <ApiSection
            title="API التحكم والتداول"
            desc="إجباري - لتنفيذ الصفقات الفعلي"
            icon={<Zap size={14} />}
            color="#FFD700"
            status={testResult.control?.ok}
            hasSecret
            keyVal={form.control_api_key}
            onKey={(v) => set('control_api_key', v)}
            secVal={form.control_api_secret}
            onSec={(v) => set('control_api_secret', v)}
          />
          <ApiSection
            title="API جلب العملات"
            desc="اختياري - للبحث التلقائي وجلب البيانات التعريفية"
            icon={<Globe size={14} />}
            color="#00D1FF"
            status={testResult.fetch?.ok}
            hasSecret={true}
            keyVal={form.fetch_api_key}
            onKey={(v) => set('fetch_api_key', v)}
            secVal={form.fetch_api_secret}
            onSec={(v) => set('fetch_api_secret', v)}
          />

          {/* Test Results */}
          {tested && (
            <div
              className="mb-4 p-3 rounded-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,215,0,0.1)'
              }}
            >
              <div className="fw-bold text-silver mb-3 small text-uppercase">نتيجة الاختبار</div>
              {[
                { label: 'API المتابعة', res: testResult.watch },
                { label: 'API التحكم', res: testResult.control },
                { label: 'API البيانات القديمة', res: testResult.historical },
                { label: 'API جلب العملات', res: testResult.fetch }
              ].map((r) => (
                <div key={r.label} className="d-flex align-items-center gap-3 mb-2">
                  <span className={`test-dot ${r.res.ok ? 'ok' : 'fail'}`} />
                  <span className="text-silver small">{r.label}</span>
                  <div className="ms-auto text-end">
                    <div className={`fw-bold small ${r.res.ok ? 'text-emerald' : 'text-ruby'}`}>
                      {r.res.ok ? '✅ متصل' : '❌ فشل'}
                    </div>
                    {!r.res.ok && r.res.msg && (
                      <div
                        className="text-ruby opacity-75 mt-1"
                        style={{ fontSize: '0.7rem', maxWidth: '250px' }}
                      >
                        {r.res.msg}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-3 d-flex gap-2"
          style={{ borderTop: '1px solid rgba(255,215,0,0.08)', background: 'rgba(0,0,0,0.2)' }}
        >
          <button onClick={onClose} className="btn btn-outline-gold flex-fill py-2 small">
            إلغاء
          </button>
          {!allOk ? (
            <button
              onClick={runTest}
              disabled={testing}
              className="btn py-2 flex-fill fw-bold"
              style={{
                background: 'rgba(0,255,204,0.1)',
                border: '1px solid #00FFCC',
                color: '#00FFCC',
                borderRadius: 10
              }}
            >
              {testing ? (
                <>
                  <RefreshCcw
                    size={14}
                    style={{ animation: 'spin 1s linear infinite', marginLeft: 8 }}
                  />{' '}
                  جاري...
                </>
              ) : (
                '🔌 اختبار الاتصال'
              )}
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving || !form.name}
              className={`btn flex-fill py-2 fw-bold ${!form.name ? 'btn-outline-gold opacity-50' : 'btn-gold'}`}
            >
              {saving
                ? '...'
                : !form.name
                  ? '⚠️ اكتب اسم المنصة أولاً (أعلى الشاشة)'
                  : '✅ إضافة المنصة'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// API SECTION (reusable)
// ═══════════════════════════════════════════════════════════════
const ApiSection = ({
  title,
  desc,
  icon,
  color,
  status,
  hasSecret,
  keyVal,
  onKey,
  secVal,
  onSec
}) => (
  <div className="mb-4 api-section" style={{ borderLeftColor: color }}>
    <div className="d-flex align-items-center gap-2 mb-2">
      <span style={{ color }}>{icon}</span>
      <span className="fw-bold text-white small">{title}</span>
      {status === true && <span className="test-dot ok ms-2" />}
      {status === false && <span className="test-dot fail ms-2" />}
    </div>
    <div className="text-silver x-small opacity-50 mb-2">
      {desc} · الـ URL محدد تلقائياً حسب المنصة
    </div>
    <input
      className="form-control mb-2"
      placeholder="API Key"
      value={keyVal}
      onChange={(e) => onKey(e.target.value)}
    />
    {hasSecret && (
      <input
        className="form-control"
        type="password"
        placeholder="API Secret"
        value={secVal}
        onChange={(e) => onSec(e.target.value)}
      />
    )}
  </div>
)

export default MarketsPage
