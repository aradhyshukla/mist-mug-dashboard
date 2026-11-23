import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { Sidebar } from './Sidebar'

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
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (mobileDrawerOpen) {
      lastFocused.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      if (lastFocused.current) {
        lastFocused.current.focus()
        lastFocused.current = null
      }
    }
  }, [mobileDrawerOpen])

  const toggleMobileDrawer = () => {
    setMobileDrawerOpen((prev) => !prev)
  }

  return (
    <div className="flex h-screen bg-paper relative">
      {/* Desktop: fixed-width sidebar column occupying its own space. */}
      {!isMobile && (
        <>
          <Sidebar
            activePath={actualActivePath}
            onItemClick={handleItemClick}
            onClose={closeSidebar}
            collapsed={!sidebarOpen}
          />
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 bg-paper border-b border-line shrink-0 z-10 hidden lg:flex">
              <button
                onClick={toggleSidebar}
                aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
                className="p-2 rounded-md text-rain/50 hover:text-cream hover:bg-[rgba(243,232,211,0.1)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {sidebarOpen ? (
                    <path d="M15 19l-7-7 7-7" />
                  ) : (
                    <path d="M9 5l7 7-7 7" />
                  )}
                </svg>
              </button>
              <div className="flex-1" />
            </header>
            <main className="flex-1 overflow-y-auto p-8 lg:p-10 bg-paper">
              {children ?? <Outlet context={{ activePath: location.pathname }} />}
            </main>
          </div>
        </>
      )}

      {/* Mobile: overlay drawer. */}
      {isMobile && (
        <>
          <div className="flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 bg-paper border-b border-line shrink-0 z-10">
              <button
                onClick={toggleMobileDrawer}
                aria-label={mobileDrawerOpen ? 'Close navigation' : 'Open navigation'}
                className="p-2 rounded-md text-rain/50 hover:text-cream hover:bg-[rgba(243,232,211,0.1)] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  {mobileDrawerOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <>
                      <path d="M4 6h16M4 12h16M4 18h16" />
                    </>
                  )}
                </svg>
              </button>
              <div className="flex-1" />
            </header>
            <main className="flex-1 overflow-y-auto p-4 lg:p-10 bg-paper">
              {children ?? <Outlet context={{ activePath: location.pathname }} />}
            </main>
          </div>

          {mobileDrawerOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-[54] bg-[rgba(20,46,37,0.6)] backdrop-blur-sm transition-opacity duration-300"
                onClick={toggleMobileDrawer}
                aria-hidden="true"
              />
              <Sidebar
                activePath={actualActivePath}
                onItemClick={handleItemClick}
                onClose={toggleMobileDrawer}
                collapsed={false}
                className="fixed inset-y-0 left-0 z-[55] w-64 bg-forest text-cream border-r border-[rgba(243,232,211,0.22)] flex flex-col shadow-lg"
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
