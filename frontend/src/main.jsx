import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { SSEProvider } from './context/SSEContext'
import DashboardLayout from './layouts/DashboardLayout'
import AdminLayout from './layouts/AdminLayout'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Alerts from './pages/Alerts.jsx'
import Incidents from './pages/Incidents.jsx'
import Teams from './pages/Teams.jsx'
import Settings from './pages/Settings.jsx'
import ThreatIntel from './pages/ThreatIntel.jsx'
import Blacklist from './pages/Blacklist.jsx'
import Whitelist from './pages/Whitelist.jsx'
import Quarantine from './pages/Quarantine.jsx'
import Rules from './pages/Rules.jsx'
import MLConfig from './pages/MLConfig.jsx'
import IngestionLogs from './pages/IngestionLogs.jsx'
import Analytics from './pages/Analytics.jsx'
import GeoMap from './pages/GeoMap.jsx'
import Chatbot from './pages/Chatbot.jsx'
import AdminDashboard from './pages/admin/AdminDashboard.jsx'
import UserManagement from './pages/admin/UserManagement.jsx'
import SubscriptionManagement from './pages/admin/SubscriptionManagement.jsx'
import SystemMonitoring from './pages/admin/SystemMonitoring.jsx'
import AuditLogs from './pages/admin/AuditLogs.jsx'
import TeamManagement from './pages/admin/TeamManagement.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
      <SSEProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/alerts" element={<DashboardLayout><Alerts /></DashboardLayout>} />
          <Route path="/quarantine" element={<DashboardLayout><Quarantine /></DashboardLayout>} />
          <Route path="/rules" element={<DashboardLayout><Rules /></DashboardLayout>} />
          <Route path="/threat-intel" element={<DashboardLayout><ThreatIntel /></DashboardLayout>} />
          <Route path="/blacklist" element={<DashboardLayout><Blacklist /></DashboardLayout>} />
          <Route path="/whitelist" element={<DashboardLayout><Whitelist /></DashboardLayout>} />
          <Route path="/incidents" element={<DashboardLayout><Incidents /></DashboardLayout>} />
          <Route path="/ml-config" element={<DashboardLayout><MLConfig /></DashboardLayout>} />
          <Route path="/ingestion-logs" element={<DashboardLayout><IngestionLogs /></DashboardLayout>} />
          <Route path="/analytics" element={<DashboardLayout><Analytics /></DashboardLayout>} />
          <Route path="/attack-globe" element={<DashboardLayout><GeoMap /></DashboardLayout>} />
          <Route path="/chatbot" element={<DashboardLayout><Chatbot /></DashboardLayout>} />
          <Route path="/teams" element={<DashboardLayout><Teams /></DashboardLayout>} />
          <Route path="/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
          {/* Admin routes */}
          <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboard /></AdminLayout>} />
          <Route path="/admin/users" element={<AdminLayout><UserManagement /></AdminLayout>} />
          <Route path="/admin/teams" element={<AdminLayout><TeamManagement /></AdminLayout>} />
          <Route path="/admin/subscriptions" element={<AdminLayout><SubscriptionManagement /></AdminLayout>} />
          <Route path="/admin/system" element={<AdminLayout><SystemMonitoring /></AdminLayout>} />
          <Route path="/admin/audit" element={<AdminLayout><AuditLogs /></AdminLayout>} />
        </Routes>
        <Toaster />
      </SSEProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
