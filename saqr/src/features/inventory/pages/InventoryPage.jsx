import React, { useEffect, useState, useRef } from 'react'
import {
  Package,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  RefreshCcw,
  Info,
  CheckCircle2,
  XCircle,
  FileUp,
  Upload,
  Filter,
  Globe
} from 'lucide-react'
import { supabase } from '../../../services/supabase'

const InventoryPage = () => {
  const [coins, setCoins] = useState([])
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)

  // Selection & Loading
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [validating, setValidating] = useState(false)

  // Filtering & Selection
  const [filterMarketId, setFilterMarketId] = useState('all')
  const [targetMarketId, setTargetMarketId] = useState('')

  const [newCoin, setNewCoin] = useState({ symbol: '', name: '', market_id: '' })
  const [bulkInput, setBulkInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fileInputRef = useRef(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: mData, error: mError } = await supabase
        .from('markets')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true })

      if (mError) throw mError
      setMarkets(mData || [])

      if (mData.length > 0 && !targetMarketId) {
        setTargetMarketId(mData[0].id)
        setNewCoin((prev) => ({ ...prev, market_id: mData[0].id }))
      }

      const { data: cData, error: cError } = await supabase
        .from('halal_coins')
        .select('*, markets(name)')
        .order('symbol', { ascending: true })

      if (cError) throw cError
      setCoins(cData || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // التحقق من صحة العملة عبر Binance API
  const validateCoin = async (symbol) => {
    try {
      const cleanSymbol = symbol.toUpperCase().trim().replace('USDT', '')
      // محاولة التحقق من وجود الزوج مقابل USDT لضمان أنها عملة قابلة للتداول
      const response = await fetch(
        `https://api.binance.com/api/v3/exchangeInfo?symbol=${cleanSymbol}USDT`
      )

      if (!response.ok) {
        // محاولة ثانية للبحث عن الرمز مباشرة (في حال كان المستعرض في بيئة تمنع CORS أو غيره)
        try {
          const tickerResponse = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}USDT`
          )
          if (!tickerResponse.ok) return null

          return {
            symbol: cleanSymbol,
            name: cleanSymbol,
            logo: `https://bin.bnbstatic.com/static/assets/logos/${cleanSymbol}.png`
          }
        } catch {
          return null
        }
      }

      const data = await response.json()
      const symbolInfo = data.symbols ? data.symbols[0] : null

      return {
        symbol: cleanSymbol,
        name: symbolInfo ? symbolInfo.baseAsset : cleanSymbol,
        logo: `https://bin.bnbstatic.com/static/assets/logos/${cleanSymbol}.png`
      }
    } catch (err) {
      console.error('Validation error:', err)
      return null
    }
  }

  const handleAddCoin = async (e) => {
    e.preventDefault()
    if (!newCoin.symbol || !newCoin.market_id) {
      alert('يرجى اختيار السوق وإدخال رمز العملة')
      return
    }

    setSubmitting(true)
    setValidating(true)
    try {
      const coinData = await validateCoin(newCoin.symbol)
      if (!coinData) {
        alert(
          '⚠️ عذراً، لم نتمكن من العثور على هذه العملة في منصات التداول. يرجى التأكد من الرمز (مثلاً: BTC).'
        )
        setSubmitting(false)
        setValidating(false)
        return
      }

      // التحقق من التكرار
      const isDuplicate = coins.find(
        (c) => c.symbol === coinData.symbol && c.market_id === newCoin.market_id
      )
      if (isDuplicate) {
        alert('هذه العملة موجودة بالفعل في هذا السوق')
        setSubmitting(false)
        setValidating(false)
        return
      }

      const { error: insertError } = await supabase.from('halal_coins').insert([
        {
          symbol: coinData.symbol,
          name: coinData.name,
          logo_url: coinData.logo,
          active: true,
          market_id: newCoin.market_id
        }
      ])

      if (insertError) throw insertError

      setNewCoin({ symbol: '', name: '', market_id: markets[0]?.id || '' })
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error adding coin:', err)
      alert('خطأ في إضافة العملة: ' + (err.details || err.message))
    } finally {
      setSubmitting(false)
      setValidating(false)
    }
  }

  const handleBulkUpload = async (e) => {
    e.preventDefault()
    if (!targetMarketId) {
      alert('يرجى اختيار السوق المستهدف للرفع')
      return
    }

    const rawSymbols = bulkInput
      .split(/[\n,\s]+/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0)
    const uniqueSymbols = [...new Set(rawSymbols)]

    if (uniqueSymbols.length === 0) return

    setSubmitting(true)
    let addedCount = 0
    try {
      for (const symbol of uniqueSymbols) {
        const coinData = await validateCoin(symbol)
        if (coinData) {
          const { error: bulkError } = await supabase.from('halal_coins').upsert(
            {
              symbol: coinData.symbol,
              name: coinData.name,
              logo_url: coinData.logo,
              active: true,
              market_id: targetMarketId
            },
            { onConflict: 'symbol,market_id' }
          )

          if (!bulkError) addedCount++
        }
      }

      setBulkInput('')
      setIsBulkOpen(false)
      fetchData()
      alert(`تمت معالجة القائمة: تمت إضافة/تحديث ${addedCount} عملة بنجاح بعد التحقق منها.`)
    } catch (err) {
      alert('خطأ في الرفع الجماعي: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCoins.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCoins.map((c) => c.id)))
    }
  }

  const toggleSelect = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.size} عملة مختارة؟`)) return

    setLoading(true)
    try {
      const { error: deleteError } = await supabase
        .from('halal_coins')
        .delete()
        .in('id', Array.from(selectedIds))

      if (deleteError) throw deleteError
      setSelectedIds(new Set())
      fetchData()
    } catch (err) {
      alert('خطأ في الحذف الجماعي')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => setBulkInput(event.target.result)
    reader.readAsText(file)
  }

  const toggleStatus = async (id, currentStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('halal_coins')
        .update({ active: !currentStatus })
        .eq('id', id)
      if (updateError) throw updateError
      fetchData()
    } catch (err) {
      alert('خطأ في تحديث الحالة')
    }
  }

  const deleteCoin = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه العملة؟')) return
    try {
      const { error: deleteError } = await supabase.from('halal_coins').delete().eq('id', id)
      if (deleteError) throw deleteError
      fetchData()
    } catch (err) {
      alert('خطأ في الحذف')
    }
  }

  // تصفية العملات بناءً على السوق المختار
  const filteredCoins =
    filterMarketId === 'all' ? coins : coins.filter((c) => c.market_id === filterMarketId)

  return (
    <div className="container-fluid p-0 animate-fade-in" style={{ background: 'transparent' }}>
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3">
        <div>
          <h2
            className="m-0 saqr-title text-gold d-flex align-items-center gap-3"
            style={{ fontSize: '1.5rem' }}
          >
            <Package size={24} /> المستودع المركزي
          </h2>
          <p className="small text-silver opacity-75 m-0 mt-2 fs-6">
            إدارة قائمة العملات الحلال وتوزيعها على الأسواق المختلفة
          </p>
        </div>
        <div className="d-flex gap-3">
          {selectedIds.size > 0 && (
            <button
              onClick={bulkDelete}
              className="btn btn-ruby d-flex align-items-center gap-2 px-4 py-2 rounded-3 shadow-ruby animate-bounce-in"
            >
              <Trash2 size={20} /> حذف ({selectedIds.size})
            </button>
          )}

          <div
            className="glass-panel d-flex align-items-center px-3"
            style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.03)' }}
          >
            <Filter size={18} className="text-gold opacity-50 me-2" />
            <select
              className="form-select border-0 bg-transparent text-silver fw-bold py-2"
              style={{ width: '180px', cursor: 'pointer' }}
              value={filterMarketId}
              onChange={(e) => setFilterMarketId(e.target.value)}
            >
              <option value="all">جميع الأسواق</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id} className="bg-dark">
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsBulkOpen(true)}
            className="btn btn-outline-gold d-flex align-items-center gap-2 px-4 py-2 rounded-3 border-gold border-opacity-25"
          >
            <FileUp size={20} /> رفع جماعي
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-gold d-flex align-items-center gap-2 px-5 py-2 rounded-3 shadow-gold"
          >
            <Plus size={20} /> إضافة عملة
          </button>
        </div>
      </div>

      {/* Main Table Container */}
      <div
        className="glass-panel border-0 overflow-hidden"
        style={{ borderRadius: '28px', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}
      >
        <div className="table-responsive">
          <table
            className="table table-hover m-0 align-middle"
            style={{ background: 'rgba(10, 10, 15, 0.4)' }}
          >
            <thead>
              <tr style={{ background: 'rgba(255, 215, 0, 0.05)' }}>
                <th className="ps-4 py-4 border-0 text-center" style={{ width: '60px' }}>
                  <div className="form-check d-flex justify-content-center">
                    <input
                      type="checkbox"
                      className="form-check-input custom-checkbox"
                      checked={
                        filteredCoins.length > 0 && selectedIds.size === filteredCoins.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </div>
                </th>
                <th className="py-4 border-0 text-gold text-uppercase tracking-widest small">
                  العملة والرمز
                </th>
                <th className="py-4 border-0 text-gold text-uppercase tracking-widest small">
                  السوق المرتبط
                </th>
                <th className="py-4 border-0 text-gold text-uppercase tracking-widest small text-center">
                  الحالة التشغيلية
                </th>
                <th className="py-4 border-0 text-gold text-uppercase tracking-widest small text-center">
                  تاريخ التوثيق
                </th>
                <th className="pe-5 py-4 border-0 text-gold text-uppercase tracking-widest small text-end">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="border-0">
              {loading && coins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <RefreshCcw className="animate-spin text-gold mb-3" size={48} />
                    <div className="text-silver opacity-50">جاري تحميل المستودع...</div>
                  </td>
                </tr>
              ) : filteredCoins.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-5">
                    <AlertCircle className="text-gold opacity-25 mb-3" size={64} />
                    <div className="h4 text-silver opacity-50">لا توجد سجلات مطابقة</div>
                  </td>
                </tr>
              ) : (
                filteredCoins.map((coin) => (
                  <tr
                    key={coin.id}
                    className={`hover-row transition-all border-bottom border-white border-opacity-5 ${selectedIds.has(coin.id) ? 'bg-gold-5' : ''}`}
                  >
                    <td className="ps-4 py-4 text-center">
                      <div className="form-check d-flex justify-content-center">
                        <input
                          type="checkbox"
                          className="form-check-input custom-checkbox"
                          checked={selectedIds.has(coin.id)}
                          onChange={() => toggleSelect(coin.id)}
                        />
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="d-flex align-items-center gap-3">
                        <div
                          className="bg-dark rounded-circle border border-white border-opacity-10 overflow-hidden shadow-sm"
                          style={{ width: '45px', height: '45px' }}
                        >
                          {coin.logo_url ? (
                            <img
                              src={coin.logo_url}
                              alt={coin.symbol}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) =>
                                (e.target.src = `https://ui-avatars.com/api/?name=${coin.symbol}&background=d4af37&color=000`)
                              }
                            />
                          ) : (
                            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-gold fw-black small">
                              {coin.symbol[0]}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-white fw-black fs-5 text-uppercase d-flex align-items-center gap-2">
                            {coin.symbol}
                            {coin.active && (
                              <div
                                className="pulse-emerald rounded-circle"
                                style={{ width: '6px', height: '6px' }}
                              ></div>
                            )}
                          </div>
                          <div className="text-silver opacity-50 small fw-medium">{coin.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4">
                      <span
                        className="glass-card px-4 py-2 small fw-bold text-gold"
                        style={{
                          background: 'rgba(255, 215, 0, 0.03)',
                          borderColor: 'rgba(255, 215, 0, 0.1)'
                        }}
                      >
                        {coin.markets?.name || '---'}
                      </span>
                    </td>
                    <td className="py-4 text-center">
                      <button
                        onClick={() => toggleStatus(coin.id, coin.active)}
                        className={`badge-premium transition-all ${
                          coin.active
                            ? 'text-emerald border-emerald'
                            : 'text-ruby border-ruby opacity-40'
                        }`}
                        style={{ cursor: 'pointer', background: 'transparent' }}
                      >
                        {coin.active ? 'نشطة الآن' : 'متوقفة'}
                      </button>
                    </td>
                    <td className="py-4 text-center text-silver opacity-50 fw-medium">
                      {new Date(coin.created_at).toLocaleDateString('ar-EG', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="pe-5 py-4 text-end">
                      <button
                        onClick={() => deleteCoin(coin.id)}
                        className="btn btn-outline-ruby p-2 rounded-3 opacity-25 hover-opacity-100 transition-all border-0"
                      >
                        <Trash2 size={22} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Upload Modal Upgrade */}
      {isBulkOpen && (
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}
        >
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content glass-panel border-gold border-opacity-25 shadow-gold p-2">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-gold fw-bold d-flex align-items-center gap-2">
                    <FileUp size={24} /> رفع جماعي للأسواق
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsBulkOpen(false)}
                  ></button>
                </div>
                <form onSubmit={handleBulkUpload}>
                  <div className="modal-body p-4">
                    {/* Market Choice for Bulk */}
                    <div className="mb-4">
                      <label className="form-label small text-gold opacity-75 text-uppercase tracking-wider">
                        اختيار السوق المستهدف
                      </label>
                      <select
                        className="form-select saqr-input"
                        value={targetMarketId}
                        onChange={(e) => setTargetMarketId(e.target.value)}
                        required
                      >
                        <option value="" disabled>
                          اختر السوق المخصص لهذه القائمة...
                        </option>
                        {markets.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3 d-flex justify-content-between align-items-center">
                      <label className="form-label small text-gold opacity-75 text-uppercase tracking-wider m-0">
                        قائمة الرموز
                      </label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="btn btn-sm btn-outline-info d-flex align-items-center gap-2 px-3"
                      >
                        <Upload size={14} /> رفع ملف
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        accept=".txt,.csv"
                      />
                    </div>

                    <textarea
                      className="form-control saqr-input"
                      rows="6"
                      placeholder="BTC&#10;ETH&#10;SOL..."
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      required
                    ></textarea>
                  </div>
                  <div className="modal-footer border-0 pt-0 px-4 pb-4 gap-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary flex-grow-1"
                      onClick={() => setIsBulkOpen(false)}
                    >
                      تراجع
                    </button>
                    <button
                      type="submit"
                      className="btn btn-gold flex-grow-1 py-2 shadow-gold d-flex align-items-center justify-content-center gap-2"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <RefreshCcw size={18} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> تنفيذ الرفع بالسوق المختار
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Add Modal Upgrade */}
      {isModalOpen && (
        <div
          className="modal-backdrop fade show"
          style={{ zIndex: 1050, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)' }}
        >
          <div className="modal d-block" tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content glass-panel border-gold border-opacity-25 shadow-gold p-2">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title text-gold fw-bold d-flex align-items-center gap-2">
                    <CheckCircle2 size={24} /> إضافة عملة لسوق محدد
                  </h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setIsModalOpen(false)}
                  ></button>
                </div>
                <form onSubmit={handleAddCoin}>
                  <div className="modal-body p-4">
                    <div className="mb-4">
                      <label className="form-label small text-gold opacity-75 text-uppercase tracking-wider">
                        السوق (Market)
                      </label>
                      <select
                        className="form-select saqr-input"
                        value={newCoin.market_id}
                        onChange={(e) => setNewCoin({ ...newCoin, market_id: e.target.value })}
                        required
                      >
                        {markets.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="form-label small text-gold opacity-75 text-uppercase tracking-wider">
                        رمز التداول (Ticker)
                      </label>
                      <input
                        type="text"
                        placeholder="مثل: BTC"
                        className="form-control saqr-input"
                        value={newCoin.symbol}
                        onChange={(e) =>
                          setNewCoin({ ...newCoin, symbol: e.target.value.toUpperCase() })
                        }
                        required
                        autoFocus
                      />
                    </div>
                    <div className="mb-4">
                      <label className="form-label small text-gold opacity-75 text-uppercase tracking-wider">
                        الاسم (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="بيتكوين"
                        className="form-control saqr-input"
                        value={newCoin.name}
                        onChange={(e) => setNewCoin({ ...newCoin, name: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="modal-footer border-0 pt-0 px-4 pb-4 gap-3">
                    <button
                      type="button"
                      className="btn btn-outline-secondary flex-grow-1"
                      onClick={() => setIsModalOpen(false)}
                    >
                      تراجع
                    </button>
                    <button
                      type="submit"
                      className="btn btn-gold flex-grow-1 py-2 shadow-gold d-flex align-items-center justify-content-center gap-2"
                      disabled={submitting}
                    >
                      {validating ? (
                        <>
                          <RefreshCcw size={18} className="animate-spin" /> جاري التحقق من
                          Binance...
                        </>
                      ) : (
                        'تأكيد الحفظ'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .saqr-input { background: rgba(0,0,0,0.3) !important; border: 1px solid rgba(212, 175, 55, 0.2) !important; color: white !important; font-weight: bold; padding: 12px 15px !important; }
        .saqr-input:focus { border-color: #d4af37 !important; box-shadow: 0 0 0 0.25rem rgba(212, 175, 55, 0.1) !important; }
        .hover-row:hover { background: rgba(255,255,255,0.02); }
        .shadow-gold { box-shadow: 0 4px 15px rgba(212, 175, 55, 0.15); }
        .shadow-ruby { box-shadow: 0 10px 30px rgba(220, 53, 69, 0.2); }
        .bg-gold-5 { background: rgba(212, 175, 55, 0.05) !important; }
        
        .custom-checkbox { 
          width: 22px; height: 22px; border: 2px solid rgba(212, 175, 55, 0.3); 
          background: rgba(0,0,0,0.2); cursor: pointer; border-radius: 6px;
        }
        .custom-checkbox:checked { background-color: #d4af37; border-color: #d4af37; }
        
        .animate-spin { animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        @keyframes bounceIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        
        .pulse-emerald { background: #10b981; box-shadow: 0 0 10px #10b981; animation: pulse-e 2s infinite; }
        @keyframes pulse-e { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
      `}</style>
    </div>
  )
}

export default InventoryPage
