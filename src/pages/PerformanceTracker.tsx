/**
 * Mist & Mug — Performance Tracker Page
 *
 * Performance analysis with mathematical comparisons only, filtered by a
 * hierarchical reporting period chosen through the shared
 * ReportingPeriodNavigator.
 *
 * The complete dashboard layout always renders. Content within each section
 * responds to the current data state: no period selected, no imported data,
 * loading, ready, empty period, no previous data, or error.
 */

import * as React from 'react'
import { ReportingPeriodNavigator } from '@/components/common/ReportingPeriodNavigator'
import {
  computeDashboardMetrics,
  computeTopProducts,
  computeHistoricalGrowth,
} from '@/lib/analytics'
import { getAllImportLines } from '@/db'
import {
  resolveSelection,
  getPreviousPeriod,
  previousPeriodLabel,
  type ResolvedPeriod,
} from '@/lib/reporting-periods'
import { useReportingPeriodState } from '@/lib/useReportingPeriodState'
import { onDataChanged } from '@/lib/events'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import type { ProcessedLine, ComparisonType, ProductPerformance } from '@/types'

const PERFORMANCE_STORAGE_KEY = 'mistmug:performance:appliedPeriod'

export function formatPct(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return `${value >= 0 ? '+' : ''}${value}%`
}

