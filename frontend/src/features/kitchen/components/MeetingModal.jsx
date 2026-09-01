import React, { useState, useEffect, useRef } from 'react'
import {
  Play,
  X,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Target,
  User,
  ChevronRight,
  Calculator,
  Activity,
  Loader2,
  Cpu,
  Shield,
  ShieldCheck,
  Clock,
  Link,
  Zap,
  Lock,
  Unlock,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  BarChart3,
  Layers,
  Settings2
} from 'lucide-react'
import { kitchenService } from '../services/kitchenService'
import { workerService } from '../../workers/services/workerService'

const DEFAULT_WHITELIST_GROUPS = [
  {
    id: 'leaders',
    name: '🔵 القادة',
    name_ar: 'القادة',
    description: 'العملات القيادية الأعلى سيولة وتأثيراً في السوق (BTC, ETH, SOL, BNB...)',
    color: '#3b82f6',
    symbol_count: 7,
    symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'BTC/USDC', 'ETH/USDC', 'ETH/BTC']
  },
  {
    id: 'layer1',
    name: '🟢 الطبقة الأولى',
    name_ar: 'الطبقة الأولى',
    description: 'بلوكتشينات الجيل القادم عالية الأداء (ADA, AVAX, DOT, NEAR, SUI, TON...)',
    color: '#22c55e',
    symbol_count: 26,
    symbols: ['ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'NEAR/USDT', 'ATOM/USDT', 'ICP/USDT', 'SUI/USDT', 'TON/USDT', 'FTM/USDT', 'HBAR/USDT', 'TIA/USDT', 'SEI/USDT']
  },
  {
    id: 'defi_layer2',
    name: '🟡 DeFi والطبقة الثانية',
    name_ar: 'ديفاي والطبقة الثانية',
    description: 'بروتوكولات التمويل اللامركزي وحلول التوسع (ARB, OP, LINK, STX, RENDER...)',
    color: '#eab308',
    symbol_count: 15,
    symbols: ['ARB/USDT', 'OP/USDT', 'LINK/USDT', 'GRT/USDT', 'STX/USDT', 'RENDER/USDT', 'WLD/USDT', 'PYTH/USDT']
  },
  {
    id: 'classic',
    name: '⚪ الكلاسيكيات',
    name_ar: 'الكلاسيكيات',
    description: 'العملات الكلاسيكية الموثوقة ذات التاريخ الطويل (XRP, LTC, BCH, DOGE, TRX...)',
    color: '#94a3b8',
    symbol_count: 28,
    symbols: ['XRP/USDT', 'LTC/USDT', 'BCH/USDT', 'XMR/USDT', 'XLM/USDT', 'ETC/USDT', 'DOGE/USDT', 'TRX/USDT', 'VET/USDT', 'FIL/USDT', 'THETA/USDT']
  }
]

