/**
 * Mist & Mug — Weekday vs Weekend Chart
 *
 * Interactive horizontal bar chart comparing weekday vs weekend performance.
 * Supports three metrics: Revenue, Orders, Daily Avg. Default is Revenue.
 * Uses actual analytics values; no hardcoded financial data.
 */

import * as React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { formatInr } from '@/lib/utils'

const FOREST = '#142E25' // deep forest green
const TERRACOTTA = '#A6533F' // muted terracotta

export type WeekdayWeekendMetric = 'revenue' | 'orders' | 'dailyAvg'

export interface WeekdayWeekendChartData {
  weekdayRevenue: number
  weekendRevenue: number
  weekdayOrderCount: number
  weekendOrderCount: number
  averageWeekdayRevenue: number | null
  averageWeekendRevenue: number | null
}

interface WeekdayWeekendChartProps {
  data: WeekdayWeekendChartData | null
}

const METRICS: WeekdayWeekendMetric[] = ['revenue', 'orders', 'dailyAvg']

const METRIC_LABELS: Record<WeekdayWeekendMetric, string> = {
  revenue: 'Revenue',
  orders: 'Orders',
  dailyAvg: 'Daily Avg.',
}

export function WeekdayWeekendChart({ data }: WeekdayWeekendChartProps) {
  const [metric, setMetric] = React.useState<WeekdayWeekendMetric>('revenue')

  const items = React.useMemo(() => {
    if (!data) return []
    switch (metric) {
      case 'revenue':
        return [
          { name: 'Weekdays', value: data.weekdayRevenue },
          { name: 'Weekends', value: data.weekendRevenue },
        ]
      case 'orders':
        return [
          { name: 'Weekdays', value: data.weekdayOrderCount },
          { name: 'Weekends', value: data.weekendOrderCount },
        ]
      case 'dailyAvg':
        return [
          { name: 'Weekdays', value: data.averageWeekdayRevenue ?? 0 },
          { name: 'Weekends', value: data.averageWeekendRevenue ?? 0 },
        ]
    }
  }, [data, metric])

  const hasValues = items.some((item) => item.value > 0)

  return (
    <section className="card-premium p-6">
      <h3 className="font-serif text-lg text-ink mb-4">Weekday vs Weekend</h3>

      {/* Interactive metric selector */}
      <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Comparison metric">
        {METRICS.map((m) => (
          <Button
            key={m}
            size="sm"
            variant={metric === m ? 'brand' : 'outline'}
            onClick={() => setMetric(m)}
            aria-pressed={metric === m}
            aria-label={`${METRIC_LABELS[m]} metric, ${metric === m ? 'selected' : 'not selected'}`}
          >
            {METRIC_LABELS[m]}
          </Button>
        ))}
      </div>

      {/* Horizontal comparison chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={items}
            barCategoryGap={40}
            margin={{ top: 20, right: 24, bottom: 24, left: 80 }}
          >
            <defs>
              <linearGradient id="weekdayGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={FOREST} />
                <stop offset="100%" stopColor="#2a4a3c" />
              </linearGradient>
              <linearGradient id="weekendGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={TERRACOTTA} />
                <stop offset="100%" stopColor="#b87058" />
              </linearGradient>
            </defs>

            <XAxis
              type="number"
              dataKey="value"
              hide
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fill: '#241a12', fontSize: 14, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }: any) => {
                if (!active || !payload || payload.length === 0) return null
                const entry = payload[0].payload as any
                const label = metric === 'orders' ? `${Math.round(entry.value)} orders` : formatInr(entry.value)
                return (
                  <div className="bg-paper border border-line rounded-lg p-2 shadow-sm text-sm">
                    <div className="font-medium text-ink">{entry.name}</div>
                    <div className="text-rain/60">{label}</div>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="value"
              radius={4}
              animationDuration={0}
              background={{ radius: 4, fill: '#e8e0d0' }}
            >
              {items.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? 'url(#weekdayGradient)' : 'url(#weekendGradient)'}
                />
              ))}
            </Bar>
            <LabelList
              dataKey="value"
              position="insideRight"
              offset={8}
              fill="#241a12"
              fontSize={13}
              fontWeight={700}
              formatter={(value: number) => {
                if (metric === 'orders') return String(Math.round(value))
                return formatInr(value)
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {!hasValues && data && (
        <p className="mt-4 text-sm text-rain/60">No recorded sales for the selected period.</p>
      )}
    </section>
  )
}
