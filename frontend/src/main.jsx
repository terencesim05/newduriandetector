import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import DashboardLayout from './layouts/DashboardLayout'
import './index.css'
import App from './App.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<DashboardLayout><Dashboard /></DashboardLayout>} />
          <Route path="/alerts" element={<DashboardLayout><Alerts /></DashboardLayout>} />
          <Route path="/quarantine" element={<DashboardLayout><Quarantine /></DashboardLayout>} />
          <Route path="/rules" element={<DashboardLayout><Rules /></DashboardLayout>} />
          <Route path="/threat-intel" element={<DashboardLayout><ThreatIntel /></DashboardLayout>} />
          <Route path="/blacklist" element={<DashboardLayout><Blacklist /></DashboardLayout>} />
          <Route path="/whitelist" element={<DashboardLayout><Whitelist /></DashboardLayout>} />
          <Route path="/incidents" element={<DashboardLayout><Incidents /></DashboardLayout>} />
          <Route path="/ml-config" element={<DashboardLayout><MLConfig /></DashboardLayout>} />
          <Route path="/teams" element={<DashboardLayout><Teams /></DashboardLayout>} />
          <Route path="/settings" element={<DashboardLayout><Settings /></DashboardLayout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
