import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Sidebar } from './Sidebar'

export interface DashboardLayoutProps {
  activePath: string
  children?: React.ReactNode
}

export function DashboardLayout({ activePath, children }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)
  const closeSidebar = () => setSidebarOpen(false)

  const handleItemClick = (href: string) => {
    navigate(href)
    closeSidebar()
  }

  const actualActivePath = activePath || location.pathname

  return (
    <div className="flex h-screen bg-paper relative">
      {/* Always-visible hamburger toggle in the top-left corner */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        className="fixed top-4 left-4 z-50 p-2 rounded-md text-rain/50 hover:text-cream hover:bg-[rgba(243,232,211,0.1)] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar is only rendered when open - no empty column/gap when hidden */}
      {sidebarOpen && (
        <>
          {/* Mobile overlay backdrop */}
          <div
            className="lg:hidden fixed inset-0 z-[54] bg-[rgba(20,46,37,0.6)] backdrop-blur-sm"
            onClick={closeSidebar}
            aria-hidden="true"
          />
          <Sidebar activePath={actualActivePath} onItemClick={handleItemClick} onClose={closeSidebar} />
        </>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8 lg:p-10 bg-paper">
          {children ?? <Outlet context={{ activePath: location.pathname }} />}
        </main>
      </div>
    </div>
  )
}
