import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SidebarItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Overview', href: '/', icon: DashboardIcon },
  { label: 'Sales Analytics', href: '/analytics', icon: BarChartIcon },
  { label: 'Insights', href: '/insights', icon: LightbulbIcon },
  { label: 'Upload Data', href: '/upload', icon: UploadIcon },
  { label: 'Performance Tracker', href: '/performance', icon: ActivityIcon },
  { label: 'Settings', href: '/settings', icon: SettingsIcon },
]

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  )
}

function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 15h1a3 3 0 1 0-6 0h1" />
      <path d="M8 7h8a3 3 0 0 1 3 3v3a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-3a3 3 0 0 1 3-3Z" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-5 w-5', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export interface SidebarProps {
  activePath: string
  onItemClick: (href: string) => void
  onClose: () => void
  collapsed: boolean
  className?: string
}

export function Sidebar({ activePath, onItemClick, onClose, collapsed, className }: SidebarProps) {
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <aside
      className={cn(
        'inset-y-0 left-0 z-40 bg-forest text-creamSoft border-r border-[rgba(255,255,255,0.12)] flex flex-col transition-all duration-300 ease-in-out',
        collapsed ? 'w-20' : 'w-64',
        className,
      )}
      aria-label="Navigation"
    >
      {/* Header: Logo + location */}
      <div className="flex flex-col px-4 py-6 border-b border-[rgba(255,255,255,0.10)]">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center">
            <svg className="w-5 h-5 text-coffee" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 19a2 2 0 012-2h7a2 2 0 012 2v3a2 2 0 01-2 2H7a2 2 0 01-2-2v-3z" />
              <path d="M12 17a2 2 0 012-2h7a2 2 0 012 2v3a2 2 0 01-2 2h-7a2 2 0 01-2-2v-3z" />
              <path d="M3 3l9 9M7 7l9 9" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <div className="font-serif text-xl font-semibold text-cream tracking-tight leading-none">MIST &amp; MUG</div>
              <div className="text-[10px] text-creamMuted font-sans font-medium uppercase tracking-wider">Mussoorie · 2,005 m</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 pt-3">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <span className="text-[11px] text-creamMuted font-sans medium">{greeting}, Owner</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activePath === item.href
          return (
            <button
              key={item.label}
              onClick={() => {
                onItemClick(item.href)
              }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-[rgba(232,165,75,0.12)] text-goldActive border border-[rgba(232,165,75,0.25)] shadow-sm'
                  : 'text-creamSoft hover:text-creamSoft hover:bg-[rgba(255,255,255,0.05)]',
                collapsed ? 'justify-center px-2' : 'justify-start',
              )}
            >
              <item.icon className={cn(isActive ? 'text-goldActive' : 'text-creamIcon')} />
              {!collapsed && item.label}
            </button>
          )
        })}
      </nav>

      {/* Owner profile at bottom */}
      <div className="mt-auto px-4 py-6 border-t border-[rgba(255,255,255,0.10)]">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center overflow-hidden">
              <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="font-serif text-sm font-semibold text-cream leading-none truncate">Owner</div>
              <div className="text-[10px] text-creamMuted font-sans truncate">mistmug@cafe.in</div>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onClose}
            aria-label="Collapse sidebar"
            className="w-9 h-9 rounded-lg bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-creamSoft hover:text-creamSoft hover:bg-[rgba(255,255,255,0.15)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {collapsed ? (
                <path d="M9 5l7 7-7 7" />
              ) : (
                <path d="M15 19l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}
