/**
 * Mist & Mug — Sales Analytics Page
 *
 * Real analytics computed from imported transaction data, filtered by a
 * hierarchical reporting period chosen through the shared
 * ReportingPeriodNavigator.
 *
 * Selection and application are separate states: analytics only change after
 * the user clicks Apply. All available periods are derived from actual
 * imported transaction dates, never from the system clock.
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
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
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WeekdayWeekendChart } from '@/components/analytics/WeekdayWeekendChart'
import { TopSellingProducts } from '@/components/analytics/TopSellingProducts'
import { RevenueTrends } from '@/components/analytics/RevenueTrends'
import { BusiestHoursChart } from '@/components/analytics/BusiestHoursChart'
import { Link } from 'react-router-dom'

const ANALYTICS_STORAGE_KEY = 'mistmug:analytics:appliedPeriod'

export function SalesAnalytics() {
  const [lines, setLines] = React.useState<ProcessedLine[]>([])
  const [loading, setLoading] = React.useState(true)

  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey: ANALYTICS_STORAGE_KEY,
    lines,
  })

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
  const [hasData, setHasData] = React.useState(false)
  const [granularity, setGranularity] = React.useState<'Daily' | 'Monthly' | 'Yearly'>('Daily')
  const [periodRangeLabel, setPeriodRangeLabel] = React.useState('')

  const [range, setRange] = React.useState<ResolvedPeriod | null>(null)

  // Resolve the applied selection to an inclusive date range whenever it changes.
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
    if (!range) return
    loadAnalytics()
  }, [range])

  // Recompute when data changes (e.g. after upload deletion or product edit).
  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadData()
      // Product edits don't change import lines, so the [range] effect won't
      // re-fire. Explicitly recompute analytics so category reattribution takes
      // effect immediately (e.g. after editing a product category).
      if (range) loadAnalytics()
    })
    return unsubscribe
  }, [range])

  async function loadAnalytics() {
    const { startDate: start, endDate: end } = range!
    const m = await computeDashboardMetrics(start, end)
    const tp = await computeTopProducts(start, end, Infinity)
    const hd = await computeHourlyData(start, end)
    const ww = await computeWeekdayWeekend(start, end)

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

    setMetrics(m)
    setTopProducts(tp)
    setHourlyData(hd)
    setWeekdayWeekend(ww)
    setTrendData(td)
    setGranularity(granularity)
    setPeriodRangeLabel(`${formatDate(start)} – ${formatDate(end)}`)
    setHasData(m.orderCount > 0 || m.itemsSold > 0)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-rain/60 text-sm">Loading analytics…</p>
      </div>
    )
  }

  const hasAnyData = lines.some((l) => l.isValid && !l.isDuplicate && l.date)

  // No sales data at all: empty state with path to Upload Data.
  if (!hasAnyData) {
    return (
      <div className="space-y-8">
        <SectionHeader
          title="Sales Analytics"
          description="Real analytics computed from imported sales data."
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
          title="No sales data yet"
          description="Import sales files via Upload Data to populate analytics. All calculations use actual historical transaction prices."
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
          title="Sales Analytics"
          description="Real analytics computed from imported sales data. Select a time period to filter results."
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

  // Period applied: show it prominently above the analytics.
  const resolved = range
  return (
    <div className="space-y-8">
      <SectionHeader
        title="Sales Analytics"
        description="Real analytics computed from imported sales data."
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

      {!hasData ? (
        <EmptyState
          title="No data for this period"
          description="No sales transactions were recorded in the selected period. Choose a different period."
          action={
            <Button variant="outline" size="sm" onClick={() => setApplied(null)}>
              Choose another period
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card-premium p-6">
              <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Total Revenue</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-serif text-ink">₹{metrics?.revenueInr ?? 0}</span>
              </div>
            </div>
            <div className="card-premium p-6">
              <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Unique Orders</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-serif text-ink">{metrics?.orderCount ?? 0}</span>
              </div>
            </div>
            <div className="card-premium p-6">
              <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Items Sold</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-serif text-ink">{metrics?.itemsSold ?? 0}</span>
              </div>
            </div>
            <div className="card-premium p-6">
              <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Avg Order Value</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-serif text-ink">₹{Math.round(metrics?.averageOrderValue ?? 0)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Top-Selling Products */}
            <TopSellingProducts products={topProducts} />

            {/* Weekday vs Weekend */}
            <WeekdayWeekendChart data={weekdayWeekend} />
            {weekdayWeekend ? (
              <section className="card-premium p-6 mt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#d8e8dc]/30 rounded-lg border border-[#1e5e3a]/30">
                      <p className="text-xs text-[#1e5e3a] uppercase tracking-wider">Weekday Revenue</p>
                      <p className="text-lg font-serif text-ink">₹{weekdayWeekend.weekdayRevenue}</p>
                    </div>
                    <div className="p-4 bg-[#f3e8d3]/30 rounded-lg border border-[#a6533f]/30">
                      <p className="text-xs text-[#a6533f] uppercase tracking-wider">Weekend Revenue</p>
                      <p className="text-lg font-serif text-ink">₹{weekdayWeekend.weekendRevenue}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#d8e8dc]/30 rounded-lg border border-[#1e5e3a]/30">
                      <p className="text-xs text-[#1e5e3a] uppercase tracking-wider">Avg per Weekday</p>
                      <p className="text-lg font-serif text-ink">
                        {weekdayWeekend.averageWeekdayRevenue !== null ? `₹${weekdayWeekend.averageWeekdayRevenue}` : '—'}
                      </p>
                    </div>
                    <div className="p-4 bg-[#f3e8d3]/30 rounded-lg border border-[#a6533f]/30">
                      <p className="text-xs text-[#a6533f] uppercase tracking-wider">Avg per Weekend Day</p>
                      <p className="text-lg font-serif text-ink">
                        {weekdayWeekend.averageWeekendRevenue !== null ? `₹${weekdayWeekend.averageWeekendRevenue}` : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-paper/50 border border-line">
                    <p className="text-sm text-rain/60">
                      Weekdays: {weekdayWeekend.weekdayCount} days observed, {weekdayWeekend.weekdayOrderCount} orders
                    </p>
                    <p className="text-sm text-rain/60">
                      Weekends: {weekdayWeekend.weekendCount} days observed, {weekdayWeekend.weekendOrderCount} orders
                    </p>
                    {weekdayWeekend.percentageDifference !== null && (
                      <p className="text-sm text-rain/60">
                        Difference: {weekdayWeekend.percentageDifference > 0 ? '+' : ''}{weekdayWeekend.percentageDifference}%
                      </p>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {/* Revenue Trends */}
          <RevenueTrends
            trendData={trendData}
            metrics={metrics ?? { revenueInr: 0, orderCount: 0, itemsSold: 0, averageOrderValue: 0 }}
            periodRangeLabel={periodRangeLabel}
            granularity={granularity}
          />

          {/* Busiest Hours */}
          <BusiestHoursChart data={hourlyData} />
        </>
      )}
    </div>
  )
}