export function formatAbs(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : '-'}${Math.abs(value)}`
}

/** Format a metric value: ₹ for Revenue / Avg Order Value, plain integer for Orders / Units Sold. */
export function formatMetricValue(label: string, value: number | null): string {
  if (value === null) return '—'
  const isCurrency = label === 'Revenue' || label === 'Avg Order Value'
  if (isCurrency) return `₹${value.toLocaleString('en-IN')}`
  return Math.round(value).toLocaleString('en-IN')
}

/** Inclusive calendar-day count between two YYYY-MM-DD dates. */
export function daysInRange(start: string, end: string): number {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const s = new Date(Date.UTC(sy, sm - 1, sd))
  const e = new Date(Date.UTC(ey, em - 1, ed))
  return Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1
}

function buildProductChange(
  current: ProductPerformance,
  previous: ProductPerformance | null
): Record<string, unknown> {
  const prevRevenue = previous?.revenueInr ?? null
  const prevQty = previous?.quantitySold ?? null

  let revenueChange: number | null = null
  let revenuePctChange: number | null = null
  if (prevRevenue !== null && prevRevenue > 0) {
    revenueChange = Math.round((current.revenueInr - prevRevenue) * 100) / 100
    revenuePctChange = Math.round(((current.revenueInr - prevRevenue) / prevRevenue) * 100 * 10) / 10
  }

  let quantityChange: number | null = null
  let quantityPctChange: number | null = null
  if (prevQty !== null && prevQty > 0) {
    quantityChange = current.quantitySold - prevQty
    quantityPctChange = Math.round(((current.quantitySold - prevQty) / prevQty) * 100 * 10) / 10
  }

  return {
    productName: current.productName,
    category: current.category,
    currentRevenue: current.revenueInr,
    previousRevenue: prevRevenue,
    currentQuantity: current.quantitySold,
    previousQuantity: prevQty,
    revenueChange,
    revenuePercentChange: revenuePctChange,
    quantityChange,
    quantityPercentChange: quantityPctChange,
    currentOrderCount: current.orderCount,
    previousOrderCount: previous?.orderCount ?? null,
  }
}

export function selectionToComparisonType(
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

type GrowthMetricState = {
  label: string
  current: number | null
  previous: number | null
  absoluteDifference: number | null
  percentageChange: number | null
  isPositive: boolean | null
}

const EMPTY_METRICS: GrowthMetricState[] = [
  { label: 'Revenue', current: null, previous: null, absoluteDifference: null, percentageChange: null, isPositive: null },
  { label: 'Orders', current: null, previous: null, absoluteDifference: null, percentageChange: null, isPositive: null },
  { label: 'Units Sold', current: null, previous: null, absoluteDifference: null, percentageChange: null, isPositive: null },
  { label: 'Avg Order Value', current: null, previous: null, absoluteDifference: null, percentageChange: null, isPositive: null },
]

export function buildMetric(
  label: string,
  current: number,
  previous: number | null
): GrowthMetricState {
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

function GrowthCard({
  metric,
  computing,
}: {
  metric: GrowthMetricState
  computing: boolean
}) {
  const hasChange =
    metric.absoluteDifference !== null && metric.percentageChange !== null
  const hasValue = metric.current !== null

  return (
    <div className="card-premium p-5">
      <p className="text-xs text-rain/50 uppercase tracking-wider font-medium mb-2">
        {metric.label} Growth
      </p>
      <div className="space-y-3">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-serif text-ink">
            {hasValue ? formatMetricValue(metric.label, metric.current) : '—'}
          </span>
          {computing && <span className="text-rain/40 animate-pulse">…</span>}
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
              : '—'}
          </span>
        </div>
        {hasChange && (
          <div className="flex items-center gap-2 text-xs text-rain/60">
            <span>Previous:</span>
            <span>
              {metric.label === 'Avg Order Value'
                ? `₹${Math.round(metric.previous!)}`
                : metric.label === 'Orders' || metric.label === 'Units Sold'
                  ? metric.previous!
                  : `₹${metric.previous!}`}
            </span>
            <span>Abs diff:</span>
            <span>{formatAbs(metric.absoluteDifference)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function PerformanceTracker() {
  const [lines, setLines] = React.useState<ProcessedLine[]>([])
  const [initialLoading, setInitialLoading] = React.useState(true)

  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey: PERFORMANCE_STORAGE_KEY,
    lines,
  })

  const [computing, setComputing] = React.useState(false)
  const [growthMetrics, setGrowthMetrics] = React.useState<GrowthMetricState[]>(
    EMPTY_METRICS
  )
  const [periodInfo, setPeriodInfo] = React.useState<{
    currentStart: string
    currentEnd: string
    previousStart: string | null
    previousEnd: string | null
    previousLabel: string | null
    isAllTime: boolean
  } | null>(null)
  const [coverageWarning, setCoverageWarning] = React.useState<string | null>(null)
  const [periodOpen, setPeriodOpen] = React.useState(false)
  const [productChanges, setProductChanges] = React.useState<Array<any>>([])
  const [historicalGrowth, setHistoricalGrowth] = React.useState<Array<any>>([])
  const [error, setError] = React.useState<string | null>(null)

  const [range, setRange] = React.useState<ResolvedPeriod | null>(null)

  const hasAnyData = lines.some((l) => l.isValid && !l.isDuplicate && l.date)
  const isLoading = initialLoading || computing
  const hasError = error != null

  React.useEffect(() => {
    let resolved: ResolvedPeriod | null = null
    if (applied) {
      resolved = resolveSelection(applied, lines) ?? null
    }
    setRange(resolved)
  }, [applied, lines])

  async function loadData() {
    setInitialLoading(true)
    setError(null)
    try {
      const all = await getAllImportLines()
      setLines(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales data')
    } finally {
      setInitialLoading(false)
    }
  }

  React.useEffect(() => {
    loadData()
  }, [])

  // Recompute when data or applied range changes.
  React.useEffect(() => {
    if (!range) {
      setPeriodInfo(null)
      setGrowthMetrics(EMPTY_METRICS)
      setProductChanges([])
      setHistoricalGrowth([])
      setError(null)
      setCoverageWarning(null)
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
    setComputing(true)
    setError(null)
    setCoverageWarning(null)
    try {
      if (!range) return

      const { startDate: currentStart, endDate: currentEnd } = range
      const isAllTime = applied?.kind === 'all-time'

      const previousSelection = applied ? getPreviousPeriod(applied) : null
      const previousResolved = previousSelection ? resolveSelection(previousSelection, lines) : null

      let previousMetrics: {
        revenueInr: number
        orderCount: number
        itemsSold: number
        averageOrderValue: number
      } | null = null
      if (previousResolved) {
        previousMetrics = await computeDashboardMetrics(
          previousResolved.startDate,
          previousResolved.endDate
        )
      }
      const hasPreviousData = previousMetrics?.orderCount ?? 0 > 0

      setPeriodInfo({
        currentStart,
        currentEnd,
        previousStart: hasPreviousData ? previousResolved!.startDate : null,
        previousEnd: hasPreviousData ? previousResolved!.endDate : null,
        previousLabel: hasPreviousData && previousSelection ? previousPeriodLabel(previousSelection) : null,
        isAllTime,
      })

      // Coverage warning: partial calendar weeks compared against a different-length week.
      if (applied?.kind === 'week' && previousResolved) {
        const currentDays = daysInRange(currentStart, currentEnd)
        const previousDays = daysInRange(previousResolved.startDate, previousResolved.endDate)
        if (currentDays !== previousDays) {
          setCoverageWarning(
            'Comparison periods have different calendar-day lengths. Percentage changes are unadjusted totals.'
          )
        }
      }

      const current = await computeDashboardMetrics(currentStart, currentEnd)
      const previousForMetrics = hasPreviousData ? previousMetrics : null

      if (isAllTime) {
        setGrowthMetrics([
          buildMetric('Revenue', current.revenueInr, null),
          buildMetric('Orders', current.orderCount, null),
          buildMetric('Units Sold', current.itemsSold, null),
          buildMetric('Avg Order Value', current.averageOrderValue, null),
        ])
        setProductChanges([])
      } else {
        setGrowthMetrics([
          buildMetric('Revenue', current.revenueInr, previousForMetrics?.revenueInr ?? null),
          buildMetric('Orders', current.orderCount, previousForMetrics?.orderCount ?? null),
          buildMetric('Units Sold', current.itemsSold, previousForMetrics?.itemsSold ?? null),
          buildMetric(
            'Avg Order Value',
            current.averageOrderValue,
            previousForMetrics?.averageOrderValue ?? null
          ),
        ])

        const currentProducts = await computeTopProducts(currentStart, currentEnd, 100)
        const previousProducts = previousForMetrics
          ? await computeTopProducts(previousResolved!.startDate, previousResolved!.endDate, 100)
          : []
        const previousProductMap = new Map(
          previousProducts.map((p) => [`${p.productName}|${p.category}`, p])
        )
        setProductChanges(
          currentProducts.map((p) => buildProductChange(p, previousProductMap.get(`${p.productName}|${p.category}`) ?? null))
        )
      }

      const comparisonType = applied ? selectionToComparisonType(applied.kind) : null
      const history = await computeHistoricalGrowth(comparisonType ?? 'year-over-year')
      setHistoricalGrowth(history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load performance data')
    } finally {
      setComputing(false)
    }
  }

  const ordersMetric = growthMetrics.find((m) => m.label === 'Orders')
  const periodHasData = ordersMetric?.current != null && ordersMetric.current > 0

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row items-center w-full gap-6 mb-8">
          <div className="min-w-0 flex-1">
            <h2 className="section-title">Performance Tracker</h2>
            <p className="section-subtitle">Compare performance across periods using mathematical calculations only.</p>
          </div>
          <div className="w-full shrink-0 sm:w-[48%]">
            <Button
              variant="brand-gold"
              size="sm"
              className="flex w-full h-[44px] items-center justify-center whitespace-nowrap rounded-full px-3"
              onClick={() => setPeriodOpen(true)}
              aria-expanded={periodOpen}
            >
              Select Reporting Period
            </Button>
          </div>
        </div>

        {/* Full-width reporting-period bar */}
        <div className="bg-cream border border-border rounded-xl p-4 md:p-5">
          {range ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rain font-medium uppercase tracking-wider">Analyzing:</span>
                <span className="font-serif text-ink">{range.label}</span>
                {range.startDate && range.endDate && (
                  <span className="text-[10px] text-rain/60">
                    {range.startDate} → {range.endDate}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearApplied()
                    setPeriodOpen(false)
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-rain/70 text-center sm:text-left">
              Select a reporting period to begin analysis.
            </p>
          )}
        </div>

        {/* Hierarchical reporting-period navigator (opens below the bar) */}
        {periodOpen && (
          <ReportingPeriodNavigator
            lines={lines}
            applied={applied}
            onApply={setApplied}
            open={periodOpen}
            onOpenChange={setPeriodOpen}
          />
        )}
        <div className="card-premium p-4">
          <p className="text-rain/60 text-sm">Loading sales data…</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {EMPTY_METRICS.map((m) => (
            <GrowthCard key={m.label} metric={m} computing />
          ))}
        </div>
        <section className="card-premium p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Product-Level Changes</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Revenue</TableHead>
                  <TableHead>Previous Revenue</TableHead>
                  <TableHead>Revenue Δ</TableHead>
                  <TableHead>Revenue %</TableHead>
                  <TableHead>Current Qty</TableHead>
                  <TableHead>Previous Qty</TableHead>
                  <TableHead>Qty Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-center py-8 text-rain/60 text-sm">
                    Loading product performance…
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
        <section className="card-premium p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Historical Growth</h3>
          </div>
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
                <TableRow>
                  <TableCell className="text-center py-8 text-rain/60 text-sm">
                    Loading historical growth…
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center w-full gap-6 mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Performance Tracker</h2>
          <p className="section-subtitle">Compare performance across periods using mathematical calculations only.</p>
        </div>
        <div className="w-full shrink-0 sm:w-[48%]">
          <Button
            variant="brand-gold"
            size="sm"
            className="flex w-full h-[44px] items-center justify-center whitespace-nowrap rounded-full px-3"
            onClick={() => setPeriodOpen(true)}
            aria-expanded={periodOpen}
          >
            Select Reporting Period
          </Button>
        </div>
      </div>

      {/* Full-width reporting-period bar */}
      <div className="bg-cream border border-border rounded-xl p-4 md:p-5">
        {range ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-rain font-medium uppercase tracking-wider">Analyzing:</span>
              <span className="font-serif text-ink">{range.label}</span>
              {range.startDate && range.endDate && (
                <span className="text-[10px] text-rain/60">
                  {range.startDate} → {range.endDate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearApplied()
                  setPeriodOpen(false)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-rain/70 text-center sm:text-left">
            Select a reporting period to begin analysis.
          </p>
        )}
      </div>

      {/* Hierarchical reporting-period navigator (opens below the bar) */}
      {periodOpen && (
        <ReportingPeriodNavigator
          lines={lines}
          applied={applied}
          onApply={setApplied}
          open={periodOpen}
          onOpenChange={setPeriodOpen}
        />
      )}

      {/* Reporting-period status area */}
      {hasError && (
        <div className="p-3 rounded bg-terracotta/15 border border-terracotta/30 text-sm text-terracotta flex items-center gap-2">
          {error}
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {!hasAnyData && !hasError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f3e8d3]/30 border border-[#a6533f]/30 text-[#a6533f] text-sm font-medium">
          No sales data imported yet.
          <Button variant="outline" size="sm" asChild>
            <Link to="/upload">Upload Data</Link>
          </Button>
        </div>
      )}

      {range && hasAnyData && !periodHasData && !hasError && (
        <div className="p-3 rounded bg-[#f3e8d3]/30 border border-[#a6533f]/30 text-sm text-[#a6533f]">
          No transactions found for the selected period.
        </div>
      )}

      {/* Comparison panel — always visible */}
      <div className="card-premium p-4">
        <div className="flex flex-col gap-2 text-sm text-rain/60">
          <div className="flex items-center gap-4">
            {periodInfo ? (
              <>
                <span>Current: {periodInfo.currentStart} → {periodInfo.currentEnd}</span>
                {periodInfo.previousStart && periodInfo.previousEnd && (
                  <span className="border-l border-line pl-4">
                    Previous ({periodInfo.previousLabel}): {periodInfo.previousStart} → {periodInfo.previousEnd}
                  </span>
                )}
                {!periodInfo.isAllTime && !periodInfo.previousStart && (
                  <span>No previous period data</span>
                )}
                {periodInfo.isAllTime && <span>Lifetime — no previous period</span>}
              </>
            ) : (
              <span className="text-rain/40">Current Period: —</span>
            )}
          </div>
          {periodInfo ? null : (
            <p className="text-xs text-rain/40">Comparison details will appear after selecting a period.</p>
          )}
          {coverageWarning && (
            <p className="mt-2 text-xs text-[#8a2f1d]">⚠ {coverageWarning}</p>
          )}
        </div>
      </div>

      {/* Growth KPI Cards — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {growthMetrics.map((m) => (
          <GrowthCard key={m.label} metric={m} computing={computing} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Product-Level Changes — always visible */}
        <section className="card-premium p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Product-Level Changes</h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Revenue</TableHead>
                  <TableHead>Previous Revenue</TableHead>
                  <TableHead>Revenue Δ</TableHead>
                  <TableHead>Revenue %</TableHead>
                  <TableHead>Current Qty</TableHead>
                  <TableHead>Previous Qty</TableHead>
                  <TableHead>Qty Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productChanges.length > 0 ? (
                  productChanges.map((p: any, i: number) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center py-8 text-rain/60 text-sm">
                      Select a reporting period to view product performance.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Historical Growth Table — always visible */}
        <section className="card-premium p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-lg text-ink">Historical Growth</h3>
          </div>
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
                {historicalGrowth.length > 0 ? (
                  historicalGrowth.map((row: any, i: number) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="text-center py-8 text-rain/60 text-sm">
                      Select a reporting period to view historical growth.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  )
}
