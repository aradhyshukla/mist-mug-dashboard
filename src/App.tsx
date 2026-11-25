import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Overview } from '@/pages/Overview'
import { SalesAnalytics } from '@/pages/SalesAnalytics'
import { Insights } from '@/pages/Insights'
import { UploadData } from '@/pages/UploadData'
import { PerformanceTracker } from '@/pages/PerformanceTracker'
import { Settings } from '@/pages/Settings'

function LayoutRoute() {
  const location = useLocation()
  const activePath = location.pathname

  return (
    <DashboardLayout activePath={activePath}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/analytics" element={<SalesAnalytics />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/upload" element={<UploadData />} />
        <Route path="/performance" element={<PerformanceTracker />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </DashboardLayout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LayoutRoute />
    </BrowserRouter>
  )
}
