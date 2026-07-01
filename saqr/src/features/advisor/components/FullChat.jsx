import React, { useState, useEffect, useRef } from 'react'
import { Send, Shield, Sparkles, Loader2, Bot, User } from 'lucide-react'

const FullChat = () => {
  const [messages, setMessages] = useState([
    {
      role: 'advisor',
      content: 'أهلاً بك سيدي. أنا المستشار الرقابي لصقر. كيف يمكنني مساعدتك في تحليل أداء المنصة اليوم؟'
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

  return (
    <div className="container py-4 flex-grow-1 d-flex flex-column" style={{ maxWidth: '900px' }}>
      <div className="glass-panel flex-grow-1 d-flex flex-column overflow-hidden border-accent-primary-subtle shadow-glow-primary">
        {/* Header */}
        <div className="p-3 border-bottom border-white border-opacity-5 d-flex align-items-center justify-content-between bg-white bg-opacity-5">
          <div className="d-flex align-items-center gap-3">
            <div className="advisor-avatar-large">
              <Shield size={24} className="text-accent-primary" />
            </div>
            <div>
              <h5 className="mb-0 text-white fw-bold">المستشار الذكي (Supervisor)</h5>
              <div className="small text-accent-secondary d-flex align-items-center gap-1">
                <span className="pulse-dot-green"></span> نظام تحليل البيانات المتقدم
              </div>
            </div>
          </div>
          <div className="d-none d-md-block text-secondary small fw-medium">
            SAQR v2.0 | Advanced AI Logic
          </div>
        </div>

        {/* Messages */}
        <div className="flex-grow-1 p-4 overflow-y-auto d-flex flex-column gap-4 custom-scrollbar">
          {messages.map((m, i) => (
            <div key={i} className={`d-flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`avatar-circle ${m.role === 'user' ? 'bg-accent-secondary' : 'bg-accent-primary-subtle'}`}>
                {m.role === 'user' ? <User size={16} className="text-black" /> : <Bot size={16} className="text-accent-primary" />}
              </div>
              <div className={`msg-bubble-modern ${m.role}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="d-flex gap-3">
              <div className="avatar-circle bg-accent-primary-subtle">
                <Loader2 size={16} className="animate-spin text-accent-primary" />
              </div>
              <div className="msg-bubble-modern advisor thinking">
                جاري تحليل البيانات واستخلاص النتائج...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-top border-white border-opacity-5 bg-white bg-opacity-5">
          <div className="input-group-modern">
            <input
              type="text"
              className="chat-input"
              placeholder="اسأل عن أي شيء يتعلق بالتداول أو أداء المنصة..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button 
              className="send-btn" 
              onClick={handleSend} 
              disabled={loading || !input.trim()}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .advisor-avatar-large {
          width: 48px;
          height: 48px;
          background: rgba(0, 255, 157, 0.1);
          border: 1px solid rgba(0, 255, 157, 0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(0, 255, 157, 0.1);
        }

        .pulse-dot-green {
          width: 8px;
          height: 8px;
          background: var(--accent-primary);
          border-radius: 50%;
          display: inline-block;
          animation: blink 2s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .avatar-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .bg-accent-primary-subtle {
          background: rgba(0, 255, 157, 0.1);
          border: 1px solid rgba(0, 255, 157, 0.2);
        }

        .msg-bubble-modern {
          max-width: 80%;
          padding: 14px 18px;
          border-radius: 20px;
          font-size: 14px;
          line-height: 1.6;
          position: relative;
        }

        .msg-bubble-modern.advisor {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-top-left-radius: 4px;
          color: var(--text-secondary);
        }

        .msg-bubble-modern.user {
          background: linear-gradient(135deg, var(--accent-primary) 0%, #00d485 100%);
          color: #000;
          font-weight: 500;
          border-top-right-radius: 4px;
          box-shadow: 0 4px 15px rgba(0, 255, 157, 0.2);
        }

        .msg-bubble-modern.thinking {
          color: var(--accent-primary);
          font-style: italic;
          border-color: rgba(0, 255, 157, 0.2);
        }

        .input-group-modern {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 6px;
          transition: all 0.3s ease;
        }

        .input-group-modern:focus-within {
          border-color: var(--accent-primary);
          box-shadow: 0 0 15px rgba(0, 255, 157, 0.1);
        }

        .chat-input {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          padding: 10px 15px;
          outline: none;
          font-size: 14px;
        }

        .send-btn {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: var(--accent-primary);
          border: none;
          color: black;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          filter: brightness(1.1);
        }

        .send-btn:disabled {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  )
}

export default FullChat
