import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'


export interface DashboardLayoutProps {
  activePath: string
  children?: React.ReactNode
}

export function DashboardLayout({ activePath, children }: DashboardLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const closeSidebar = () => setSidebarOpen(false)
  const toggleSidebar = () => setSidebarOpen((prev) => !prev)

  const handleItemClick = (href: string) => {
    navigate(href)
    if (isMobile) {
      setMobileDrawerOpen(false)
    }
  }

  const actualActivePath = activePath || location.pathname

  // Close drawer on Escape.
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        setMobileDrawerOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [mobileDrawerOpen])

  // Restore focus to the toggle when the drawer closes.
  const [lastFocused, setLastFocused] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (mobileDrawerOpen) {
      setLastFocused(document.activeElement as HTMLElement)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      if (lastFocused) {
        lastFocused.focus()
      }
    }
  }, [mobileDrawerOpen])

  const toggleMobileDrawer = () => {
    setMobileDrawerOpen((prev) => !prev)
  }

  return (
    <div className="flex h-screen bg-paper relative">
      {/* Desktop: fixed-width sidebar column */}
      {!isMobile && (
        <>
          <Sidebar
            activePath={actualActivePath}
            onItemClick={handleItemClick}
            onClose={closeSidebar}
            collapsed={!sidebarOpen}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <TopBar onToggleSidebar={toggleSidebar} />
            <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-paper">
              {children ?? <Outlet context={{ activePath: location.pathname }} />}
            </main>
          </div>
        </>
      )}

      {/* Mobile: overlay drawer */}
      {isMobile && (
        <>
          <div className="flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 bg-paperSoft border-b border-border shrink-0 z-10">
              <button
                onClick={toggleMobileDrawer}
                aria-label={mobileDrawerOpen ? 'Close navigation' : 'Open navigation'}
                className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center text-cream hover:bg-forestSoft hover:text-creamSoft transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {mobileDrawerOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <div className="flex-1" />
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-paper">
              {children ?? <Outlet context={{ activePath: location.pathname }} />}
            </main>
          </div>

          {mobileDrawerOpen && (
            <>
              <div
                className="fixed inset-0 z-[54] bg-[rgba(20,48,42,0.55)] backdrop-blur-sm transition-opacity duration-300"
                onClick={toggleMobileDrawer}
                aria-hidden="true"
              />
              <Sidebar
                activePath={actualActivePath}
                onItemClick={handleItemClick}
                onClose={toggleMobileDrawer}
                collapsed={false}
                className="fixed inset-y-0 left-0 z-[55] w-64 bg-forest text-cream border-r border-[rgba(255,255,255,0.12)] flex flex-col shadow-lg"
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
