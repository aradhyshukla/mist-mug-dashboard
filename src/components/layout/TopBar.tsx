import { Link, useLocation } from 'react-router-dom'
import { Search, Bell, Calendar, ChevronRight } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/analytics': 'Sales Analytics',
  '/upload': 'Upload Data',
  '/performance': 'Performance Tracker',
  '/settings': 'Settings',
}

export function TopBar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const location = useLocation()
  const activePath = location.pathname
  const pageTitle = PAGE_TITLES[activePath] || 'Overview'
  const breadcrumb = activePath === '/' ? 'Dashboard' : pageTitle

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
  })

  return (
    <header className="sticky top-0 z-30 bg-paperSoft/90 backdrop-blur-md border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Sidebar toggle (desktop) */}
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="w-9 h-9 rounded-lg bg-forest flex items-center justify-center text-cream hover:bg-forestSoft hover:text-creamSoft transition-colors hidden sm:block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {/* Breadcrumb / Page title */}
        <div className="flex items-center gap-2 ml-2">
          <Link
            to="/"
            className="text-[11px] text-rain font-medium uppercase tracking-wider hover:text-forest transition-colors"
          >
            Dashboard
          </Link>
          <ChevronRight className="w-3 h-3 text-rain/40" />
          <span className="text-[11px] text-forest font-semibold uppercase tracking-wider">
            {breadcrumb}
          </span>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Search, Bell, Date */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-rain/50" />
            <input
              type="text"
              placeholder="Search…"
              className="pl-10 pr-4 py-2.5 bg-paperSoft border border-border rounded-lg text-[12px] text-ink focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent transition-all w-48 md:w-64"
            />
          </div>
          <button
            className="w-9 h-9 rounded-lg bg-[rgba(20,48,42,0.08)] flex items-center justify-center text-rain hover:text-forest hover:bg-[rgba(20,48,42,0.15)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-[rgba(20,48,42,0.06)] rounded-lg border border-[rgba(255,255,255,0.08)]">
            <Calendar className="w-4 h-4 text-rain/50" />
            <span className="text-[11px] text-rain font-medium">{dateStr}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
