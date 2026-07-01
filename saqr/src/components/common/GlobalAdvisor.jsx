import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Shield, Loader2, X, Sparkles } from 'lucide-react'
import AdvisorChat from '../../features/kitchen/components/AdvisorChat'

const GlobalAdvisor = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <AdvisorChat isOpen={isOpen} onClose={() => setIsOpen(false)} />

      {/* Floating Advisor Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="advisor-global-toggle shadow-gold-lg"
        title="اسأل المستشار"
      >
        <div className="icon-wrapper">
          <Shield size={24} className="shield-icon" />
          <Sparkles size={12} className="sparkles-icon" />
        </div>
        <span className="btn-label">المستشار</span>

        <div className="status-indicator"></div>
      </button>

      <style>{`
        .advisor-global-toggle {
          position: fixed;
          bottom: 30px;
          left: 30px;
          z-index: 1500;
          background: #d4af37;
          color: #000;
          border: none;
          padding: 12px 20px;
          border-radius: 50px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          box-shadow: 0 10px 30px rgba(212, 175, 55, 0.3);
        }

        .advisor-global-toggle:hover {
          transform: translateY(-5px) scale(1.05);
          box-shadow: 0 15px 40px rgba(212, 175, 55, 0.5);
        }

        .icon-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sparkles-icon {
          position: absolute;
          top: -4px;
          right: -4px;
          color: #fff;
          animation: rotate-sparkle 2s linear infinite;
        }

        @keyframes rotate-sparkle {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .status-indicator {
          position: absolute;
          top: 0;
          right: 0;
          width: 10px;
          height: 10px;
          background: #10b981;
          border: 2px solid #d4af37;
          border-radius: 50%;
        }

        .btn-label {
          font-size: 14px;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .btn-label { display: none; }
          .advisor-global-toggle { padding: 12px; border-radius: 50%; }
        }
      `}</style>
    </>
  )
}

export default GlobalAdvisor
