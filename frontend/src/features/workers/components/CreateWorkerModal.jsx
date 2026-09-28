import React, { useState } from 'react'
import {
  LineChart,
  Sparkles,
  Sliders,
  TrendingUp,
  Shield,
  Play,
  X,
  Zap,
  Layers
} from 'lucide-react'
import { workerService } from '../services/workerService'
import TradingViewChart from '../../../components/common/TradingViewChart'

// Same coin groups as MeetingModal (اجتماع الخبراء)
const COIN_GROUPS = [
  {
    id: 'leaders',
    name: '🔵 القادة',
    description: 'العملات القيادية الأعلى سيولة (BTC, ETH, SOL, BNB...)',
    color: '#3b82f6',
    symbols: ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT']
  },
  {
    id: 'layer1',
    name: '🟢 الطبقة الأولى',
    description: 'بلوكتشينات الجيل القادم (ADA, AVAX, DOT, NEAR, SUI, TON...)',
    color: '#22c55e',
    symbols: ['ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'NEAR/USDT', 'ATOM/USDT', 'ICP/USDT', 'SUI/USDT', 'TON/USDT', 'FTM/USDT', 'HBAR/USDT', 'TIA/USDT', 'SEI/USDT']
  },
  {
    id: 'defi_layer2',
    name: '🟡 DeFi والطبقة الثانية',
    description: 'بروتوكولات التمويل اللامركزي (ARB, OP, LINK, RENDER...)',
    color: '#eab308',
    symbols: ['ARB/USDT', 'OP/USDT', 'LINK/USDT', 'GRT/USDT', 'STX/USDT', 'RENDER/USDT', 'WLD/USDT', 'PYTH/USDT']
  },
  {
    id: 'classic',
    name: '⚪ الكلاسيكيات',
    description: 'العملات الكلاسيكية الموثوقة (XRP, LTC, DOGE, TRX...)',
    color: '#94a3b8',
    symbols: ['XRP/USDT', 'LTC/USDT', 'BCH/USDT', 'XLM/USDT', 'ETC/USDT', 'DOGE/USDT', 'TRX/USDT', 'VET/USDT', 'FIL/USDT']
  }
]

const CreateWorkerModal = ({ isOpen, onClose, onCreated }) => {
  const [activeTab, setActiveTab] = useState('chart') // 'chart' | 'nocode' | 'ai_prompt'
  const [submitting, setSubmitting] = useState(false)

  // Chart Tab State (100% Free Live Candlestick Trading)
  const [chartMode, setChartMode] = useState('dip_rebound')
  const [chartTimeframe, setChartTimeframe] = useState('60')

  // Shared Form State
  const [name, setName] = useState('')
  const [workerType, setWorkerType] = useState('paper')
  const [marketType, setMarketType] = useState('stable')
  const [pair, setPair] = useState('BTC/USDT')
  const [capital, setCapital] = useState(1000)
  const [tradeSizing, setTradeSizing] = useState(10)
  const [maxTrades, setMaxTrades] = useState(3)
  const [tpValue, setTpValue] = useState(3.0)
  const [slValue, setSlValue] = useState(1.5)

  // Coin selection for NoCode/AI tabs — multi-coin selection supported
  const [selectedCoinGroup, setSelectedCoinGroup] = useState('leaders')
  const [selectedCoins, setSelectedCoins] = useState(['BTC/USDT'])

  // AI Prompt Tab State
  const [promptText, setPromptText] = useState('')
  const [parsingPrompt, setParsingPrompt] = useState(false)
  const [parsedPreview, setParsedPreview] = useState(null)

  // No-Code Builder Tab State
  const [nocodeRules, setNocodeRules] = useState({
    entry_rules: {
      rsi_condition: 'below',
      rsi_value: 30,
      macd_condition: 'cross_up',
      ema_condition: 'above',
      ema_period: 200,
      bb_condition: 'none',
      volume_filter: false
    },
    exit_rules: {
      rsi_condition: 'above',
      rsi_value: 70,
      tp_pct: 3.0,
      sl_pct: 1.5,
      macd_condition: 'cross_down',
      bb_condition: 'none'
    }
  })

  if (!isOpen) return null

  // Pre-made AI prompt templates
  const promptTemplates = [
    {
      title: 'ارتداد RSI وتشبع بيعي',
      text: 'شراء عند وصول الـ RSI إلى ما دون 30 والماكد يقطع لأعلى، والخروج بربح 3% أو وقف خسارة 1.5% أو عند وصول RSI إلى 70'
    },
    {
      title: 'اتباع الاتجاه الصاعد (EMA 200)',
      text: 'شراء إذا كان السعر فوق متوسط EMA 200 والماكد إيجابي مع تشبع بيعي RSI تحت 40، وأخذ الربح عند 4% ووقف الخسارة عند 2%'
    },
    {
      title: 'ارتداد من حدود البولنجر باوند',
      text: 'شراء عند ملامسة السعر للحد السفلي لمؤشر بولنجر باوند وRSI أقل من 35، والخروج عند ملامسة الحد العلوي أو ربح 3%'
    }
  ]

  const handleParsePrompt = async () => {
    if (!promptText.trim()) return
    setParsingPrompt(true)
    try {
      const res = await workerService.parsePrompt(promptText)
      if (res?.rules) {
        setParsedPreview(res.rules)
      }
    } catch (err) {
      alert('خطأ أثناء تحليل الاستراتيجية: ' + err.message)
    } finally {
      setParsingPrompt(false)
    }
  }

  // Toggle single coin selection
  const toggleCoin = (coin) => {
    setSelectedCoins((prev) =>
      prev.includes(coin)
        ? prev.filter((c) => c !== coin)
        : [...prev, coin]
    )
  }

  // Select all coins in a group
  const handleSelectAllInGroup = (symbols) => {
    setSelectedCoins((prev) => Array.from(new Set([...prev, ...symbols])))
  }

  // Deselect all coins in a group
  const handleDeselectAllInGroup = (symbols) => {
    setSelectedCoins((prev) => prev.filter((c) => !symbols.includes(c)))
  }

  // Clear all selections
  const handleClearAllCoins = () => {
    setSelectedCoins([])
  }

  // Summary label for coins
  const getCoinsSummaryText = () => {
    if (selectedCoins.length === 0) return 'لا توجد عملة مختارة'
    if (selectedCoins.length === 1) return selectedCoins[0]
    const preview = selectedCoins.slice(0, 3).map((c) => c.split('/')[0]).join(', ')
    return `${selectedCoins.length} عملات (${preview}${selectedCoins.length > 3 ? '...' : ''})`
  }

  // Placeholder for worker name
  const getPlaceholderName = () => {
    if (activeTab === 'chart') return `موظف شارت ${pair}`
    const summary = getCoinsSummaryText()
    if (activeTab === 'ai_prompt') return `موظف ذكي ${summary}`
    return `موظف قواعد ${summary}`
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setSubmitting(true)
    try {
      const isChart = activeTab === 'chart'
      const activeCoins = isChart ? [pair] : selectedCoins

      if (!isChart && activeCoins.length === 0) {
        alert('يرجى اختيار عملة واحدة على الأقل لإنشاء الموظف')
        setSubmitting(false)
        return
      }

      const activePair = isChart
        ? pair
        : activeCoins.length === 1
        ? activeCoins[0]
        : activeCoins.join(', ')

      const defaultName = getPlaceholderName()

      const payload = {
        name: name.trim() || defaultName,
        strategy_source: activeTab,
        type: workerType,
        market_type: marketType,
        owner: 'prince',
        starting_capital: parseFloat(capital) || 1000,
        pair: activePair,
        pairs: activeCoins,
        settings: {
          tpValue: parseFloat(tpValue) || 3.0,
          slValue: parseFloat(slValue) || 1.5,
          tradeSizingValue: parseFloat(tradeSizing) || 10,
          maxOpenTradesValue: parseInt(maxTrades) || 3,
          symbol: activeCoins.length === 1 ? activeCoins[0] : 'MULTI',
          symbols: activeCoins,
          target_symbols: activeCoins
        },
        strategy_config: {}
      }

      if (activeTab === 'chart') {
        payload.strategy_config = {
          chart_mode: chartMode,
          timeframe: chartTimeframe
        }
      } else if (activeTab === 'ai_prompt') {
        payload.strategy_config = {
          prompt: promptText.trim()
        }
      } else if (activeTab === 'nocode') {
        payload.strategy_config = {
          rules: nocodeRules
        }
      }

      const res = await workerService.createWorker(payload)
      if (onCreated) {
        onCreated(res.worker)
      }
      onClose()
    } catch (err) {
      alert('خطأ أثناء إنشاء الموظف: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Reusable coin group + multi-coin picker component for AI & NoCode tabs
  const renderCoinGroupPicker = () => {
    const activeGroup = COIN_GROUPS.find((g) => g.id === selectedCoinGroup) || COIN_GROUPS[0]
    const groupSelectedCount = activeGroup.symbols.filter((s) => selectedCoins.includes(s)).length
    const isAllGroupSelected = groupSelectedCount === activeGroup.symbols.length && activeGroup.symbols.length > 0

    return (
      <div className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <label className="extra-small text-gold fw-bold d-flex align-items-center gap-1 m-0">
            <Layers size={14} /> اختر مجموعة العملات ثم حدد عملة واحدة أو أكثر لتشغيل الموظف
          </label>
          <span className="badge bg-gold bg-opacity-15 text-gold border border-gold border-opacity-25 extra-small">
            إجمالي العملات المختارة: {selectedCoins.length}
          </span>
        </div>

        {/* Group cards */}
        <div className="row g-2 mb-3">
          {COIN_GROUPS.map((g) => {
            const isViewing = selectedCoinGroup === g.id
            const countSelected = g.symbols.filter((s) => selectedCoins.includes(s)).length
            return (
              <div key={g.id} className="col-6 col-md-3">
                <div
                  onClick={() => setSelectedCoinGroup(g.id)}
                  className="p-2 rounded-3 border transition-all h-100 position-relative"
                  style={{
                    cursor: 'pointer',
                    background: isViewing ? 'rgba(212, 175, 55, 0.12)' : 'rgba(255,255,255,0.03)',
                    borderColor: isViewing ? (g.color || '#d4af37') : 'rgba(255,255,255,0.08)',
                    boxShadow: isViewing ? '0 0 12px rgba(212, 175, 55, 0.2)' : 'none'
                  }}
                >
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="small fw-bold text-white">{g.name}</span>
                    <span
                      className="badge"
                      style={{
                        background: isViewing ? (g.color || '#d4af37') : 'rgba(255,255,255,0.1)',
                        color: isViewing ? '#000' : '#ccc',
                        fontSize: '10px'
                      }}
                    >
                      {g.symbols.length}
                    </span>
                  </div>
                  <div className="extra-small text-secondary" style={{ fontSize: '11px', lineHeight: 1.3 }}>
                    {g.description}
                  </div>
                  {countSelected > 0 && (
                    <div className="mt-2 pt-1 border-top border-white border-opacity-10 d-flex justify-content-between align-items-center">
                      <span className="extra-small fw-bold text-emerald" style={{ fontSize: '10px' }}>
                        ✓ {countSelected} عملة محددة
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Active Group Coins & Controls */}
        <div
          className="p-3 rounded-3 mb-3 border border-white border-opacity-10"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2 pb-2 border-bottom border-white border-opacity-5">
            <span className="extra-small text-silver fw-bold">
              عملات {activeGroup.name} (اضغط على أي عملة لتحديدها أو إلغائها):
            </span>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  isAllGroupSelected
                    ? handleDeselectAllInGroup(activeGroup.symbols)
                    : handleSelectAllInGroup(activeGroup.symbols)
                }
                className="btn btn-outline-gold btn-sm extra-small py-1 px-2 rounded-2"
                style={{ fontSize: '11px' }}
              >
                {isAllGroupSelected ? '✕ إلغاء تحديد المجموعة' : `✓ تحديد كل عملات (${activeGroup.symbols.length})`}
              </button>
            </div>
          </div>

          {/* Coin chips from active group */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {activeGroup.symbols.map((coin) => {
              const isSelected = selectedCoins.includes(coin)
              return (
                <button
                  key={coin}
                  type="button"
                  onClick={() => toggleCoin(coin)}
                  className={`btn btn-sm rounded-pill extra-small px-3 py-1 transition-all ${
                    isSelected
                      ? 'fw-bold shadow-sm'
                      : 'btn-outline-secondary text-silver border-opacity-25'
                  }`}
                  style={{
                    fontSize: '11px',
                    background: isSelected ? (activeGroup.color || '#d4af37') : 'transparent',
                    color: isSelected ? '#000' : '#d1d5db',
                    borderColor: isSelected ? (activeGroup.color || '#d4af37') : 'rgba(255,255,255,0.15)',
                    boxShadow: isSelected ? '0 0 10px rgba(212, 175, 55, 0.3)' : 'none'
                  }}
                >
                  {isSelected ? `✓ ${coin}` : `+ ${coin}`}
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected Coins Summary Box */}
        {selectedCoins.length > 0 ? (
          <div
            className="p-3 rounded-3"
            style={{
              background: 'rgba(212, 175, 55, 0.06)',
              border: '1px dashed rgba(212, 175, 55, 0.3)'
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="extra-small text-gold fw-bold d-flex align-items-center gap-2">
                <Zap size={14} className="text-gold" />
                <span>
                  العملات المحددة للموظف ({selectedCoins.length}):
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearAllCoins}
                className="btn btn-link text-danger p-0 extra-small text-decoration-none"
                style={{ fontSize: '11px' }}
              >
                مسح الكل
              </button>
            </div>

            <div className="d-flex flex-wrap gap-1 mb-2">
              {selectedCoins.map((coin) => (
                <span
                  key={coin}
                  className="badge rounded-pill d-inline-flex align-items-center gap-1 extra-small px-2 py-1"
                  style={{
                    background: 'rgba(212, 175, 55, 0.15)',
                    color: '#facc15',
                    border: '1px solid rgba(212, 175, 55, 0.3)'
                  }}
                >
                  {coin}
                  <X
                    size={12}
                    className="cursor-pointer opacity-75 hover-opacity-100"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCoin(coin)
                    }}
                  />
                </span>
              ))}
            </div>

            <div className="extra-small text-secondary" style={{ fontSize: '10.5px' }}>
              💡 سيقوم الموظف بمراقبة هذه العملات والبحث عن فرص الدخول والخروج المناسبة وفق شروط الاستراتيجية.
            </div>
          </div>
        ) : (
          <div
            className="p-2 rounded-2 text-center extra-small text-warning"
            style={{
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.25)'
            }}
          >
            ⚠️ لم يتم اختيار أي عملة. يرجى الضغط على العملات أعلاه لتحديد العملات التي سيتداول عليها الموظف.
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="cr-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="cr-container shadow-lg"
        style={{ maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center p-4 border-bottom border-white border-opacity-10">
          <div className="d-flex align-items-center gap-3">
            <div className="p-3 bg-gold bg-opacity-10 rounded-4 text-gold">
              <TrendingUp size={24} />
            </div>
            <div>
              <h4 className="m-0 text-gold fw-black">إنشاء موظف تداول جديد</h4>
              <p className="m-0 text-secondary extra-small mt-1">
                اختر طريقة تشغيل الموظف: شارت مباشر لحظي، منشئ القواعد، أو ذكاء اصطناعي
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn text-secondary p-0 border-0 fs-3">
            <X size={24} />
          </button>
        </div>

        <div>
          {/* Strategy Source Tabs */}
          <div className="d-flex p-3 gap-2 border-bottom border-white border-opacity-10 bg-black bg-opacity-20 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`btn flex-grow-1 p-3 rounded-3 d-flex align-items-center justify-content-center gap-2 border transition-all ${
                activeTab === 'chart'
                  ? 'btn-gold text-black fw-black shadow-gold'
                  : 'btn-outline-secondary text-secondary'
              }`}
            >
              <LineChart size={18} />
              <span>1. من الشارت مباشرة (مجاني 100%)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('nocode')}
              className={`btn flex-grow-1 p-3 rounded-3 d-flex align-items-center justify-content-center gap-2 border transition-all ${
                activeTab === 'nocode'
                  ? 'btn-gold text-black fw-black shadow-gold'
                  : 'btn-outline-secondary text-secondary'
              }`}
            >
              <Sliders size={18} />
              <span>2. منشئ القواعد (No-Code)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai_prompt')}
              className={`btn flex-grow-1 p-3 rounded-3 d-flex align-items-center justify-content-center gap-2 border transition-all ${
                activeTab === 'ai_prompt'
                  ? 'btn-gold text-black fw-black shadow-gold'
                  : 'btn-outline-secondary text-secondary'
              }`}
            >
              <Sparkles size={18} />
              <span>3. الذكاء الاصطناعي (AI Prompt)</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4">
            {/* Tab 0: Live Chart Builder (100% Free) */}
            {activeTab === 'chart' && (
              <div className="mb-4 animate-fade-in">
                <div className="p-4 rounded-4 bg-black bg-opacity-30 border border-white border-opacity-10 mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                    <div>
                      <h5 className="text-white fw-bold m-0 d-flex align-items-center gap-2">
                        <LineChart size={20} className="text-gold" /> شارت الشموع اللحظي المباشر
                      </h5>
                      <p className="text-secondary small m-0 mt-1">
                        شاهد الشارت الفعلي لحظة بلحظة، وحدد أسلوب التداول ليقوم الموظف بمراقبة الشارت والتنفيذ تلقائياً
                      </p>
                    </div>

                    {/* Timeframe selector */}
                    <div className="d-flex align-items-center gap-1 bg-dark p-1 rounded-3 border border-secondary border-opacity-50">
                      {[
                        { label: '15 دقيقة', val: '15' },
                        { label: '1 ساعة', val: '60' },
                        { label: '4 ساعات', val: '240' },
                        { label: 'يومي', val: 'D' }
                      ].map((tf) => (
                        <button
                          key={tf.val}
                          type="button"
                          onClick={() => setChartTimeframe(tf.val)}
                          className={`btn btn-sm px-2 py-1 extra-small rounded-2 ${
                            chartTimeframe === tf.val ? 'btn-gold text-black fw-bold' : 'text-secondary'
                          }`}
                        >
                          {tf.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Coin Chips */}
                  <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                    <span className="extra-small text-silver fw-bold">العملات الشائعة:</span>
                    {['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT', 'AVAX/USDT'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setPair(c)}
                        className={`btn btn-sm rounded-pill extra-small px-3 ${
                          pair === c ? 'btn-gold text-black fw-bold shadow-sm' : 'btn-outline-secondary text-silver'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                    <div className="ms-auto d-flex align-items-center gap-2">
                      <span className="extra-small text-secondary">أو اكتب زوج:</span>
                      <input
                        type="text"
                        value={pair}
                        onChange={(e) => setPair(e.target.value.toUpperCase())}
                        className="form-control form-control-sm bg-dark border-secondary text-white font-monospace"
                        style={{ width: '120px' }}
                        placeholder="BTC/USDT"
                      />
                    </div>
                  </div>

                  {/* Live TradingView Widget */}
                  <div className="mb-4">
                    <TradingViewChart pair={pair} timeframe={chartTimeframe} height={420} />
                  </div>

                  {/* Strategy Mode Cards */}
                  <h6 className="text-gold fw-bold mb-3 small d-flex align-items-center gap-2">
                    <Zap size={16} /> اختر أسلوب تداول الموظف على هذا الشارت:
                  </h6>
                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div
                        onClick={() => setChartMode('dip_rebound')}
                        className={`p-3 rounded-4 border transition-all h-100 ${
                          chartMode === 'dip_rebound'
                            ? 'border-gold bg-gold bg-opacity-10 shadow-gold'
                            : 'border-secondary border-opacity-30 bg-dark'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="p-2 rounded-circle bg-success bg-opacity-20 text-success">🟢</span>
                          <span className="text-white fw-bold small">ارتداد القاع (Dip Rebound)</span>
                        </div>
                        <p className="extra-small text-secondary mb-0">
                          اقتناص فرصة الشراء لما المؤشرات تفرغ (RSI &lt; 35) والماكد يلف صاعد، والبيع عند الارتفاع.
                        </p>
                      </div>
                    </div>

                    <div className="col-12 col-md-4">
                      <div
                        onClick={() => setChartMode('breakout')}
                        className={`p-3 rounded-4 border transition-all h-100 ${
                          chartMode === 'breakout'
                            ? 'border-gold bg-gold bg-opacity-10 shadow-gold'
                            : 'border-secondary border-opacity-30 bg-dark'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="p-2 rounded-circle bg-warning bg-opacity-20 text-warning">🚀</span>
                          <span className="text-white fw-bold small">اختراق وترند (Breakout)</span>
                        </div>
                        <p className="extra-small text-secondary mb-0">
                          الشراء مع كسر السعر لمتوسطات الحركة (EMA 50) وتأكيد قوة الزخم واستمرار الصعود.
                        </p>
                      </div>
                    </div>

                    <div className="col-12 col-md-4">
                      <div
                        onClick={() => setChartMode('scalping')}
                        className={`p-3 rounded-4 border transition-all h-100 ${
                          chartMode === 'scalping'
                            ? 'border-gold bg-gold bg-opacity-10 shadow-gold'
                            : 'border-secondary border-opacity-30 bg-dark'
                        }`}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-2">
                          <span className="p-2 rounded-circle bg-info bg-opacity-20 text-info">⚡</span>
                          <span className="text-white fw-bold small">اسكالبينج سريع (Scalp)</span>
                        </div>
                        <p className="extra-small text-secondary mb-0">
                          خطف أرباح سريعة عند أطراف البولنجر باوند بأهداف محكمة وأمان عالي لرأس المال.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: AI Prompt */}
            {activeTab === 'ai_prompt' && (
              <div className="mb-4 animate-fade-in">
                <div className="p-4 rounded-4 bg-black bg-opacity-30 border border-white border-opacity-10 mb-4">
                  <h5 className="text-white fw-bold mb-2 d-flex align-items-center gap-2">
                    <Sparkles size={20} className="text-gold" /> اكتب شروطك بالكلام الطبيعي
                  </h5>
                  <p className="text-secondary small mb-3">
                    اكتب شروط الدخول والخروج التي تفضلها بالعربي أو الإنجليزي، وسيقوم الذكاء الاصطناعي بتحويلها لقواعد كمية دقيقة تنفذ تلقائياً.
                  </p>

                  {/* Coin Group Picker */}
                  {renderCoinGroupPicker()}

                  {/* Pre-made chips */}
                  <div className="mb-3">
                    <span className="extra-small text-secondary fw-bold d-block mb-2">نماذج استراتيجيات جاهزة:</span>
                    <div className="d-flex flex-wrap gap-2">
                      {promptTemplates.map((t, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setPromptText(t.text)
                            setParsedPreview(null)
                          }}
                          className="btn btn-outline-secondary btn-sm rounded-pill extra-small text-silver border-opacity-25"
                        >
                          ⚡ {t.title}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3">
                    <textarea
                      rows={4}
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      placeholder="مثال: اشترِ لما الـ RSI يكون أقل من 30 والماكد يتقاطع إيجابياً، واخرج لما نكسب 4% أو نخسر 2% أو لما الـ RSI يوصل 70..."
                      className="form-control bg-dark border-secondary text-white"
                    />
                  </div>

                  <div className="d-flex justify-content-between align-items-center">
                    <button
                      type="button"
                      onClick={handleParsePrompt}
                      disabled={parsingPrompt || !promptText.trim()}
                      className="btn btn-outline-gold d-flex align-items-center gap-2 px-3 py-2 small"
                    >
                      <Sparkles size={16} />
                      {parsingPrompt ? 'جاري التحليل بالذكاء الاصطناعي...' : 'معاينة القواعد المستخرجة 🪄'}
                    </button>

                    {parsedPreview && (
                      <span className="text-emerald small fw-bold">
                        ✅ تم استخراج القواعد بنجاح!
                      </span>
                    )}
                  </div>

                  {/* Preview box */}
                  {parsedPreview && (
                    <div className="mt-3 p-3 bg-dark rounded-3 border border-emerald border-opacity-30 extra-small font-monospace">
                      <div className="text-emerald fw-bold mb-1">شروط الدخول المستخرجة:</div>
                      <div className="text-silver mb-2">{JSON.stringify(parsedPreview.entry_rules || parsedPreview.entry, null, 2)}</div>
                      <div className="text-gold fw-bold mb-1">شروط الخروج المستخرجة:</div>
                      <div className="text-silver">{JSON.stringify(parsedPreview.exit_rules || parsedPreview.exit, null, 2)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: No-Code Builder */}
            {activeTab === 'nocode' && (
              <div className="mb-4 animate-fade-in">
                <div className="p-4 rounded-4 bg-black bg-opacity-30 border border-white border-opacity-10 mb-4">
                  <h5 className="text-white fw-bold mb-2 d-flex align-items-center gap-2">
                    <Sliders size={20} className="text-gold" /> منشئ الاستراتيجيات بدون كود
                  </h5>
                  <p className="text-secondary small mb-4">
                    اختر المؤشرات والشروط من القوائم المنسدلة لبناء استراتيجية مخصصة بالكامل.
                  </p>

                  {/* Coin Group Picker */}
                  {renderCoinGroupPicker()}

                  <h6 className="text-gold fw-bold mb-3 small">1. شروط الدخول (Entry Conditions):</h6>
                  <div className="row g-3 mb-4">
                    {/* RSI */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">مؤشر القوة النسبية (RSI)</label>
                      <div className="input-group">
                        <select
                          className="form-select bg-dark border-secondary text-white small"
                          value={nocodeRules.entry_rules.rsi_condition}
                          onChange={(e) =>
                            setNocodeRules({
                              ...nocodeRules,
                              entry_rules: { ...nocodeRules.entry_rules, rsi_condition: e.target.value }
                            })
                          }
                        >
                          <option value="none">معطل</option>
                          <option value="below">أقل من (تشبع بيعي)</option>
                          <option value="above">أعلى من (زخم قوي)</option>
                        </select>
                        {nocodeRules.entry_rules.rsi_condition !== 'none' && (
                          <input
                            type="number"
                            className="form-control bg-dark border-secondary text-white small"
                            style={{ maxWidth: '80px' }}
                            value={nocodeRules.entry_rules.rsi_value}
                            onChange={(e) =>
                              setNocodeRules({
                                ...nocodeRules,
                                entry_rules: { ...nocodeRules.entry_rules, rsi_value: parseFloat(e.target.value) }
                              })
                            }
                          />
                        )}
                      </div>
                    </div>

                    {/* MACD */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">مؤشر MACD</label>
                      <select
                        className="form-select bg-dark border-secondary text-white small"
                        value={nocodeRules.entry_rules.macd_condition}
                        onChange={(e) =>
                          setNocodeRules({
                            ...nocodeRules,
                            entry_rules: { ...nocodeRules.entry_rules, macd_condition: e.target.value }
                          })
                        }
                      >
                        <option value="none">معطل</option>
                        <option value="cross_up">تقاطع صاعد (Bullish Cross)</option>
                        <option value="above_signal">فوق خط الإشارة (إيجابي)</option>
                      </select>
                    </div>

                    {/* EMA Trend */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">فلتر الاتجاه (EMA Trend)</label>
                      <div className="input-group">
                        <select
                          className="form-select bg-dark border-secondary text-white small"
                          value={nocodeRules.entry_rules.ema_condition}
                          onChange={(e) =>
                            setNocodeRules({
                              ...nocodeRules,
                              entry_rules: { ...nocodeRules.entry_rules, ema_condition: e.target.value }
                            })
                          }
                        >
                          <option value="none">معطل</option>
                          <option value="above">السعر أعلى من المتوسط (صاعد)</option>
                          <option value="below">السعر أسفل من المتوسط (هابط)</option>
                        </select>
                        {nocodeRules.entry_rules.ema_condition !== 'none' && (
                          <select
                            className="form-select bg-dark border-secondary text-white small"
                            style={{ maxWidth: '90px' }}
                            value={nocodeRules.entry_rules.ema_period}
                            onChange={(e) =>
                              setNocodeRules({
                                ...nocodeRules,
                                entry_rules: { ...nocodeRules.entry_rules, ema_period: parseInt(e.target.value) }
                              })
                            }
                          >
                            <option value="20">EMA 20</option>
                            <option value="50">EMA 50</option>
                            <option value="100">EMA 100</option>
                            <option value="200">EMA 200</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Bollinger Bands */}
                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">البولنجر باوند (Bollinger Bands)</label>
                      <select
                        className="form-select bg-dark border-secondary text-white small"
                        value={nocodeRules.entry_rules.bb_condition}
                        onChange={(e) =>
                          setNocodeRules({
                            ...nocodeRules,
                            entry_rules: { ...nocodeRules.entry_rules, bb_condition: e.target.value }
                          })
                        }
                      >
                        <option value="none">معطل</option>
                        <option value="touch_lower">ملامسة أو كسر الحد السفلي</option>
                        <option value="touch_upper">ملامسة أو كسر الحد العلوي</option>
                      </select>
                    </div>
                  </div>

                  <h6 className="text-gold fw-bold mb-3 small">2. شروط الخروج الفنية (Exit Conditions):</h6>
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">الخروج عند تشبع RSI</label>
                      <div className="input-group">
                        <select
                          className="form-select bg-dark border-secondary text-white small"
                          value={nocodeRules.exit_rules.rsi_condition}
                          onChange={(e) =>
                            setNocodeRules({
                              ...nocodeRules,
                              exit_rules: { ...nocodeRules.exit_rules, rsi_condition: e.target.value }
                            })
                          }
                        >
                          <option value="none">معطل</option>
                          <option value="above">أعلى من (تشبع شرائي)</option>
                        </select>
                        {nocodeRules.exit_rules.rsi_condition !== 'none' && (
                          <input
                            type="number"
                            className="form-control bg-dark border-secondary text-white small"
                            style={{ maxWidth: '80px' }}
                            value={nocodeRules.exit_rules.rsi_value}
                            onChange={(e) =>
                              setNocodeRules({
                                ...nocodeRules,
                                exit_rules: { ...nocodeRules.exit_rules, rsi_value: parseFloat(e.target.value) }
                              })
                            }
                          />
                        )}
                      </div>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label text-silver small">الخروج بتقاطع MACD سلبي</label>
                      <select
                        className="form-select bg-dark border-secondary text-white small"
                        value={nocodeRules.exit_rules.macd_condition}
                        onChange={(e) =>
                          setNocodeRules({
                            ...nocodeRules,
                            exit_rules: { ...nocodeRules.exit_rules, macd_condition: e.target.value }
                          })
                        }
                      >
                        <option value="none">معطل</option>
                        <option value="cross_down">تقاطع هابط (Bearish Cross)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shared General Settings */}
            <div className="p-4 rounded-4 bg-black bg-opacity-20 border border-white border-opacity-10 mb-4">
              <h6 className="text-white fw-bold mb-3 small d-flex align-items-center gap-2">
                <Shield size={16} className="text-gold" /> إعدادات الحساب والمخاطرة المشتركة
              </h6>

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label className="form-label text-silver small fw-bold">اسم الموظف</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={getPlaceholderName()}
                    className="form-control bg-dark border-secondary text-white"
                  />
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label text-silver small fw-bold">نوع الحساب</label>
                  <select
                    value={workerType}
                    onChange={(e) => setWorkerType(e.target.value)}
                    className="form-select bg-dark border-secondary text-white"
                  >
                    <option value="paper">وهمي (Paper Demo)</option>
                    <option value="live">حقيقي (Live Trading)</option>
                  </select>
                </div>

                <div className="col-12 col-md-3">
                  <label className="form-label text-silver small fw-bold">بيئة السوق</label>
                  <select
                    value={marketType}
                    onChange={(e) => setMarketType(e.target.value)}
                    className="form-select bg-dark border-secondary text-white"
                  >
                    <option value="stable">مستقر (Stable)</option>
                    <option value="volatile">متوتر (Volatile)</option>
                  </select>
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label text-silver small fw-bold">رأس المال ($)</label>
                  <input
                    type="number"
                    value={capital}
                    onChange={(e) => setCapital(e.target.value)}
                    className="form-control bg-dark border-secondary text-white"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label text-silver small fw-bold">الهدف الربحي (TP %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={tpValue}
                    onChange={(e) => setTpValue(e.target.value)}
                    className="form-control bg-dark border-secondary text-white"
                  />
                </div>

                <div className="col-12 col-md-4">
                  <label className="form-label text-silver small fw-bold">وقف الخسارة (SL %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={slValue}
                    onChange={(e) => setSlValue(e.target.value)}
                    className="form-control bg-dark border-secondary text-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="d-flex justify-content-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline-secondary px-4 py-3 rounded-4"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || (activeTab !== 'chart' && selectedCoins.length === 0)}
                title={activeTab !== 'chart' && selectedCoins.length === 0 ? 'يرجى اختيار عملة واحدة على الأقل' : ''}
                className="btn btn-gold px-5 py-3 rounded-4 fw-black text-black shadow-gold d-flex align-items-center gap-2"
              >
                <Play size={18} />
                {submitting ? 'جاري الإنشاء والتشغيل...' : 'حفظ وتشغيل الموظف الآن 🚀'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .cr-overlay { 
          position: fixed !important; 
          top: 0 !important; 
          left: 0 !important; 
          right: 0 !important; 
          bottom: 0 !important; 
          background: rgba(0, 0, 0, 0.88) !important; 
          backdrop-filter: blur(20px) saturate(180%) !important; 
          -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
          z-index: 99999 !important; 
          display: flex !important; 
          align-items: center !important; 
          justify-content: center !important; 
          padding: 1.5rem !important;
        }
        .cr-container { 
          width: 100% !important; 
          max-width: 850px !important; 
          background: #0f1015 !important; 
          border: 1px solid rgba(212, 175, 55, 0.3) !important; 
          border-radius: 24px !important; 
          overflow-y: auto !important; 
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.95), 0 0 35px rgba(212, 175, 55, 0.15) !important;
          animation: crModalFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        @keyframes crModalFadeIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .shadow-gold {
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.35) !important;
        }
        .btn-outline-gold {
          border: 1px solid #d4af37 !important;
          color: #d4af37 !important;
        }
        .btn-outline-gold:hover {
          background: #d4af37 !important;
          color: #000 !important;
        }
        .text-gold { color: #d4af37 !important; }
        .text-silver { color: #c0c0c0 !important; }
        .text-emerald { color: #10b981 !important; }
        .bg-emerald { background-color: #10b981 !important; }
        .btn-outline-emerald {
          border: 1px solid #10b981 !important;
          color: #10b981 !important;
        }
        .btn-outline-emerald:hover {
          background: #10b981 !important;
          color: #000 !important;
        }
      `}</style>
    </div>
  )
}

export default CreateWorkerModal
