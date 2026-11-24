/**
 * Mist & Mug — Sales Analytics Page
 *
 * Real analytics computed from imported transaction data, filtered by a
 * hierarchical reporting period chosen through the shared
 * ReportingPeriodNavigator.
 *
 * The complete dashboard layout always renders. Content within each section
 * responds to the current data state: no period selected, no imported data,
 * loading, ready, empty period, or error.
 *
 * Selection and application are separate states: analytics only change after
 * the user clicks Apply. All available periods are derived from actual
 * imported transaction dates, never from the system clock.
 */

import * as React from 'react'
import { ReportingPeriodNavigator } from '@/components/common/ReportingPeriodNavigator'
import {
  computeDashboardMetrics,
  computeTopProducts,
  computeHourlyData,
  computeWeekdayWeekend,
  computeDailyTrend,
  computeMonthlyTrend,
  computeYearlyTrend,
} from '@/lib/analytics'
import { getAllImportLines } from '@/db'
import { resolveSelection, type ResolvedPeriod } from '@/lib/reporting-periods'
import { useReportingPeriodState } from '@/lib/useReportingPeriodState'
import type { ProcessedLine } from '@/types'
import type { TrendBucket } from '@/lib/analytics'
import { onDataChanged } from '@/lib/events'
import { formatDate, formatInr } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WeekdayWeekendChart } from '@/components/analytics/WeekdayWeekendChart'
import { TopSellingProducts } from '@/components/analytics/TopSellingProducts'
import { RevenueTrends } from '@/components/analytics/RevenueTrends'
import { BusiestHoursChart } from '@/components/analytics/BusiestHoursChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Link } from 'react-router-dom'

const ANALYTICS_STORAGE_KEY = 'mistmug:analytics:appliedPeriod'

const EMPTY_METRICS = {
  revenueInr: 0,
  orderCount: 0,
  itemsSold: 0,
  averageOrderValue: 0,
}

function RevenueTrendsPlaceholder() {
  return (
    <section className="card-premium p-5">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-lg text-ink">Revenue Trends</h3>
          <p className="text-sm text-rain/60">
            Select a reporting period to view revenue trends · Daily sales performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Chart
          </Button>
          <Button variant="outline" size="sm" disabled>
            Table
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Total Revenue</p>
          <p className="mt-1 text-xl font-serif text-ink text-rain/40">—</p>
        </div>
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Unique Orders</p>
          <p className="mt-1 text-xl font-serif text-ink text-rain/40">—</p>
        </div>
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Items Sold</p>
          <p className="mt-1 text-xl font-serif text-ink text-rain/40">—</p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-end justify-between mb-3 gap-2">
          <div className="flex flex-col gap-1">
            <h4 className="font-serif text-base text-ink">Daily Revenue</h4>
            <p className="text-xs text-rain/60">Select a day to inspect sales</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              Bars
            </Button>
            <Button variant="outline" size="sm" disabled>
              Line
            </Button>
          </div>
        </div>
        <div className="h-[320px] w-full flex items-center justify-center">
          <p className="text-rain/60 text-sm">No revenue trend data available.</p>
        </div>
      </div>
    </section>
  )
}

