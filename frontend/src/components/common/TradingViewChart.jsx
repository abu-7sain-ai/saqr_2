import React, { useMemo } from 'react'

const TradingViewChart = ({ pair = 'BTC/USDT', timeframe = '60', height = 400 }) => {
  const cleanSymbol = useMemo(() => {
    if (!pair) return 'BTCUSDT'
    return pair.replace('/', '').replace('-', '').toUpperCase()
  }, [pair])

  const iframeSrc = useMemo(() => {
    const symbol = `BINANCE:${cleanSymbol}`
    const tf = timeframe || '60'
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(
      symbol
    )}&interval=${tf}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=0f1015&theme=dark&style=1&timezone=Etc%2FUTC&locale=ar_AE&studies=[]`
  }, [cleanSymbol, timeframe])

  return (
    <div
      className="w-100 rounded-4 overflow-hidden position-relative shadow-lg"
      style={{
        height: `${height}px`,
        background: '#0a0b0e',
        border: '1px solid rgba(212, 175, 55, 0.25)'
      }}
    >
      <iframe
        title={`TradingView Chart ${pair}`}
        src={iframeSrc}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block'
        }}
        allowTransparency="true"
        scrolling="no"
        allowFullScreen
      />
    </div>
  )
}

export default TradingViewChart
