import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/common/Sidebar'
import Navbar from '../components/common/Navbar'
import GlobalAdvisorFAB from '../components/common/GlobalAdvisorFAB'

const MainLayout = () => {
  return (
    <div className="layout-wrapper">
      <Sidebar />
      <div className="content-area">
        <Navbar />
        <main className="animate-fade-in">
          <Outlet />
        </main>
        <GlobalAdvisorFAB />
      </div>
    </div>
  )
}

export default MainLayout