function TopSellingProductsPlaceholder() {
  return (
    <section className="card-premium p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h3 className="font-serif text-lg text-ink">Top-Selling Products</h3>
      </div>

      <div className="overflow-x-auto mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead className="text-right">Qty Sold</TableHead>
              <TableHead className="text-right">Avg Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-center py-8 text-rain/60 text-sm">
                Select a reporting period to view top-selling products.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function WeekdayVsWeekendPlaceholder() {
  return (
    <section className="card-premium p-5">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-lg text-ink">Weekday vs Weekend</h3>
        <p className="text-sm text-rain/60">Select a reporting period to compare weekday and weekend performance.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Comparison metric">
        <Button size="sm" variant="outline" disabled>
          Revenue
        </Button>
        <Button size="sm" variant="outline" disabled>
          Orders
        </Button>
        <Button size="sm" variant="outline" disabled>
          Daily Avg.
        </Button>
      </div>

      <div className="h-48 flex items-center justify-center">
        <p className="text-rain/60 text-sm">No weekday vs weekend data available.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="p-4 bg-sage/15 rounded-lg border border-sage/30">
          <p className="text-xs text-forest uppercase tracking-wider">Weekday Revenue</p>
          <p className="text-lg font-serif text-ink text-rain/40">—</p>
        </div>
        <div className="p-4 bg-terracotta/15 rounded-lg border border-terracotta/30">
          <p className="text-xs text-terracotta uppercase tracking-wider">Weekend Revenue</p>
          <p className="text-lg font-serif text-ink text-rain/40">—</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="p-4 bg-sage/15 rounded-lg border border-sage/30">
          <p className="text-xs text-forest uppercase tracking-wider">Avg per Weekday</p>
          <p className="text-lg font-serif text-ink text-rain/40">—</p>
        </div>
        <div className="p-4 bg-terracotta/15 rounded-lg border border-terracotta/30">
          <p className="text-xs text-terracotta uppercase tracking-wider">Avg per Weekend Day</p>
          <p className="text-lg font-serif text-ink text-rain/40">—</p>
        </div>
      </div>
      <div className="p-3 rounded bg-paper/50 border border-line mt-4">
        <p className="text-sm text-rain/60">
          Weekdays: — days observed, — orders
        </p>
        <p className="text-sm text-rain/60">
          Weekends: — days observed, — orders
        </p>
      </div>
    </section>
  )
}

function BusiestHoursPlaceholder() {
  return (
    <section className="card-premium p-5">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-lg text-ink">Busiest Hours</h3>
        <p className="text-sm text-rain/60">Hourly sales performance</p>
      </div>

      <div className="mt-4 h-[320px] w-full flex items-center justify-center">
        <p className="text-rain/60 text-sm">No hourly data available (select a reporting period).</p>
      </div>
    </section>
  )
}

export function SalesAnalytics() {
  const [lines, setLines] = React.useState<ProcessedLine[]>([])
  const [initialLoading, setInitialLoading] = React.useState(true)

  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey: ANALYTICS_STORAGE_KEY,
    lines,
  })

  const [computing, setComputing] = React.useState(false)
  const [metrics, setMetrics] = React.useState<{
    revenueInr: number
    orderCount: number
    itemsSold: number
    averageOrderValue: number
  } | null>(null)
  const [topProducts, setTopProducts] = React.useState<Array<any>>([])
  const [hourlyData, setHourlyData] = React.useState<Array<any>>([])
  const [weekdayWeekend, setWeekdayWeekend] = React.useState<any>(null)
  const [trendData, setTrendData] = React.useState<Array<any>>([])
  const [granularity, setGranularity] = React.useState<'Daily' | 'Monthly' | 'Yearly'>('Daily')
  const [periodRangeLabel, setPeriodRangeLabel] = React.useState('')
  const [periodOpen, setPeriodOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [range, setRange] = React.useState<ResolvedPeriod | null>(null)

  // Monotonically increasing id used to ignore analytics responses from
  // requests that are superseded by a Clear or new selection.
  const analyticsRequestId = React.useRef(0)

  const hasAnyData = lines.some((l) => l.isValid && !l.isDuplicate && l.date)
  const isLoading = initialLoading || computing
  const hasError = error != null
  const noPeriod = !applied
  const periodHasData = metrics?.orderCount ?? 0 > 0

  // Resolve the applied selection to an inclusive date range whenever it changes.
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
      // Clear was clicked (or selection invalidated): reset every period-dependent
      // display so stale metrics/charts/tables never linger.
      analyticsRequestId.current += 1
      setMetrics(null)
      setTopProducts([])
      setHourlyData([])
      setWeekdayWeekend(null)
      setTrendData([])
      setGranularity('Daily')
      setPeriodRangeLabel('')
      setError(null)
      return
    }
    const requestId = ++analyticsRequestId.current
    loadAnalytics(requestId)
  }, [range])

  // Recompute when data changes (e.g. after upload deletion or product edit).
  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadData()
      // Product edits don't change import lines, so the [range] effect won't
      // re-fire. Explicitly recompute analytics so category reattribution takes
      // effect immediately (e.g. after editing a product category).
      if (range) loadAnalytics(++analyticsRequestId.current)
    })
    return unsubscribe
  }, [range])

  async function loadAnalytics(requestId: number) {
    if (requestId !== analyticsRequestId.current) return
    setComputing(true)
    setError(null)
    try {
      const { startDate: start, endDate: end } = range!
      if (requestId !== analyticsRequestId.current) return
      const m = await computeDashboardMetrics(start, end)
      if (requestId !== analyticsRequestId.current) return
      const tp = await computeTopProducts(start, end, Infinity)
      if (requestId !== analyticsRequestId.current) return
      const hd = await computeHourlyData(start, end)
      if (requestId !== analyticsRequestId.current) return
      const ww = await computeWeekdayWeekend(start, end)
      if (requestId !== analyticsRequestId.current) return

      let granularity: 'Daily' | 'Monthly' | 'Yearly' = 'Daily'
      let td: TrendBucket[]
      switch (range!.selection.kind) {
        case 'year':
          granularity = 'Monthly'
          td = await computeMonthlyTrend(start, end)
          break
        case 'all-time':
          granularity = 'Yearly'
          td = await computeYearlyTrend(start, end)
          break
        default:
          granularity = 'Daily'
          const daily = await computeDailyTrend(start, end)
          td = daily.map((d) => ({
            period: d.date,
            periodKey: d.date,
            revenueInr: d.revenueInr,
            orderCount: d.orderCount,
            itemsSold: d.itemsSold,
          }))
      }
      if (requestId !== analyticsRequestId.current) return

      setMetrics(m)
      setTopProducts(tp)
      setHourlyData(hd)
      setWeekdayWeekend(ww)
      setTrendData(td)
      setGranularity(granularity)
      setPeriodRangeLabel(`${formatDate(start)} – ${formatDate(end)}`)
    } catch (err) {
      if (requestId !== analyticsRequestId.current) return
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      if (requestId !== analyticsRequestId.current) return
      setComputing(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center w-full gap-6 mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Sales Analytics</h2>
          <p className="section-subtitle">Real analytics computed from imported sales data.</p>
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

      {/* Error state */}
      {hasError && (
        <div className="p-3 rounded bg-[#f5dede]/30 border border-[#8a2f1d]/30 text-sm text-[#8a2f1d] flex items-center gap-2">
          {error}
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* No imported data */}
      {!hasAnyData && !hasError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-terracotta/15 border border-terracotta/30 text-terracotta text-sm font-medium">
          No sales data imported yet.
          <Button variant="outline" size="sm" asChild>
            <Link to="/upload">Upload Data</Link>
          </Button>
        </div>
      )}

      {/* Empty selected period */}
      {range && hasAnyData && !periodHasData && !hasError && (
        <div className="p-3 rounded bg-terracotta/15 border border-terracotta/30 text-sm text-terracotta">
          No transactions found for the selected period.
        </div>
      )}

      {/* Page-level KPI cards — always visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="card-premium p-5">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Total Revenue</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-serif text-ink">
              {metrics ? formatInr(metrics.revenueInr) : '—'}
            </span>
          </div>
        </div>
        <div className="card-premium p-5">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Unique Orders</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-serif text-ink">
              {metrics ? metrics.orderCount : '—'}
            </span>
          </div>
        </div>
        <div className="card-premium p-5">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Items Sold</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-serif text-ink">
              {metrics ? metrics.itemsSold : '—'}
            </span>
          </div>
        </div>
        <div className="card-premium p-5">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Avg Order Value</p>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-serif text-ink">
              {metrics ? formatInr(Math.round(metrics.averageOrderValue)) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Top-Selling Products — always visible */}
        <section className="card-premium p-5 lg:col-span-3">
          {isLoading ? (
            <>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <h3 className="font-serif text-lg text-ink">Top-Selling Products</h3>
              </div>
              <div className="overflow-x-auto mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Avg Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-center py-8 text-rain/60 text-sm">
                        Loading top-selling products…
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </>
          ) : noPeriod ? (
            <TopSellingProductsPlaceholder />
          ) : (
            <TopSellingProducts products={topProducts} />
          )}
        </section>

        {/* Weekday vs Weekend — full width unified section */}
        <section className="card-premium p-5 lg:col-span-3">
          {isLoading ? (
            <WeekdayVsWeekendPlaceholder />
          ) : noPeriod || !weekdayWeekend ? (
            <WeekdayVsWeekendPlaceholder />
          ) : (
            <WeekdayWeekendChart data={weekdayWeekend} />
          )}
        </section>
      </div>

      {/* Revenue Trends — always visible */}
      {isLoading ? (
        <RevenueTrendsPlaceholder />
      ) : noPeriod || range === null ? (
        <RevenueTrendsPlaceholder />
      ) : (
        <RevenueTrends
          trendData={trendData}
          metrics={metrics ?? EMPTY_METRICS}
          periodRangeLabel={periodRangeLabel}
          granularity={granularity}
        />
      )}

      {/* Busiest Hours — always visible */}
      {isLoading ? (
        <BusiestHoursPlaceholder />
      ) : noPeriod ? (
        <BusiestHoursPlaceholder />
      ) : (
        <BusiestHoursChart data={hourlyData} />
      )}
    </div>
  )
}
