/**
 * Mist & Mug — Busiest Hours
 *
 * Single interactive graph with TWO visible line series on SEPARATE Y-axes:
 * Revenue (forest green, left axis, INR) and Orders (caramel, right axis,
 * unique order count). Shared hourly X-axis. No hour-selection buttons, no
 * permanent detail panel, no extra toggles.
 */

import * as React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend,
} from 'recharts'
import type { HourlyData } from '@/types'

const REVENUE_COLOR = '#142E25' // forest green
const ORDERS_COLOR = '#F0B35A' // caramel

function formatHourLabel(hour: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour} ${ampm}`
}

function formatHourRange(hour: number): string {
  const start = formatHourLabel(hour)
  const endLabel = hour === 23 ? '12 AM' : formatHourLabel(hour + 1)
  return `${start} – ${endLabel}`
}

interface BusiestHoursChartProps {
  data: HourlyData[]
}

export function BusiestHoursChart({ data }: BusiestHoursChartProps) {
  const sorted = React.useMemo(
    () => [...data].sort((a, b) => a.hour - b.hour),
    [data],
  )

  const hasData = sorted.length > 0

  const maxRevenue = Math.max(...sorted.map((d) => d.revenueInr), 0)
  const maxOrders = Math.max(...sorted.map((d) => d.orderCount), 0)

  return (
    <section className="card-premium p-6">
      <div className="flex flex-col gap-2">
        <h3 className="font-serif text-lg text-ink">Busiest Hours</h3>
        <p className="text-sm text-rain/60">Hourly sales performance</p>
      </div>

      {hasData ? (
        <div className="mt-4 h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sorted}
              margin={{ top: 24, right: 64, bottom: 36, left: 64 }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={REVENUE_COLOR} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={REVENUE_COLOR} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORDERS_COLOR} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ORDERS_COLOR} stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="2 2" stroke="#e8e0d0" vertical={false} />

              <XAxis
                dataKey="hour"
                tick={{ fontSize: 11, fill: '#78928d' }}
                tickFormatter={formatHourLabel}
                axisLine={false}
                tickLine={false}
                type="number"
                domain={['dataMin', 'dataMax']}
              />

              {/* Left Y-axis: Revenue (INR) */}
              <YAxis
                yAxisId="revenue"
                type="number"
                domain={[0, maxRevenue === 0 ? 1 : maxRevenue * 1.1]}
                tick={{ fontSize: 10, fill: REVENUE_COLOR }}
                tickFormatter={(v: number) => `₹${Math.round(v)}`}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Revenue (INR)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: REVENUE_COLOR,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />

              {/* Right Y-axis: Orders (unique count) */}
              <YAxis
                yAxisId="orders"
                type="number"
                domain={[0, maxOrders === 0 ? 1 : maxOrders * 1.1]}
                orientation="right"
                tick={{ fontSize: 10, fill: ORDERS_COLOR }}
                axisLine={false}
                tickLine={false}
                label={{
                  value: 'Orders',
                  angle: -90,
                  position: 'insideRight',
                  fill: ORDERS_COLOR,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />

              <Tooltip
                cursor={{ strokeDasharray: '2 2' }}
                content={({ active, payload }: any) => {
                  if (!active || !payload || payload.length === 0) return null
                  const entry = payload[0].payload as HourlyData
                  return (
                    <div className="bg-paper border border-line rounded-lg p-2 shadow-sm text-sm min-w-[150px]">
                      <div className="font-medium text-ink mb-1">{formatHourRange(entry.hour)}</div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: REVENUE_COLOR }} aria-hidden="true" />
                        <span className="text-rain/60 text-xs">Revenue:</span>
                        <span className="font-serif text-ink">₹{entry.revenueInr}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ORDERS_COLOR }} aria-hidden="true" />
                        <span className="text-rain/60 text-xs">Orders:</span>
                        <span className="text-ink">{entry.orderCount}</span>
                      </div>
                    </div>
                  )
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                height={36}
                formatter={(value: any) => {
                  if (value === 'Revenue') return 'Revenue'
                  if (value === 'Orders') return 'Orders'
                  return value
                }}
              />

              <Line
                type="monotone"
                dataKey="revenueInr"
                yAxisId="revenue"
                stroke={REVENUE_COLOR}
                strokeWidth={2.5}
                dot={{ fill: REVENUE_COLOR, stroke: '#241a12', strokeWidth: 1.5 }}
                animationDuration={0}
              >
                {sorted.map((_, index) => (
                  <Cell key={`rev-${index}`} fill={REVENUE_COLOR} />
                ))}
              </Line>

              <Line
                type="monotone"
                dataKey="orderCount"
                yAxisId="orders"
                stroke={ORDERS_COLOR}
                strokeWidth={2.5}
                dot={{ fill: ORDERS_COLOR, stroke: '#241a12', strokeWidth: 1.5 }}
                animationDuration={0}
              >
                {sorted.map((_, index) => (
                  <Cell key={`ord-${index}`} fill={ORDERS_COLOR} />
                ))}
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-6 text-sm text-rain/60 text-center">
          No hourly data available (time not recorded in upload).
        </p>
      )}
    </section>
  )
}