const MeetingModal = ({ isOpen, onClose, onStart }) => {
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [markets, setMarkets] = useState([])
  const [workers, setWorkers] = useState([])
  const [availableSymbols, setAvailableSymbols] = useState([
    { symbol: '🌐 دراسة السوق العام (توزيع متعدد العملات)', realSymbol: 'ALL' }
  ])
  const [coverageLoading, setCoverageLoading] = useState(false)
  const [coverageResult, setCoverageResult] = useState({ ok: true, coverage: 1.0 })

  // --- Whitelist Groups State (مُهيأة افتراضياً للظهور اللحظي الفوري 0ms) ---
  const [scopeMode, setScopeMode] = useState('groups') // 'groups' | 'single'
  const [whitelistGroups, setWhitelistGroups] = useState(DEFAULT_WHITELIST_GROUPS)
  const [selectedGroups, setSelectedGroups] = useState(['all']) // ['all'] or array of IDs

  // --- The 12 Fields State ---
  const [issuersType, setIssuersType] = useState('both') // Field 1: Standard/Developed/Both
  const [marketType, setMarketType] = useState('stable') // Field 2: Stable/Volatile
  const [capital, setCapital] = useState('1000') // Field 3: Initial Capital
  const [tradeSizingType, setTradeSizingType] = useState('percent_allocation') // Field 4: Fixed/Percent
  const [tradeSizingValue, setTradeSizingValue] = useState('10')

  const [maxOpenTradesType, setMaxOpenTradesType] = useState('limit') // Field 5: Unlimited/Limit
  const [maxOpenTradesValue, setMaxOpenTradesValue] = useState('3')

  const [liquidityType, setLiquidityType] = useState('strict') // Field 6: Strict/Flexible
  const [useRemainingLiquidity, setUseRemainingLiquidity] = useState(false) // Field 6: Extra trades

  const [tpType, setTpType] = useState('recommended') // Field 7: TP
  const [tpValue, setTpValue] = useState('3')

  const [slType, setSlType] = useState('recommended_trailing') // Field 8: SL
  const [slValue, setSlValue] = useState('1.5')

  const [expiryType, setExpiryType] = useState('recommended') // Field 9: Expiry
  const [expiryValue, setExpiryValue] = useState('60')

  const [angle, setAngle] = useState('new') // Field 10: New/Improve
  const [baseWorkerId, setBaseWorkerId] = useState('')

  const [portfolioShareType, setPortfolioShareType] = useState('percent_comp') // Field 12: Fixed/Percent (Comp/NoComp)
  const [selectionCriteria, setSelectionCriteria] = useState('success_rate')
  const [marketId, setMarketId] = useState('')
  const [symbol, setSymbol] = useState('ALL')

  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false)
      if (markets.length === 0) {
        loadData()
      }
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (scopeMode === 'groups' || !symbol || symbol === 'ALL') {
      setCoverageResult({ ok: true, coverage: 1.0 })
      setCoverageLoading(false)
      return
    }

    let cancelled = false
    const run = async () => {
      setCoverageLoading(true)
      try {
        const resp = await kitchenService.getHistoricalCoverage(symbol, '4h', 10)
        if (!cancelled) {
          if (resp?.data) {
            setCoverageResult(resp.data)
          } else {
            setCoverageResult(null)
          }
        }
      } catch (e) {
        if (!cancelled) {
          setCoverageResult({
            ok: null,
            coverage: 0,
            error: '⚠️ تعذّر التحقق من البيانات التاريخية. يمكنك المتابعة أو تشغيل المزامنة أولاً.'
          })
        }
      } finally {
        if (!cancelled) setCoverageLoading(false)
      }
    }
    run()

    return () => {
      cancelled = true
    }
  }, [isOpen, symbol, scopeMode])

  const loadData = async () => {
    try {
      const [marketList, workerList, groupsList] = await Promise.allSettled([
        kitchenService.getMarkets(),
        kitchenService.getWorkers(),
        kitchenService.getWhitelistGroups()
      ])

      const m = marketList.status === 'fulfilled' ? (marketList.value || []) : []
      const w = workerList.status === 'fulfilled' ? (workerList.value || []) : []
      const g = groupsList.status === 'fulfilled' ? (groupsList.value || []) : []

      setMarkets(m)
      setWorkers(w)
      setWhitelistGroups(g)

      if (m.length > 0) {
        const initialMarketId = m[0].id
        setMarketId(initialMarketId)
        loadSymbols(initialMarketId)
      }
    } catch (err) {
      console.error('Error loading modal data:', err)
    }
  }

  const toggleGroup = (groupId) => {
    if (groupId === 'all') {
      setSelectedGroups(['all'])
      return
    }
    let updated = selectedGroups.filter(g => g !== 'all')
    if (updated.includes(groupId)) {
      updated = updated.filter(g => g !== groupId)
      if (updated.length === 0) {
        updated = ['all']
      }
    } else {
      updated.push(groupId)
    }
    setSelectedGroups(updated)
  }

  const loadSymbols = async (mId) => {
    try {
      const symbols = await kitchenService.getMarketSymbols(mId)
      const list = symbols || []
      const finalSymbols = [{ symbol: '🌐 دراسة السوق العام (توزيع متعدد العملات)', realSymbol: 'ALL' }, ...list]
      setAvailableSymbols(finalSymbols)
      if (!symbol) {
        setSymbol('ALL')
      }
    } catch (err) {
      console.error('Error loading symbols:', err)
    }
  }

  const handleMarketChange = (mId) => {
    setMarketId(mId)
    loadSymbols(mId)
  }

  if (!isOpen) return null

  const handleStart = () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    onStart({
      issuersType,
      marketType,
      capital,
      tradeSizingType,
      tradeSizingValue,
      maxOpenTradesType,
      maxOpenTradesValue,
      liquidityType,
      useRemainingLiquidity,
      tpType,
      tpValue,
      slType,
      slValue,
      expiryType,
      expiryValue,
      angle,
      baseWorkerId,
      portfolioShareType,
      selectionCriteria,
      marketId: marketId || (markets[0]?.id || ''),
      symbol: scopeMode === 'groups' ? 'ALL' : (symbol || 'ALL'),
      selectedGroups: scopeMode === 'groups' ? selectedGroups : []
    })
  }

  const renderSectionHeader = (icon, title) => (
    <h6 className="text-gold small fw-bold mb-3 d-flex align-items-center gap-2 mt-2">
      {icon} {title}
    </h6>
  )

  return (
    <>
      <div className="modal-overlay">
        <div className="glass-panel modal-content-custom animate-fade-in">
          {/* Header */}
          <div
            className="d-flex justify-content-between align-items-center mb-4 sticky-top bg-black bg-opacity-90 py-3"
            style={{ zIndex: 100 }}
          >
            <div className="d-flex align-items-center gap-2">
              <div className="p-2 bg-gold bg-opacity-10 rounded-3 text-gold">
                <Settings2 size={20} />
              </div>
              <h5 className="m-0 text-gold fw-bold">إعدادات اجتماع الخبراء العلمي</h5>
            </div>
            <button onClick={onClose} className="btn-close-custom">
              <X size={20} />
            </button>
          </div>

          <div className="row g-4 pb-5">
            {/* 1. العقول والذكاء (Field 1) */}
            <div className="col-12 border-bottom border-white border-opacity-5 pb-4">
              {renderSectionHeader(<Cpu size={16} />, 'العقول والقرار (Decision Maker)')}
              <div className="d-flex gap-2">
                {[
                  { id: 'standard', label: 'العادي (Standard)', desc: 'Claude Sonnet' },
                  { id: 'advanced', label: 'المطور (Developed)', desc: 'LSTM Memory' },
                  { id: 'both', label: 'الاثنين (Competition)', desc: '6 موظفين متنافسين' }
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setIssuersType(t.id)}
                    className={`btn flex-grow-1 p-3 rounded-4 border transition-all text-start ${issuersType === t.id ? 'bg-gold bg-opacity-10 border-gold' : 'bg-dark bg-opacity-40 border-white border-opacity-5'}`}
                  >
                    <div
                      className={`small fw-bold ${issuersType === t.id ? 'text-gold' : 'text-silver'}`}
                    >
                      {t.label}
                    </div>
                    <div className="extra-small text-secondary mt-1">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. بيئة العمل والسوق المستهدف (Field 2 & Whitelist Groups) */}
            <div className="col-12 border-bottom border-white border-opacity-5 pb-4">
              <div className="row g-3">
                <div className="col-md-6">
                  {renderSectionHeader(<Target size={16} />, 'السوق المستهدف')}
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white py-2 shadow-none"
                    value={marketId}
                    onChange={(e) => handleMarketChange(e.target.value)}
                  >
                    {markets.map((m) => (
                      <option key={m.id} value={m.id} style={{backgroundColor:"#1a1a2e", color:"white"}}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  {renderSectionHeader(<Activity size={16} />, 'بيئة العمل (Field 2)')}
                  <div className="d-flex gap-2">
                    {['stable', 'volatile'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setMarketType(t)}
                        className={`btn flex-grow-1 py-2 small fw-bold ${marketType === t ? (t === 'stable' ? 'text-success' : 'text-danger') : 'text-secondary'}`}
                        style={marketType === t
                          ? { background: t === 'stable' ? 'rgba(25,135,84,0.2)' : 'rgba(220,53,69,0.2)', border: `2px solid ${t === 'stable' ? '#198754' : '#dc3545'}`, borderRadius: 10 }
                          : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                      >
                        {t === 'stable' ? 'مستقر (مشاة)' : 'متوتر (طيار)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 🎯 قسم اختيار المجموعات الذكية أو العملة الفردية */}
                <div className="col-12 mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="extra-small text-gold fw-bold d-flex align-items-center gap-1">
                      <Layers size={14} /> نطاق أصول التداول والاستثمار
                    </label>
                    <div className="btn-group btn-group-sm">
                      <button
                        type="button"
                        className={`btn btn-sm px-3 ${scopeMode === 'groups' ? 'btn-gold text-dark fw-bold' : 'btn-outline-secondary text-secondary'}`}
                        onClick={() => setScopeMode('groups')}
                        style={{ fontSize: '11px', borderRadius: '6px 0 0 6px' }}
                      >
                        🗂️ مجموعات ذكية (موصى به)
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm px-3 ${scopeMode === 'single' ? 'btn-gold text-dark fw-bold' : 'btn-outline-secondary text-secondary'}`}
                        onClick={() => setScopeMode('single')}
                        style={{ fontSize: '11px', borderRadius: '0 6px 6px 0' }}
                      >
                        🎯 عملة فردية
                      </button>
                    </div>
                  </div>

                  {scopeMode === 'groups' ? (
                    <div>
                      <div className="row g-2 mt-1">
                        {/* بطاقة كل القائمة */}
                        <div className="col-12 col-sm-6 col-lg-4">
                          <div
                            onClick={() => toggleGroup('all')}
                            className="p-2 rounded-3 border transition-all cursor-pointer h-100 position-relative"
                            style={{
                              cursor: 'pointer',
                              background: selectedGroups.includes('all') ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255,255,255,0.03)',
                              borderColor: selectedGroups.includes('all') ? '#d4af37' : 'rgba(255,255,255,0.08)'
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="small fw-bold text-white">🌐 كل القائمة البيضاء</span>
                              <span className="badge bg-gold text-dark fw-bold" style={{ fontSize: '10px' }}>78 عملة</span>
                            </div>
                            <div className="extra-small text-secondary" style={{ fontSize: '11px' }}>
                              تحليل وتداول على كافة أصول القائمة المعتمدة
                            </div>
                          </div>
                        </div>

                        {/* بطاقات المجموعات المخصصة */}
                        {whitelistGroups.map((g) => {
                          const isSelected = selectedGroups.includes(g.id) || selectedGroups.includes('all')
                          const isDirectlySelected = selectedGroups.includes(g.id)
                          return (
                            <div key={g.id} className="col-12 col-sm-6 col-lg-4">
                              <div
                                onClick={() => toggleGroup(g.id)}
                                className="p-2 rounded-3 border transition-all cursor-pointer h-100 position-relative"
                                style={{
                                  cursor: 'pointer',
                                  background: isDirectlySelected
                                    ? 'rgba(212, 175, 55, 0.15)'
                                    : (selectedGroups.includes('all') ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)'),
                                  borderColor: isDirectlySelected
                                    ? (g.color || '#d4af37')
                                    : (selectedGroups.includes('all') ? 'rgba(212, 175, 55, 0.4)' : 'rgba(255,255,255,0.08)')
                                }}
                              >
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                  <span className="small fw-bold text-white">{g.name}</span>
                                  <span
                                    className="badge"
                                    style={{
                                      background: isDirectlySelected ? (g.color || '#d4af37') : 'rgba(255,255,255,0.1)',
                                      color: isDirectlySelected ? '#000' : '#ccc',
                                      fontSize: '10px'
                                    }}
                                  >
                                    {g.symbol_count || g.symbols?.length || 0} عملة
                                  </span>
                                </div>
                                <div className="extra-small text-secondary" style={{ fontSize: '11px', lineHeight: 1.3 }}>
                                  {g.description}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* شريط معلومات النطاق المختار */}
                      <div
                        className="mt-2 p-2 rounded-2 d-flex align-items-center justify-content-between"
                        style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px dashed rgba(212, 175, 55, 0.3)' }}
                      >
                        <div className="extra-small text-silver d-flex align-items-center gap-2">
                          <ShieldCheck size={14} className="text-gold" />
                          <span>
                            <strong>النطاق النشط: </strong>
                            {selectedGroups.includes('all')
                              ? 'جميع مجموعات القائمة البيضاء (78 عملة)'
                              : selectedGroups.map(gid => whitelistGroups.find(g => g.id === gid)?.name || gid).join(' + ')}
                          </span>
                        </div>
                        <span className="badge bg-dark border border-gold text-gold" style={{ fontSize: '10px' }}>
                          🔒 حصر التداول للموظفين
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <select
                        className="form-select bg-dark border-white border-opacity-10 text-white py-2 shadow-none"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        disabled={availableSymbols.length === 0}
                      >
                        {availableSymbols.length > 0 ? (
                          availableSymbols.map((s, idx) => (
                            <option key={idx} value={s.realSymbol || s.symbol} style={{backgroundColor:"#1a1a2e", color:"white"}}>
                              {s.symbol}
                            </option>
                          ))
                        ) : (
                          <option value="">لا توجد عملات في هذا السوق</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 3. إدارة رأس المال (Field 3, 4, 12) */}
            <div className="col-12 border-bottom border-white border-opacity-5 pb-4">
              {renderSectionHeader(<DollarSign size={16} />, 'إدارة رأس المال والمحفظة')}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">نصيب الموظف (Field 12):</label>
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white py-2 extra-small shadow-none"
                    value={portfolioShareType}
                    onChange={(e) => setPortfolioShareType(e.target.value)}
                  >
                    <option value="fixed">مبلغ ثابت ($)</option>
                    <option value="percent">نسبة (بدون Compounding)</option>
                    <option value="percent_comp">نسبة (مع Compounding)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">القيمة / النسبة:</label>
                  <input
                    type="number"
                    className="form-control bg-dark border-white border-opacity-10 text-white py-2 extra-small shadow-none"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">حجم الصفقة (Field 4):</label>
                  <div className="input-group">
                    <input
                      type="number"
                      className="form-control bg-dark border-white border-opacity-10 text-white py-2 extra-small shadow-none"
                      value={tradeSizingValue}
                      onChange={(e) => setTradeSizingValue(e.target.value)}
                    />
                    <span
                      className="input-group-text bg-dark border-white border-opacity-10 text-gold"
                      onClick={() =>
                        setTradeSizingType(
                          tradeSizingType === 'fixed' ? 'percent_allocation' : 'fixed'
                        )
                      }
                      style={{ cursor: 'pointer' }}
                    >
                      {tradeSizingType === 'fixed' ? '$' : '%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. معايير التشغيل (Field 5, 6, Concurrent) */}
            <div className="col-12 border-bottom border-white border-opacity-5 pb-4">
              {renderSectionHeader(<Layers size={16} />, 'معايير التشغيل والمفاضلة')}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="extra-small text-secondary mb-2">
                    الحد الأقصى للصفقات (Field 5):
                  </label>
                  <div className="d-flex gap-2">
                    <button
                      className={`btn btn-sm flex-grow-1 ${maxOpenTradesType === 'unlimited' ? 'btn-gold' : 'btn-dark'}`}
                      onClick={() => setMaxOpenTradesType('unlimited')}
                    >
                      مفتوح
                    </button>
                    <input
                      type="number"
                      className="form-control bg-dark border-white border-opacity-10 text-white py-1 extra-small w-25"
                      value={maxOpenTradesValue}
                      onChange={(e) => {
                        setMaxOpenTradesValue(e.target.value)
                        setMaxOpenTradesType('limit')
                      }}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <label className="extra-small text-secondary mb-2">
                    معيار المفاضلة (عند التزاحم):
                  </label>
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white py-2 extra-small shadow-none"
                    value={selectionCriteria}
                    onChange={(e) => setSelectionCriteria(e.target.value)}
                  >
                    <option value="success_rate">الأعلى نجاحاً تاريخياً</option>
                    <option value="risk_reward">أفضل معامل مخاطرة</option>
                    <option value="liquidity">أفضل سيولة متاحة</option>
                  </select>
                </div>
                <div className="col-12">
                  <div className="p-3 bg-dark bg-opacity-40 rounded-4 border border-white border-opacity-5 d-flex justify-content-between align-items-center">
                    <div>
                      <div className="small fw-bold text-white">إدارة السيولة (Field 6)</div>
                      <div className="extra-small text-secondary mt-1">
                        هل يستخدم السيولة المتبقية لفتح صفقات إضافية؟
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        onClick={() => setLiquidityType('strict')}
                        className={`btn btn-sm fw-bold ${liquidityType === 'strict' ? 'btn-warning text-dark' : 'btn-outline-secondary text-white'}`}
                      >
                        صارم
                      </button>
                      <button
                        onClick={() => setLiquidityType('flexible')}
                        className={`btn btn-sm fw-bold ${liquidityType === 'flexible' ? 'btn-warning text-dark' : 'btn-outline-secondary text-white'}`}
                      >
                        مرن
                      </button>

                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. استراتيجيات التخارج (Field 7, 8, 9) */}
            <div className="col-12 border-bottom border-white border-opacity-5 pb-4">
              {renderSectionHeader(<ArrowUpRight size={16} />, 'استراتيجيات التخارج والأهداف')}
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">جني الأرباح (Field 7):</label>
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white extra-small shadow-none"
                    value={tpType}
                    onChange={(e) => setTpType(e.target.value)}
                  >
                    <option value="recommended">حسب التوصية</option>
                    <option value="custom">مخصص %</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">وقف الخسارة (Field 8):</label>
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white extra-small shadow-none"
                    value={slType}
                    onChange={(e) => setSlType(e.target.value)}
                  >
                    <option value="recommended_trailing">توصية + Trailing</option>
                    <option value="custom_trailing">مخصص % + Trailing</option>
                    <option value="fixed">ثابت % (Fixed)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="extra-small text-secondary mb-2">
                    انتهاء الصلاحية (Field 9):
                  </label>
                  <select
                    className="form-select bg-dark border-white border-opacity-10 text-white extra-small shadow-none"
                    value={expiryType}
                    onChange={(e) => setExpiryType(e.target.value)}
                  >
                    <option value="recommended">حسب التوصية</option>
                    <option value="minutes">دقائق محددة</option>
                    <option value="eod">نهاية اليوم (EOD)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="sticky-bottom bg-black bg-opacity-90 pt-3 pb-2 mt-auto border-top border-white border-opacity-5">
            {coverageResult && coverageResult.ok === false && (
              <div className="mb-2 small text-danger d-flex align-items-center gap-2">
                <span>🚫</span>
                <span>{coverageResult?.error || `البيانات التاريخية غير مكتملة (${Math.round((coverageResult.coverage || 0) * 100)}%). يرجى تشغيل المزامنة أولاً.`}</span>
              </div>
            )}
            {coverageResult && coverageResult.ok === null && (
              <div className="mb-2 small text-warning d-flex align-items-center gap-2">
                <span>⚠️</span>
                <span>{coverageResult.error}</span>
              </div>
            )}
            <button
              type="button"
              onClick={handleStart}
              disabled={isSubmitting}
              className="btn btn-gold w-100 py-3 fw-bold d-flex align-items-center justify-content-center gap-2 shadow-gold-lg"
              style={{ borderRadius: '16px', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>جاري بدء الجلسة فوراً...</span>
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" /> <span>عقد الاجتماع العلمي الآن</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <style>{`
          /* ── Select & Option colors ── */
          select,
          select.form-select {
            color: #ffffff !important;
            background-color: #1a1a2e !important;
          }
          select option,
          select.form-select option {
            background-color: #1a1a2e !important;
            color: #ffffff !important;
          }
          select:disabled { color: #888 !important; }

          /* ── Inputs ── */
          input.form-control {
            color: #ffffff !important;
            background-color: #1a1a2e !important;
          }
          input.form-control::placeholder { color: #666 !important; }

          /* ── Labels ── */
          label, .extra-small.text-secondary { color: #aaa !important; }

          /* ── Input group text ── */
          .input-group-text {
            background-color: #111 !important;
            border-color: rgba(255,255,255,0.1) !important;
            color: #d4af37 !important;
          }

          /* ── Modal layout ── */
          .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.95); backdrop-filter: blur(15px);
            z-index: 1050; display: flex; align-items: center;
            justify-content: center; padding: 20px;
          }
          .modal-content-custom {
            width: 100%; max-width: 850px;
            border: 1px solid rgba(212,175,55,0.2) !important;
            max-height: 92vh; overflow-y: auto; position: relative;
            padding: 0 30px 30px 30px; border-radius: 28px;
            background: #0a0a0a;
          }

          /* ── Animations ── */
          .animate-fade-in { animation: fadeIn 0.4s ease-out; }
          @keyframes fadeIn { from { opacity:0; transform:scale(0.98); } to { opacity:1; transform:scale(1); } }

          /* ── Typography helpers ── */
          .extra-small { font-size: 11px; }
          .text-silver { color: #ccc !important; }

          /* ── Colors ── */
          .text-gold { color: #d4af37 !important; }
          .bg-gold  { background-color: #d4af37 !important; }

          /* ── Buttons ── */
          .btn-gold { background: #d4af37; color: #000 !important; border: none; }
          .btn-gold:hover { background: #f1c40f; color: #000 !important; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(212,175,55,0.3); }
          .btn-gold:disabled { background: #7a6520; color: #555 !important; }

          .btn-dark { background: rgba(255,255,255,0.05); color: #ccc !important; border: 1px solid rgba(255,255,255,0.08); }
          .btn-dark:hover { background: rgba(255,255,255,0.1); color: #fff !important; }

          .btn-close-custom { background: none; border: none; color: #666; cursor: pointer; transition: color 0.2s; }
          .btn-close-custom:hover { color: #fff; }

          /* ── Section button cards (issuers / market type) ── */
          .btn.bg-dark.bg-opacity-40 { color: #ccc !important; }
          .btn.bg-dark.bg-opacity-60 { color: #ccc !important; }

          /* ── Miscellaneous ── */
          .shadow-gold-lg { box-shadow: 0 10px 30px rgba(212,175,55,0.3); }
          .form-check-input:checked { background-color: #d4af37; border-color: #d4af37; }

          /* ── Outline buttons inside liquidity row ── */
          .btn-outline-secondary { color: #ccc !important; border-color: #555 !important; }
          .btn-outline-secondary:hover { background: rgba(255,255,255,0.08); color: #fff !important; }
        `}</style>
      </>
    )
  }

export default MeetingModal