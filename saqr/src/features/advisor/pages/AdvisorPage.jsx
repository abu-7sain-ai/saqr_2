import React from 'react'
import FullChat from '../components/FullChat'

const AdvisorPage = () => {
  return (
    <div className="advisor-page min-vh-100 d-flex flex-column">
      <FullChat />
      
      <style>{`
        .advisor-page {
          background: radial-gradient(circle at center, var(--bg-base) 0%, #050508 100%);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}

export default AdvisorPage
