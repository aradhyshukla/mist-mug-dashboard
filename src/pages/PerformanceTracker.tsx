/**
 * Mist & Mug — Performance Tracker Page
 *
 * Performance analysis with mathematical comparisons only, filtered by a
 * hierarchical reporting period chosen through the shared
 * ReportingPeriodNavigator.
 *
 * Supports: All Time, entire year, entire month, calendar week.
 * Previous-period comparison:
 *   - Year  → preceding calendar year
 *   - Month → preceding calendar month
 *   - Week  → preceding comparable calendar-week segment
 *   - All Time → no previous period (lifetime metrics only)
 *
 * Selection and application are separate states. All available periods are
 * derived from actual imported transaction dates, never from the system clock.
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
import { ReportingPeriodNavigator } from '@/components/common/ReportingPeriodNavigator'
import {
  computeDashboardMetrics,
  computeGrowthMetrics,
  computeProductChanges,
  computeCategoryChanges,
  computeHistoricalGrowth,
} from '@/lib/analytics'
import { getAllImportLines } from '@/db'
import { resolveSelection, getPreviousPeriod, previousPeriodLabel, type ResolvedPeriod } from '@/lib/reporting-periods'
import { useReportingPeriodState } from '@/lib/useReportingPeriodState'
import { onDataChanged } from '@/lib/events'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'
import { formatInr, cn } from '@/lib/utils'
import type { ProcessedLine, ComparisonType } from '@/types'

const PERFORMANCE_STORAGE_KEY = 'mistmug:performance:appliedPeriod'

function formatPct(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value}%`
}

function formatAbs(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value >= 0 ? '+' : ''}₹${Math.abs(value)}`
}

function selectionToComparisonType(
  kind: 'all-time' | 'year' | 'month' | 'week'
): ComparisonType | null {
  switch (kind) {
    case 'year':
      return 'year-over-year'
    case 'month':
      return 'month-over-month'
    case 'week':
      return 'week-over-week'
    case 'all-time':
      return null
  }
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

function buildMetric(
  label: string,
  current: number,
  previous: number | null
) {
  const absDiff = previous === null ? null : current - previous
  let pctChange: number | null = null
  let isPositive: boolean | null = null
  if (previous !== null && previous > 0) {
    pctChange = Math.round(((current - previous) / previous) * 100 * 10) / 10
    isPositive = pctChange >= 0
  }
  return {
    label,
    current,
    previous: previous ?? null,
    absoluteDifference: absDiff,
    percentageChange: pctChange,
    isPositive,
  }
}

export function PerformanceTracker() {
  const [lines, setLines] = React.useState<ProcessedLine[]>([])
  const [loading, setLoading] = React.useState(true)

  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey: PERFORMANCE_STORAGE_KEY,
    lines,
  })

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
  const [periodInfo, setPeriodInfo] = React.useState<{
    currentStart: string
    currentEnd: string
    previousStart: string | null
    previousEnd: string | null
    previousLabel: string | null
    isAllTime: boolean
  } | null>(null)
  const [productChanges, setProductChanges] = React.useState<Array<any>>([])
  const [categoryChanges, setCategoryChanges] = React.useState<Array<any>>([])
  const [historicalGrowth, setHistoricalGrowth] = React.useState<Array<any>>([])
  const [error, setError] = React.useState<string | null>(null)

  const [range, setRange] = React.useState<ResolvedPeriod | null>(null)

  // Resolve applied selection to an inclusive date range.
  React.useEffect(() => {
    let resolved: ResolvedPeriod | null = null
    if (applied) {
      resolved = resolveSelection(applied, lines) ?? null
    }
    setRange(resolved)
  }, [applied, lines])

  async function loadData() {
    setLoading(true)
    try {
      const all = await getAllImportLines()
      setLines(all)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadData()
  }, [])

  // Recompute when data or applied range changes.
  React.useEffect(() => {
    if (!range) {
      setPeriodInfo(null)
      setGrowthMetrics([])
      setProductChanges([])
      setCategoryChanges([])
      setHistoricalGrowth([])
      setError(null)
      return
    }
    loadPerformance()
  }, [range, lines])

  // Recompute when data changes (e.g. after upload deletion).
  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadData()
    })
    return unsubscribe
  }, [])

  async function loadPerformance() {
    setLoading(true)
    setError(null)
    try {
      if (!range) return

      const { startDate: currentStart, endDate: currentEnd } = range
      const comparisonType = applied ? selectionToComparisonType(applied.kind) : null
      const isAllTime = applied?.kind === 'all-time'

      const previous = applied ? getPreviousPeriod(applied) : null
      const previousResolved = previous ? resolveSelection(previous, lines) : null

      setPeriodInfo({
        currentStart,
        currentEnd,
        previousStart: previousResolved?.startDate ?? null,
        previousEnd: previousResolved?.endDate ?? null,
        previousLabel: previous ? previousPeriodLabel(previous) : null,
        isAllTime,
      })

      if (!comparisonType || isAllTime) {
        // All Time: lifetime metrics only, no previous period.
        const current = await computeDashboardMetrics(currentStart, currentEnd)
        setGrowthMetrics([
          buildMetric('Revenue', current.revenueInr, null),
          buildMetric('Orders', current.orderCount, null),
          buildMetric('Units Sold', current.itemsSold, null),
          buildMetric('Avg Order Value', current.averageOrderValue, null),
        ])
        setProductChanges([])
        setCategoryChanges([])
      } else {
        const metrics = await computeGrowthMetrics(
          comparisonType,
          currentStart,
          currentEnd
        )
        setGrowthMetrics(metrics)

        const products = await computeProductChanges(
          comparisonType,
          currentStart,
          currentEnd
        )
        setProductChanges(products)

        const categories = await computeCategoryChanges(
          comparisonType,
          currentStart,
          currentEnd
        )
        setCategoryChanges(categories)
      }

      const history = await computeHistoricalGrowth(comparisonType ?? 'year-over-year')
      setHistoricalGrowth(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-rain/60 text-sm">Loading performance data…</p>
      </div>
    )
  }

  const hasAnyData = lines.some((l) => l.isValid && !l.isDuplicate && l.date)

  // No sales data at all: empty state with path to Upload Data.
  if (!hasAnyData) {
    return (
      <div className="space-y-8">
        <SectionHeader
          title="Performance Tracker"
          description="Compare performance across periods using mathematical calculations only."
          action={
            <ReportingPeriodNavigator
              lines={lines}
              applied={null}
              onApply={() => {}}
              selectLabel="Select Period"
            />
          }
        />
        <EmptyState
          title="No sales data"
          description="Import sales data via Upload Data to view performance comparisons. Week, Month, Year and All Time filters will become available once data exists."
          action={
            <Button asChild variant="brand" size="sm">
              <Link to="/upload">Upload Data</Link>
            </Button>
          }
        />
      </div>
    )
  }

  // No period applied yet: prompt the user to select one.
  if (!applied) {
    return (
      <div className="space-y-8">
        <SectionHeader
          title="Performance Tracker"
          description="Compare performance across periods using mathematical calculations only."
          action={
            <ReportingPeriodNavigator
              lines={lines}
              applied={null}
              onApply={setApplied}
              selectLabel="Select Period"
            />
          }
        />
        <div className="flex flex-col items-center justify-center text-center py-20">
          <p className="text-rain text-sm font-medium">Select the time period you want to analyze.</p>
        </div>
      </div>
    )
  }

  const resolved = range

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Performance Tracker"
        description="Compare performance across periods using mathematical calculations only."
        action={
          <ReportingPeriodNavigator
            lines={lines}
            applied={applied}
            onApply={setApplied}
            selectLabel="Select Period"
          />
        }
      />

      {/* Applied period banner */}
      {resolved && (
        <div className="flex items-center justify-between px-0">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#d8e8dc]/60 border border-[#1e5e3a]/30 text-[#1e5e3a] text-sm font-medium">
            <span>Analyzing:</span>
            <span className="font-serif text-ink">{resolved.label}</span>
            {resolved.startDate && resolved.endDate && (
              <span className="text-rain/60 text-xs">
                {resolved.startDate} → {resolved.endDate}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => clearApplied()}
              className="text-rain/60 hover:text-rain"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded bg-[#f5dede]/30 border border-[#8a2f1d]/30 text-sm text-[#8a2f1d]">
          {error}
        </div>
      )}

      {/* Period info */}
      {periodInfo && (
        <div className="card-premium p-4">
          <div className="flex flex-col gap-2 text-sm text-rain/60">
            <div className="flex items-center gap-4">
              <span>Current: {periodInfo.currentStart} → {periodInfo.currentEnd}</span>
              {periodInfo.previousStart && periodInfo.previousEnd && (
                <span className="border-l border-line pl-4">
                  Previous ({periodInfo.previousLabel}): {periodInfo.previousStart} → {periodInfo.previousEnd}
                </span>
              )}
              {periodInfo.isAllTime && <span>Lifetime — no previous period</span>}
            </div>
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
              description="Select a reporting period to see product performance changes."
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
                      <TableCell className="text-sm font-medium text-ink">{p.productName}</TableCell>
                      <TableCell className="text-sm text-rain/60">{p.category}</TableCell>
                      <TableCell className="text-sm font-serif text-ink">₹{p.currentRevenue}</TableCell>
                      <TableCell className="text-sm text-ink">{p.previousRevenue === null ? '—' : `₹${p.previousRevenue}`}</TableCell>
                      <TableCell className="text-sm text-ink">{p.revenueChange === null ? 'N/A' : formatAbs(p.revenueChange)}</TableCell>
                      <TableCell className="text-sm text-ink">{p.revenuePercentChange === null ? 'N/A' : formatPct(p.revenuePercentChange)}</TableCell>
                      <TableCell className="text-sm text-ink">{p.currentQuantity}</TableCell>
                      <TableCell className="text-sm text-ink">{p.previousQuantity === null ? '—' : p.previousQuantity}</TableCell>
                      <TableCell className="text-sm text-ink">{p.quantityChange === null ? 'N/A' : p.quantityChange}</TableCell>
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
              description="Select a reporting period to see category performance changes."
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
                      <TableCell className="text-sm font-medium text-ink">{c.category}</TableCell>
                      <TableCell className="text-sm font-serif text-ink">₹{c.currentRevenue}</TableCell>
                      <TableCell className="text-sm text-ink">{c.previousRevenue === null ? '—' : `₹${c.previousRevenue}`}</TableCell>
                      <TableCell className="text-sm text-ink">{c.revenueChange === null ? 'N/A' : formatAbs(c.revenueChange)}</TableCell>
                      <TableCell className="text-sm text-ink">{c.revenuePercentChange === null ? 'N/A' : formatPct(c.revenuePercentChange)}</TableCell>
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
                    <TableCell className="text-sm font-medium text-ink">{row.periodLabel}</TableCell>
                    <TableCell className="text-sm font-serif text-ink">₹{row.revenueInr}</TableCell>
                    <TableCell className="text-sm text-ink">{row.orderCount}</TableCell>
                    <TableCell className="text-sm text-ink">{row.itemsSold}</TableCell>
                    <TableCell className="text-sm text-ink">₹{Math.round(row.averageOrderValue)}</TableCell>
                    <TableCell className="text-sm text-ink">
                      {row.revenueChangePercent === null ? 'N/A' : formatPct(row.revenueChangePercent)}
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
