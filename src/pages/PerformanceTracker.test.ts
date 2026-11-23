/**
 * Mist & Mug — Performance Tracker Tests
 *
 * Tests for the empty-state redesign: formatting functions, metric building,
 * date range calculations, and comparison type mapping.
 */

import { describe, it, expect } from 'vitest'
import {
  formatPct,
  formatAbs,
  formatMetricValue,
  buildMetric,
  daysInRange,
  selectionToComparisonType,
} from '@/pages/PerformanceTracker'

describe('formatMetricValue', () => {
  it('formats Revenue with ₹ and Indian digit grouping', () => {
    expect(formatMetricValue('Revenue', 198360)).toBe('₹1,98,360')
    expect(formatMetricValue('Revenue', 0)).toBe('₹0')
    expect(formatMetricValue('Revenue', 308.49)).toBe('₹308.49')
  })

  it('formats Avg Order Value with ₹ and Indian digit grouping', () => {
    expect(formatMetricValue('Avg Order Value', 308.49)).toBe('₹308.49')
    expect(formatMetricValue('Avg Order Value', 1000)).toBe('₹1,000')
  })

  it('formats Orders as integer without ₹', () => {
    expect(formatMetricValue('Orders', 643)).toBe('643')
    expect(formatMetricValue('Orders', 0)).toBe('0')
  })

  it('formats Units Sold as integer without ₹', () => {
    expect(formatMetricValue('Units Sold', 997)).toBe('997')
    expect(formatMetricValue('Units Sold', 0)).toBe('0')
  })

  it('returns em dash for null values', () => {
    expect(formatMetricValue('Revenue', null)).toBe('—')
    expect(formatMetricValue('Orders', null)).toBe('—')
    expect(formatMetricValue('Units Sold', null)).toBe('—')
    expect(formatMetricValue('Avg Order Value', null)).toBe('—')
  })

  it('does not produce floating-point artifacts', () => {
    expect(formatMetricValue('Revenue', 2.8400000000000032)).toBe('₹2.84')
    expect(formatMetricValue('Avg Order Value', 2.8400000000000032)).toBe('₹2.84')
  })
})

describe('formatPct', () => {
  it('formats positive percentage with plus sign', () => {
    expect(formatPct(12.5)).toBe('+12.5%')
  })

  it('formats negative percentage with minus sign', () => {
    expect(formatPct(-5.3)).toBe('-5.3%')
  })

  it('returns em dash for null', () => {
    expect(formatPct(null)).toBe('—')
  })

  it('returns em dash for undefined', () => {
    expect(formatPct(undefined as unknown as number | null)).toBe('—')
  })
})

describe('formatAbs', () => {
  it('formats positive absolute difference with plus sign', () => {
    expect(formatAbs(100)).toBe('+100')
  })

  it('formats negative absolute difference with minus sign', () => {
    expect(formatAbs(-50)).toBe('-50')
  })

  it('returns em dash for null', () => {
    expect(formatAbs(null)).toBe('—')
  })
})

describe('buildMetric', () => {
  it('builds a metric with current value and no previous', () => {
    const m = buildMetric('Revenue', 1000, null)
    expect(m.label).toBe('Revenue')
    expect(m.current).toBe(1000)
    expect(m.previous).toBe(null)
    expect(m.absoluteDifference).toBe(null)
    expect(m.percentageChange).toBe(null)
    expect(m.isPositive).toBe(null)
  })

  it('builds a metric with current and previous values', () => {
    const m = buildMetric('Orders', 100, 80)
    expect(m.current).toBe(100)
    expect(m.previous).toBe(80)
    expect(m.absoluteDifference).toBe(20)
    expect(m.percentageChange).toBe(25)
    expect(m.isPositive).toBe(true)
  })

  it('builds a metric with negative change', () => {
    const m = buildMetric('Revenue', 800, 1000)
    expect(m.current).toBe(800)
    expect(m.previous).toBe(1000)
    expect(m.absoluteDifference).toBe(-200)
    expect(m.percentageChange).toBe(-20)
    expect(m.isPositive).toBe(false)
  })

  it('builds a metric with zero previous (no percentage)', () => {
    const m = buildMetric('Orders', 100, 0)
    expect(m.percentageChange).toBe(null)
    expect(m.isPositive).toBe(null)
    expect(m.absoluteDifference).toBe(100)
  })
})

describe('daysInRange', () => {
  it('calculates inclusive day count for same day', () => {
    expect(daysInRange('2024-01-01', '2024-01-01')).toBe(1)
  })

  it('calculates inclusive day count for a week', () => {
    expect(daysInRange('2024-01-01', '2024-01-07')).toBe(7)
  })

  it('calculates inclusive day count across month boundary', () => {
    expect(daysInRange('2024-01-30', '2024-02-02')).toBe(4)
  })
})

describe('selectionToComparisonType', () => {
  it('maps year to year-over-year', () => {
    expect(selectionToComparisonType('year')).toBe('year-over-year')
  })

  it('maps month to month-over-month', () => {
    expect(selectionToComparisonType('month')).toBe('month-over-month')
  })

  it('maps week to week-over-week', () => {
    expect(selectionToComparisonType('week')).toBe('week-over-week')
  })

  it('maps all-time to null', () => {
    expect(selectionToComparisonType('all-time')).toBe(null)
  })
})
