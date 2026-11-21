/**
 * Mist & Mug — Revenue Trends
 *
 * Interactive revenue trend chart/table with Bars|Line and Chart|Table toggles,
 * a selected-bucket detail panel, and three KPI cards. Grouping follows the
 * applied reporting period (week/month → daily, year → monthly, All Time →
 * yearly). The selected chart point is local only and never changes the global
 * reporting period.
 */

import * as React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { formatInr, formatDate } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { DashboardMetrics } from '@/types'
import type { TrendBucket } from '@/lib/analytics'

const CARAMEL = '#F0B35A'
const FOREST = '#142E25'

interface RevenueTrendsProps {
  trendData: TrendBucket[]
  metrics: DashboardMetrics
  periodRangeLabel: string
  granularity: 'Daily' | 'Monthly' | 'Yearly'
}

function bucketFormatter(entry: TrendBucket): JSX.Element {
  return (
    <div className="bg-paper border border-line rounded-lg p-2 shadow-sm text-sm">
      <div className="font-medium text-ink">{entry.period}</div>
      <div className="text-rain/60">
        {formatInr(entry.revenueInr)} · {entry.orderCount} orders · {entry.itemsSold} items
      </div>
    </div>
  )
}

function axisFormatter(value: number): string {
  return formatInr(value)
}

export function RevenueTrends({ trendData, metrics, periodRangeLabel, granularity }: RevenueTrendsProps) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart')
  const [chartType, setChartType] = React.useState<'bars' | 'line'>('bars')
  const [selected, setSelected] = React.useState<TrendBucket | null>(null)

  const totalRevenue = trendData.reduce((sum, d) => sum + d.revenueInr, 0)
  const totalItems = trendData.reduce((sum, d) => sum + d.itemsSold, 0)

  const maxY = Math.max(...trendData.map((d) => d.revenueInr), 0)
  const yDomain = [0, maxY === 0 ? 1 : maxY * 1.1]

  const renderChart = () => {
    if (chartType === 'bars') {
      return (
        <BarChart
          data={trendData}
          margin={{ top: 20, right: 24, bottom: 48, left: 48 }}
          barGap={2}
          barCategoryGap={6}
        >
          <CartesianGrid strokeDasharray="2 2" stroke="#e8e0d0" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 10, fill: '#241a12' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            domain={yDomain}
            tick={{ fill: '#78928d', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={axisFormatter}
          />
          <Tooltip
            cursor={false}
            content={({ active, payload }: any) => {
              if (!active || !payload || payload.length === 0) return null
              return bucketFormatter(payload[0].payload as TrendBucket)
            }}
          />
          <Bar dataKey="revenueInr" radius={2} animationDuration={0}>
            {trendData.map((d) => (
              <Cell
                key={d.periodKey}
                fill={selected?.periodKey === d.periodKey ? FOREST : CARAMEL}
                onClick={() => setSelected(d)}
              />
            ))}
          </Bar>
        </BarChart>
      )
    }
    return (
      <LineChart data={trendData} margin={{ top: 20, right: 24, bottom: 48, left: 48 }}>
        <CartesianGrid strokeDasharray="2 2" stroke="#e8e0d0" vertical={false} />
        <XAxis
          dataKey="period"
          tick={{ fontSize: 10, fill: '#241a12' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="number"
          domain={yDomain}
          tick={{ fill: '#78928d', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={axisFormatter}
        />
        <Tooltip
          cursor={false}
          content={({ active, payload }: any) => {
            if (!active || !payload || payload.length === 0) return null
            return bucketFormatter(payload[0].payload as TrendBucket)
          }}
        />
        <Line
          type="monotone"
          dataKey="revenueInr"
          stroke={CARAMEL}
          strokeWidth={2}
          dot={{ fill: CARAMEL, stroke: '#241a12', strokeWidth: 1 }}
          animationDuration={0}
        />
        {selected && (
          <Line
            data={[selected]}
            type="monotone"
            dataKey="revenueInr"
            stroke={FOREST}
            strokeWidth={2}
            dot={{ fill: FOREST, stroke: '#241a12', strokeWidth: 2 }}
          />
        )}
      </LineChart>
    )
  }

  return (
    <section className="card-premium p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-lg text-ink">Revenue Trends</h3>
          <p className="text-sm text-rain/60">
            {periodRangeLabel} · {granularity} sales performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={view === 'chart' ? 'brand' : 'outline'} size="sm" onClick={() => setView('chart')}>
            Chart
          </Button>
          <Button variant={view === 'table' ? 'brand' : 'outline'} size="sm" onClick={() => setView('table')}>
            Table
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Total Revenue</p>
          <p className="mt-1 text-2xl font-serif text-ink">{formatInr(metrics.revenueInr)}</p>
        </div>
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Unique Orders</p>
          <p className="mt-1 text-2xl font-serif text-ink">{metrics.orderCount}</p>
        </div>
        <div className="p-4 rounded-lg border border-line bg-paper/50">
          <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Items Sold</p>
          <p className="mt-1 text-2xl font-serif text-ink">{metrics.itemsSold}</p>
        </div>
      </div>

      {view === 'chart' && (
        <div className="mt-6">
          <div className="flex items-end justify-between mb-3 gap-2">
            <div className="flex flex-col gap-1">
              <h4 className="font-serif text-base text-ink">Daily Revenue</h4>
              <p className="text-xs text-rain/60">Select a day to inspect sales</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={chartType === 'bars' ? 'brand' : 'outline'} size="sm" onClick={() => setChartType('bars')}>
                Bars
              </Button>
              <Button variant={chartType === 'line' ? 'brand' : 'outline'} size="sm" onClick={() => setChartType('line')}>
                Line
              </Button>
            </div>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>

          {/* Selected bucket detail panel */}
          {selected && (
            <div className="mt-4 p-3 rounded-lg border border-line bg-paper/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Selected period</p>
                <p className="text-sm font-medium text-ink">{selected.period}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Revenue</p>
                <p className="text-sm font-serif text-ink">{formatInr(selected.revenueInr)}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Unique orders</p>
                <p className="text-sm text-ink">{selected.orderCount}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-xs text-rain/50 uppercase tracking-wider font-medium">Items sold</p>
                <p className="text-sm text-ink">{selected.itemsSold}</p>
              </div>
              <p className="text-xs text-rain/50 text-center sm:text-right">
                Sum of all buckets: {formatInr(totalRevenue)} revenue · {totalItems} items
              </p>
            </div>
          )}
        </div>
      )}

      {view === 'table' && (
        <div className="mt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date / Period</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trendData.map((d) => (
                <TableRow key={d.periodKey}>
                  <TableCell className="text-sm font-medium text-ink">
                    {granularity === 'Daily' ? formatDate(d.period) : d.period}
                  </TableCell>
                  <TableCell className="text-sm font-serif text-right text-ink">{formatInr(d.revenueInr)}</TableCell>
                  <TableCell className="text-sm text-right text-ink">{d.orderCount}</TableCell>
                  <TableCell className="text-sm text-right text-ink">{d.itemsSold}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium border-t border-line">
                <TableCell className="text-sm text-ink">Total</TableCell>
                <TableCell className="text-sm font-serif text-right text-ink">{formatInr(totalRevenue)}</TableCell>
                <TableCell className="text-sm text-right text-ink">{trendData.reduce((s, d) => s + d.orderCount, 0)}</TableCell>
                <TableCell className="text-sm text-right text-ink">{totalItems}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
