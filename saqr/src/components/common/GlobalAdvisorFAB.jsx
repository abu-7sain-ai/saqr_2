import React from 'react'
import { Shield, Sparkles } from 'lucide-react'

const GlobalAdvisorFAB = () => {
  const handleOpenAdvisor = () => {
    window.open('/advisor', '_blank')
  }

  return (
    <button 
      className="advisor-fab pulse" 
      onClick={handleOpenAdvisor}
      title="اسأل المستشار"
    >
      <div className="icon-wrapper">
        <Shield size={28} />
        <Sparkles size={14} className="sparkle" />
      </div>
    </button>
  )
}

export default GlobalAdvisorFAB
