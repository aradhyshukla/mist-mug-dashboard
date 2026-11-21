/**
 * Mist & Mug — Performance Tracker Page (Phase 3)
 *
 * Fully functional performance analysis with mathematical comparisons only.
 * No AI recommendations, no speculative conclusions.
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
import {
  computeGrowthMetrics,
  computeProductChanges,
  computeCategoryChanges,
  computeHistoricalGrowth,
  getComparisonPeriods,
} from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type ComparisonType } from '@/types'
import { formatInr, cn } from '@/lib/utils'
import { onDataChanged } from '@/lib/events'

type ViewMode = 'overview' | 'products' | 'categories' | 'history'

const COMPARISONS: Array<{ value: ComparisonType; label: string }> = [
  { value: 'week-over-week', label: 'Week-over-Week' },
  { value: 'month-over-month', label: 'Month-over-Month' },
  { value: 'year-over-year', label: 'Year-over-Year' },
]

function formatPct(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value}%`
}

function formatAbs(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value >= 0 ? '+' : ''}₹${Math.abs(value)}`
}

function GrowthCard({
  metric,
}: {
  metric: {
    label: string
    current: number
    previous: number | null
    absoluteDifference: number | null
    percentageChange: number | null
    isPositive: boolean | null
  }
}) {
  const hasChange =
    metric.absoluteDifference !== null && metric.percentageChange !== null

  return (
    <div className="card-premium p-6">
      <p className="text-xs text-rain/50 uppercase tracking-wider font-medium mb-2">
        {metric.label} Growth
      </p>
      <div className="space-y-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-serif text-ink">
            {formatInr(metric.label === 'Orders' || metric.label === 'Units Sold'
              ? metric.current
              : metric.current)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              'font-medium',
              metric.isPositive === true
                ? 'text-[#1e5e3a]'
                : metric.isPositive === false
                  ? 'text-[#8a2f1d]'
                  : 'text-rain/50'
            )}
          >
            {hasChange
              ? `${formatPct(metric.percentageChange)} vs previous`
              : 'N/A — no prior data'}
          </span>
        </div>
        {hasChange && (
          <div className="flex items-center gap-2 text-xs text-rain/60">
            <span>Previous:
              {metric.label === 'Avg Order Value'
                ? `₹${Math.round(metric.previous!)}`
                : metric.label === 'Orders' || metric.label === 'Units Sold'
                  ? metric.previous!
                  : `₹${metric.previous!}`}
            </span>
            <span>Abs diff: {formatAbs(metric.absoluteDifference)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function PerformanceTracker() {
  const [comparisonType, setComparisonType] = React.useState<ComparisonType>(
    'week-over-week'
  )
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [viewMode] = React.useState<ViewMode>('overview')

  const [growthMetrics, setGrowthMetrics] = React.useState<
    Array<{
      label: string
      current: number
      previous: number | null
      absoluteDifference: number | null
      percentageChange: number | null
      isPositive: boolean | null
    }>
  >([])
  const [periodInfo, setPeriodInfo] = React.useState<PeriodComparisonType | null>(
    null
  )
  const [productChanges, setProductChanges] = React.useState<Array<any>>([])
  const [categoryChanges, setCategoryChanges] = React.useState<Array<any>>([])
  const [historicalGrowth, setHistoricalGrowth] = React.useState<
    Array<any>
  >([])

  type PeriodComparisonType = {
    type: ComparisonType
    currentStart: string
    currentEnd: string
    previousStart: string
    previousEnd: string
    isCurrentComplete: boolean
    isPreviousComplete: boolean
  }

  React.useEffect(() => {
    loadPerformance()
  }, [comparisonType, viewMode])

  // Recompute performance when data changes (e.g., after upload deletion)
  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadPerformance()
    })
    return unsubscribe
  }, [])

  async function loadPerformance() {
    setLoading(true)
    setError(null)
    try {
      const periods = getComparisonPeriods(comparisonType, getDefaultStart(comparisonType), getDefaultEnd(comparisonType))
      setPeriodInfo(periods)

      const metrics = await computeGrowthMetrics(
        comparisonType,
        periods.currentStart,
        periods.currentEnd
      )
      setGrowthMetrics(metrics)

      const products = await computeProductChanges(
        comparisonType,
        periods.currentStart,
        periods.currentEnd
      )
      setProductChanges(products)

      const categories = await computeCategoryChanges(
        comparisonType,
        periods.currentStart,
        periods.currentEnd
      )
      setCategoryChanges(categories)

      const history = await computeHistoricalGrowth(comparisonType)
      setHistoricalGrowth(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  function getDefaultStart(type: ComparisonType): string {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (type === 'year-over-year') {
      today.setFullYear(today.getFullYear() - 1)
    } else if (type === 'month-over-month') {
      today.setMonth(today.getMonth() - 1)
    } else {
      today.setDate(today.getDate() - 14)
    }
    return today.toISOString().split('T')[0]
  }

  function getDefaultEnd(type: ComparisonType): string {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (type === 'year-over-year') {
      today.setFullYear(today.getFullYear() - 1)
      today.setMonth(11)
      today.setDate(31)
    } else if (type === 'month-over-month') {
      today.setMonth(today.getMonth(), 0)
      today.setDate(0)
    } else {
      today.setDate(today.getDate() - 1)
    }
    return today.toISOString().split('T')[0]
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-rain/60 text-sm">Loading performance data…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-rain/60 text-sm mb-4">{error}</p>
        <Button variant="brand" onClick={loadPerformance}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Performance Tracker"
        description="Compare performance across periods using mathematical calculations only."
        action={
          <div className="flex gap-2">
            {COMPARISONS.map((c) => (
              <Button
                key={c.value}
                variant={comparisonType === c.value ? 'brand' : 'outline'}
                size="sm"
                onClick={() => setComparisonType(c.value)}
              >
                {c.label}
              </Button>
            ))}
          </div>
        }
      />

      {error && (
        <div className="p-3 rounded bg-[#f5dede]/30 border border-[#8a2f1d]/30 text-sm text-[#8a2f1d]">
          {error}
        </div>
      )}

      {/* Period info */}
      {periodInfo && (
        <div className="card-premium p-4">
          <div className="flex items-center gap-4 text-sm text-rain/60">
            <span>
              Current: {periodInfo.currentStart} → {periodInfo.currentEnd}
            </span>
            <span className="border-l border-line pl-4">
              Previous: {periodInfo.previousStart} → {periodInfo.previousEnd}
            </span>
            {!periodInfo.isCurrentComplete && (
              <span className="text-[#a6533f]">⚠ Current period incomplete</span>
            )}
            {!periodInfo.isPreviousComplete && (
              <span className="text-[#a6533f]">⚠ Previous period incomplete</span>
            )}
          </div>
        </div>
      )}

      {/* Growth KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {growthMetrics.map((m) => (
          <GrowthCard key={m.label} metric={m} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Performance Changes */}
        <section className="card-premium p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Product-Level Changes</h3>
          </div>
          {productChanges.length === 0 ? (
            <EmptyState
              title="No product data"
              description="Import sales data to see product performance changes."
              icon={<Table className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Curr. Revenue</TableHead>
                    <TableHead>Prev. Revenue</TableHead>
                    <TableHead>Revenue Δ</TableHead>
                    <TableHead>Revenue %</TableHead>
                    <TableHead>Curr. Qty</TableHead>
                    <TableHead>Prev. Qty</TableHead>
                    <TableHead>Qty Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productChanges.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium text-ink">
                        {p.productName}
                      </TableCell>
                      <TableCell className="text-sm text-rain/60">{p.category}</TableCell>
                      <TableCell className="text-sm font-serif text-ink">
                        ₹{p.currentRevenue}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.previousRevenue === null ? '—' : `₹${p.previousRevenue}`}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.revenueChange === null ? 'N/A' : formatAbs(p.revenueChange)}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.revenuePercentChange === null
                          ? 'N/A'
                          : formatPct(p.revenuePercentChange)}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.currentQuantity}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.previousQuantity === null ? '—' : p.previousQuantity}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {p.quantityChange === null ? 'N/A' : p.quantityChange}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        {/* Category Performance Changes */}
        <section className="card-premium p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Category-Level Changes</h3>
          </div>
          {categoryChanges.length === 0 ? (
            <EmptyState
              title="No category data"
              description="Import sales data to see category performance changes."
              icon={<Table className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Curr. Revenue</TableHead>
                    <TableHead>Prev. Revenue</TableHead>
                    <TableHead>Revenue Δ</TableHead>
                    <TableHead>Revenue %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryChanges.map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium text-ink">
                        {c.category}
                      </TableCell>
                      <TableCell className="text-sm font-serif text-ink">
                        ₹{c.currentRevenue}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {c.previousRevenue === null ? '—' : `₹${c.previousRevenue}`}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {c.revenueChange === null ? 'N/A' : formatAbs(c.revenueChange)}
                      </TableCell>
                      <TableCell className="text-sm text-ink">
                        {c.revenuePercentChange === null
                          ? 'N/A'
                          : formatPct(c.revenuePercentChange)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>

      {/* Historical Growth Table */}
      <section className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-lg text-ink">Historical Growth</h3>
        </div>
        {historicalGrowth.length === 0 ? (
          <EmptyState
            title="No historical data"
            description="Import sales data to view historical growth trends."
            icon={<Table className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Units Sold</TableHead>
                  <TableHead>Avg Order Value</TableHead>
                  <TableHead>Revenue Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicalGrowth.map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium text-ink">
                      {row.periodLabel}
                    </TableCell>
                    <TableCell className="text-sm font-serif text-ink">
                      ₹{row.revenueInr}
                    </TableCell>
                    <TableCell className="text-sm text-ink">{row.orderCount}</TableCell>
                    <TableCell className="text-sm text-ink">{row.itemsSold}</TableCell>
                    <TableCell className="text-sm text-ink">
                      ₹{Math.round(row.averageOrderValue)}
                    </TableCell>
                    <TableCell className="text-sm text-ink">
                      {row.revenueChangePercent === null
                        ? 'N/A'
                        : formatPct(row.revenueChangePercent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
