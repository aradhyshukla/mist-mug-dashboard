/**
 * Mist & Mug — Category Revenue Donut Chart
 *
 * Reusable, responsive donut showing category-wise revenue distribution.
 * Shared by Top-Selling Products (Preference 2) and Category Performance
 * (Preference 4). Uses a single shared aggregation so both charts reconcile.
 *
 * Always represents REVENUE. No Revenue/Quantity toggle.
 */

import * as React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'
import { formatInr } from '@/lib/utils'
import { CATEGORY_COLORS } from '@/lib/analytics'

interface CategoryRevenueEntry {
  category: string
  revenueInr: number
}

interface CategoryRevenueDonutProps {
  data: CategoryRevenueEntry[]
  title?: string
  showCenterTotal?: boolean
}

const DONUT_COLORS = [
  '#142E25', // Coffee - forest green
  '#6E422B', // Tea - wood
  '#A6533F', // Bakery - terracotta
  '#2a4a3c', // Cold Beverage - soft forest
  '#8a2f1d', // Signature - deep earth
  '#a28b5a', // Merchandise - muted gold
  '#9aa7a1', // Unclassified - muted rain
]

function colorFor(category: string, index: number): string {
  const mapped = CATEGORY_COLORS[category]
  if (mapped) return mapped
  return DONUT_COLORS[index % DONUT_COLORS.length]
}

export function CategoryRevenueDonut({
  data,
  title,
  showCenterTotal = true,
}: CategoryRevenueDonutProps) {
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.revenueInr, 0), [data])

  const hasData = data.length > 0 && total > 0

  const entriesWithPct = React.useMemo(
    () =>
      data.map((entry) => ({
        ...entry,
        percentage: total > 0 ? (entry.revenueInr / total) * 100 : 0,
      })),
    [data, total],
  )

  if (!hasData) {
    return (
      <section className="card-premium p-6">
        {title && <h3 className="font-serif text-lg text-ink mb-4">{title}</h3>}
        <p className="text-sm text-rain/60">No category revenue data for the selected period.</p>
      </section>
    )
  }

  return (
    <section className="card-premium p-6">
      {title && <h3 className="font-serif text-lg text-ink mb-4">{title}</h3>}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Donut chart */}
        <div className="relative w-full max-w-xs h-64 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={entriesWithPct}
                dataKey="revenueInr"
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={88}
                fill="#8884d8"
                labelLine={false}
                label={({ value }: any) => {
                  const v = value as number
                  if (v === 0) return null
                  return ''
                }}
              >
                {entriesWithPct.map((entry, index) => (
                  <Cell key={`cell-${entry.category}`} fill={colorFor(entry.category, index)} />
                ))}
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload || payload.length === 0) return null
                    const entry = payload[0].payload as any
                    const value = entry.revenueInr as number
                    const percent = entry.percentage as number
                    return (
                      <div className="bg-paper border border-line rounded-lg p-2 shadow-sm text-sm">
                        <div className="font-medium text-ink">{entry.category}</div>
                        <div className="text-rain/60">
                          {formatInr(value)} ({percent.toFixed(1)}%)
                        </div>
                      </div>
                    )
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {showCenterTotal && total > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-rain/50 text-xs uppercase tracking-wider">Total Revenue</span>
              <span className="text-2xl font-serif text-ink">{formatInr(total)}</span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 min-w-[180px]">
          {entriesWithPct.map((entry, index) => {
            const color = colorFor(entry.category, index)
            const percent = total > 0 ? (entry.revenueInr / total) * 100 : 0
            return (
              <div
                key={entry.category}
                className="flex items-center gap-2 text-sm"
                role="listitem"
                aria-label={`${entry.category}: ${formatInr(entry.revenueInr)}, ${percent.toFixed(1)}% of total`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-white/60 shadow-sm"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="font-medium text-ink truncate">{entry.category}</span>
                <span className="ml-auto text-rain/60 font-serif">{formatInr(entry.revenueInr)}</span>
                <span className="ml-1 text-xs text-rain/50">({percent.toFixed(0)}%)</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
