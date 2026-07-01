import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import Dashboard from './features/analytics/pages/Dashboard'
import PerformancePage from './features/analytics/pages/PerformancePage'
import WorkersPage from './features/workers/pages/WorkersPage'
import KitchenPage from './features/kitchen/pages/KitchenPage'
import AssetsPage from './features/inventory/pages/AssetsPage'
import SettingsPage from './features/settings/pages/SettingsPage'
import LoginPage from './features/auth/pages/LoginPage'
import AdminDashboard from './features/admin/pages/AdminDashboard'
import PendingApproval from './features/auth/pages/PendingApproval'
import VerificationWizard from './features/auth/components/VerificationWizard'
import { useAuth } from './context/AuthContext'
import { Loader2 } from 'lucide-react'
import AdvisorPage from './features/advisor/pages/AdvisorPage'


function App() {
  const { user, profile, loading, refreshProfile } = useAuth()

  // 1. Show global loader while session is loading
  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center bg-black">
        <div className="text-center">
          <Loader2 className="animate-spin text-gold mb-3" size={48} />
          <p className="text-silver fw-bold">جاري تحضير الصقر...</p>
        </div>
      </div>
    )
  }

  // 2. Redirect to Login if not authenticated
  if (!user) {
    return (
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    )
  }

  // 3. Handle Profile Status (Pending Approval)
  if (profile?.status === 'pending') {
    return <PendingApproval />
  }

  // 4. Handle Verification Logic (After Approval)
  // [Bypass enabled for current session as per user request]
  /*
  const needsEmail = !profile?.is_email_verified
  const needsSms = !profile?.is_phone_verified
  const needsTelegram = !profile?.telegram_chat_id

  if (profile?.status === 'active' && (needsEmail || needsTelegram)) {
    return <VerificationWizard onComplete={() => refreshProfile()} />
  }
  */

  // 5. Normal Authenticated Routes
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analytics" element={<PerformancePage />} />
          <Route path="/workers" element={<WorkersPage />} />
          <Route path="/kitchen" element={<KitchenPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="/advisor" element={<AdvisorPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

export default App
