import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Bot, Shield, Brain, Sparkles, Loader2, X } from 'lucide-react'

const AdvisorChat = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'advisor',
      content:
        'أهلاً بك سيدي. أنا المستشار الرقابي لصقر. كيف يمكنني مساعدتك في تحليل أداء المنصة اليوم؟'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMsg = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // Logic to call backend /api/advisor/chat
      const defaultBackend =
        window.location.hostname === 'localhost'
          ? 'http://localhost:8000'
          : `http://${window.location.hostname}:8000`
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || defaultBackend

      const response = await fetch(`${BACKEND_URL}/api/advisor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input })
      })

      const data = await response.json()

      if (!response.ok) {
        const errMsg = data?.detail?.message || data?.detail || 'عذراً، واجهت مشكلة في الاتصال بالمستشار.'
        setMessages((prev) => [...prev, { role: 'advisor', content: errMsg }])
      } else {
        setMessages((prev) => [...prev, { role: 'advisor', content: data.reply }])
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'advisor', content: 'عذراً، واجهت مشكلة في الاتصال بالمركز الرقابي.' }
      ])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="advisor-chat-overlay">
        <div className="advisor-chat-panel animate-slide-up">
          <div className="advisor-header">
            <div className="d-flex align-items-center gap-2">
              <div className="advisor-avatar">
                <Shield size={18} className="text-gold" />
              </div>
              <div>
                <div className="fw-bold small text-white">المستشار الرقابي (Supervisor)</div>
                <div className="extra-small text-success d-flex align-items-center gap-1">
                  <div className="pulse-dot"></div> متصل - 1M Token Mode
                </div>
              </div>
            </div>
            <button onClick={onClose} className="btn-close-custom">
              <X size={18} />
            </button>
          </div>

          <div className="advisor-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg-wrapper ${m.role}`}>
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="msg-wrapper advisor">
                <div className="msg-bubble loading">
                  <Loader2 size={16} className="animate-spin" /> المستشار يفكر في سجلاتك...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="advisor-input-area">
            <input
              type="text"
              placeholder="اسأل المستشار عن الأداء، التناقضات، أو الاقتراحات..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <button onClick={handleSend} disabled={loading}>
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
          .advisor-chat-overlay { position: fixed; bottom: 80px; left: 20px; z-index: 2000; width: 400px; max-width: calc(100vw - 40px); }
          .advisor-chat-panel { background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(20px); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 24px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); display: flex; flex-direction: column; height: 500px; overflow: hidden; }
          .advisor-header { padding: 15px 20px; background: rgba(212, 175, 55, 0.05); border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
          .advisor-avatar { width: 36px; height: 36px; background: rgba(212, 175, 55, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
          .pulse-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; box-shadow: 0 0 5px #10b981; animation: blink 1.5s infinite; }
          @keyframes blink { 0% { opacity: 0.3; } 50% { opacity: 1; } 100% { opacity: 0.3; } }
          
          .advisor-messages { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
          .msg-wrapper { display: flex; width: 100%; }
          .msg-wrapper.user { justify-content: flex-end; }
          .msg-bubble { max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 13px; line-height: 1.5; }
          .user .msg-bubble { background: #d4af37; color: #000; border-bottom-right-radius: 4px; font-weight: 500; }
          .advisor .msg-bubble { background: rgba(255,255,255,0.05); color: #e0e0e0; border: 1px solid rgba(255,255,255,0.08); border-bottom-left-radius: 4px; }
          .msg-bubble.loading { display: flex; align-items: center; gap: 10px; color: #d4af37; border-color: rgba(212, 175, 55, 0.2); }

          .advisor-input-area { padding: 15px; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.05); display: flex; gap: 10px; }
          .advisor-input-area input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 15px; color: #fff; font-size: 13px; outline: none; transition: border 0.3s; }
          .advisor-input-area input:focus { border-color: #d4af37; }
          .advisor-input-area button { background: #d4af37; color: #000; border: none; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; }
          .advisor-input-area button:hover { transform: scale(1.05); }
          .btn-close-custom { background: none; border: none; color: #666; cursor: pointer; transition: color 0.2s; }
          .btn-close-custom:hover { color: #fff; }
          .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
          @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </>
    )
  }

export default AdvisorChat
