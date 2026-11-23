import * as React from 'react'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="mb-4 opacity-50">{icon}</div>}
      <h3 className="text-lg font-serif text-ink mb-2">{title}</h3>
      {description && <p className="text-rain/60 text-sm max-w-xs mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

export interface StatCardProps {
  title: string
  value: string | number | React.ReactNode
  subtitle?: string
  trend?: { label: string; value: number; positive: boolean }
}

export function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <div className="card-premium p-6">
      <div className="flex items-baseline gap-2">
        <span className="text-rain/60 text-xs uppercase tracking-wider font-medium">{title}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-serif text-ink">{typeof value === 'number' ? value : value}</span>
      </div>
      {subtitle && <p className="mt-1 text-xs text-rain/60">{subtitle}</p>}
      {trend && (
        <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
          trend.positive ? 'bg-[#d8e8dc]/60 text-[#1e5e3a] border border-[#1e5e3a]/30' : 'bg-[#f5dede]/60 text-[#8a2f1d] border border-[#8a2f1d]/30'
        }`}>
          {trend.positive ? '▲' : '▼'} {trend.label} {trend.value}%
        </div>
      )}
    </div>
  )
}

export interface SectionHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div className="flex flex-col">
        <h2 className="section-title">{title}</h2>
        {description && <p className="section-subtitle">{description}</p>}
      </div>
      {action && (
        <div className="ml-auto flex flex-col sm:flex-row items-end sm:items-center gap-3 sm:gap-2">
          {action}
        </div>
      )}
    </div>
  )
}
