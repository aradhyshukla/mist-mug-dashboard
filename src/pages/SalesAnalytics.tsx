/**
 * Mist & Mug — Sales Analytics Page (Phase 2)
 *
 * Real analytics computed from imported transaction data.
 * Time filters: Week | Month | Year | All Time
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
import { Clock } from 'lucide-react'
import {
  computeDashboardMetrics,
  computeTopProducts,
  computeHourlyData,
  computeWeekdayWeekend,
  computeDailyTrend,
  computeCategoryPerformance,
} from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type TimePeriod = 'week' | 'month' | 'year' | 'all-time'

const PERIODS: Array<{ value: TimePeriod; label: string }> = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all-time', label: 'All Time' },
]

export function SalesAnalytics() {
  const [period, setPeriod] = React.useState<TimePeriod>('all-time')
  const [loading, setLoading] = React.useState(true)
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
  const [categoryData, setCategoryData] = React.useState<Array<any>>([])
  const [hasData, setHasData] = React.useState(false)

  React.useEffect(() => {
    loadAnalytics()
  }, [period])

  async function loadAnalytics() {
    setLoading(true)
    const m = await computeDashboardMetrics()
    const tp = await computeTopProducts(undefined, undefined, 5)
    const hd = await computeHourlyData()
    const ww = await computeWeekdayWeekend()
    const td = await computeDailyTrend()
    const cd = await computeCategoryPerformance()

    setMetrics(m)
    setTopProducts(tp)
    setHourlyData(hd)
    setWeekdayWeekend(ww)
    setTrendData(td)
    setCategoryData(cd)
    setHasData(m.orderCount > 0 || m.itemsSold > 0)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-rain/60 text-sm">Loading analytics…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Sales Analytics"
        description="Real analytics computed from imported sales data. Select a time period to filter results."
        action={
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? 'brand' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      {!hasData ? (
        <EmptyState
          title="No sales data yet"
          description="Import sales files via Upload Data to populate analytics. All calculations use actual historical transaction prices."
          icon={<Clock className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
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
            <section className="card-premium p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-lg text-ink">Top-Selling Products</h3>
                <Button variant="outline" size="sm" onClick={() => setTopProducts([])}>
                  View by Quantity
                </Button>
              </div>
              {topProducts.length === 0 ? (
                <EmptyState title="No products" description="No product data available for this period." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Qty Sold</TableHead>
                        <TableHead>Avg Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map((p: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm font-medium text-ink">{p.productName}</TableCell>
                          <TableCell className="text-sm text-rain/60">{p.category}</TableCell>
                          <TableCell className="text-sm font-serif text-ink">₹{p.revenueInr}</TableCell>
                          <TableCell className="text-sm text-ink">{p.quantitySold}</TableCell>
                          <TableCell className="text-sm text-ink">₹{Math.round(p.averageSellingPrice)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>

            {/* Weekday vs Weekend */}
            <section className="card-premium p-6">
              <h3 className="font-serif text-lg text-ink mb-4">Weekday vs Weekend</h3>
              {weekdayWeekend ? (
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
              ) : (
                <EmptyState title="No data" description="No weekday/weekend data available." />
              )}
            </section>
          </div>

          {/* Revenue Trends */}
          <section className="card-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-lg text-ink">Revenue Trends</h3>
            </div>
            {trendData.length === 0 ? (
              <EmptyState title="No trend data" description="No daily trend data available for this period." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Orders</TableHead>
                      <TableHead>Items</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trendData.map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium text-ink">{d.date}</TableCell>
                        <TableCell className="text-sm font-serif text-ink">₹{d.revenueInr}</TableCell>
                        <TableCell className="text-sm text-ink">{d.orderCount}</TableCell>
                        <TableCell className="text-sm text-ink">{d.itemsSold}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Category Performance */}
          <section className="card-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-lg text-ink">Category Performance</h3>
            </div>
            {categoryData.length === 0 ? (
              <EmptyState title="No category data" description="No category data available for this period." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Qty Sold</TableHead>
                      <TableHead>Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryData.map((c: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium text-ink">{c.category}</TableCell>
                        <TableCell className="text-sm font-serif text-ink">₹{c.revenueInr}</TableCell>
                        <TableCell className="text-sm text-ink">{c.quantitySold}</TableCell>
                        <TableCell className="text-sm text-ink">{c.productCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {/* Hourly Data */}
          <section className="card-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-serif text-lg text-ink">Busiest Hours</h3>
            </div>
            {hourlyData.length === 0 ? (
              <EmptyState title="No hourly data" description="No hourly data available (time not recorded in upload)." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hour</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Orders</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hourlyData.map((h: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium text-ink">{h.hour}:00</TableCell>
                        <TableCell className="text-sm font-serif text-ink">₹{h.revenueInr}</TableCell>
                        <TableCell className="text-sm text-ink">{h.orderCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
