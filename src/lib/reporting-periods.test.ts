/**
 * Mist & Mug — Reporting Period Utilities Tests
 *
 * Tests calendar-week generation, period resolution, available-period
 * extraction, and revenue-aggregation consistency using deterministic
 * fixtures and the verified January 2026 regression dataset.
 */

import { describe, it, expect, vi } from 'vitest'
import type { ProcessedLine } from '@/types'
import {
  generateCalendarWeeks,
  getAvailableYears,
  getAvailableMonths,
  resolveSelection,
  getPreviousPeriod,
  type ReportingPeriodSelection,
} from '@/lib/reporting-periods'
import { computeDashboardMetrics, computeWeekdayWeekend } from '@/lib/analytics'

vi.mock('@/db', () => ({
  db: { importLines: { toArray: vi.fn() } },
  getAllImportLines: vi.fn(),
}))

import { getAllImportLines } from '@/db'

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------

function line({
  transactionId,
  lineId = '1',
  date,
  quantity = 1,
  unitPriceInr = 100,
  productName = 'Test Product',
}: {
  transactionId: string
  lineId?: string
  date: string
  quantity?: number
  unitPriceInr?: number
  productName?: string
}): ProcessedLine {
  const lineTotalInr = quantity * unitPriceInr
  return {
    compositeKey: `${transactionId}|${lineId}`,
    transactionId,
    lineId,
    date,
    time: '10:00',
    itemName: productName,
    categoryResolved: 'Coffee',
    quantity,
    unitPriceInr,
    lineTotalInr,
    productName,
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  } as ProcessedLine
}

function isWeekday(dateStr: string): boolean {
  const day = new Date(dateStr + 'T00:00:00Z').getUTCDay() // 0=Sun .. 6=Sat
  return day >= 1 && day <= 5
}

// ---------------------------------------------------------------
// Calendar-week generation
// ---------------------------------------------------------------

describe('generateCalendarWeeks', () => {
  it('January 2026 (starts Thursday): 5 weeks, Week 1 = Jan 1-4', () => {
    const weeks = generateCalendarWeeks([], 2026, 1)
    expect(weeks.map((w) => `${w.startDate}–${w.endDate}`)).toEqual([
      '2026-01-01–2026-01-04', // Week 1: Thursday–Sunday (3 days)
      '2026-01-05–2026-01-11',
      '2026-01-12–2026-01-18',
      '2026-01-19–2026-01-25',
      '2026-01-26–2026-01-31',
    ])
    expect(weeks).toHaveLength(5)
    expect(weeks[0].label).toBe('1 Jan–4 Jan')
    expect(weeks[0].index).toBe(1)
  })

  it('January 2027 (starts Friday): 5 weeks, Week 1 = Jan 1-3 (3 days)', () => {
    const weeks = generateCalendarWeeks([], 2027, 1)
    expect(weeks.map((w) => `${w.startDate}–${w.endDate}`)).toEqual([
      '2027-01-01–2027-01-03',
      '2027-01-04–2027-01-10',
      '2027-01-11–2027-01-17',
      '2027-01-18–2027-01-24',
      '2027-01-25–2027-01-31',
    ])
    expect(weeks).toHaveLength(5)
    // Week 1 must contain exactly three calendar days.
    expect(weeks[0].startDate).toBe('2027-01-01')
    expect(weeks[0].endDate).toBe('2027-01-03')
  })

  it('Month starting on Monday: Week 1 runs full Monday–Sunday', () => {
    // September 2025 starts on Monday.
    const weeks = generateCalendarWeeks([], 2025, 9)
    expect(weeks[0].startDate).toBe('2025-09-01')
    expect(weeks[0].endDate).toBe('2025-09-07')
    expect(weeks.map((w) => `${w.startDate}–${w.endDate}`)).toEqual([
      '2025-09-01–2025-09-07',
      '2025-09-08–2025-09-14',
      '2025-09-15–2025-09-21',
      '2025-09-22–2025-09-28',
      '2025-09-29–2025-09-30',
    ])
  })

  it('Month starting on Sunday: Week 1 is a single Sunday', () => {
    // September 2024 starts on Sunday.
    const weeks = generateCalendarWeeks([], 2024, 9)
    expect(weeks[0].startDate).toBe('2024-09-01')
    expect(weeks[0].endDate).toBe('2024-09-01')
    expect(weeks).toHaveLength(6)
  })

  it('February in a leap year (2024): 29 days', () => {
    const weeks = generateCalendarWeeks([], 2024, 2)
    const last = weeks[weeks.length - 1]
    expect(last.endDate).toBe('2024-02-29')
    const covered = weeks.reduce(
      (acc, w) => acc + (new Date(w.endDate).getUTCDate() - new Date(w.startDate).getUTCDate() + 1),
      0
    )
    expect(covered).toBe(29)
  })

  it('February in a non-leap year (2026): 28 days', () => {
    const weeks = generateCalendarWeeks([], 2026, 2)
    const last = weeks[weeks.length - 1]
    expect(last.endDate).toBe('2026-02-28')
    const covered = weeks.reduce(
      (acc, w) => acc + (new Date(w.endDate).getUTCDate() - new Date(w.startDate).getUTCDate() + 1),
      0
    )
    expect(covered).toBe(28)
  })

  it('Month containing six calendar-week segments', () => {
    // November 2026 starts on Sunday and has 30 days → six segments.
    const weeks = generateCalendarWeeks([], 2026, 11)
    expect(weeks).toHaveLength(6)
    expect(weeks[0]).toMatchObject({ index: 1, startDate: '2026-11-01', endDate: '2026-11-01' })
    expect(weeks[5]).toMatchObject({ index: 6, startDate: '2026-11-30', endDate: '2026-11-30' })
  })

  it('Weeks tile the month with no gaps or overlaps', () => {
    const weeks = generateCalendarWeeks([], 2026, 1)
    for (let i = 1; i < weeks.length; i++) {
      const prevEnd = new Date(weeks[i - 1].endDate + 'T00:00:00Z').getUTCDate()
      const prevMonth = new Date(weeks[i - 1].endDate + 'T00:00:00Z').getUTCMonth()
      const prevYear = new Date(weeks[i - 1].endDate + 'T00:00:00Z').getUTCFullYear()
      const expectedStart = new Date(Date.UTC(prevYear, prevMonth, prevEnd + 1))
      expect(weeks[i].startDate).toBe(expectedStart.toISOString().split('T')[0])
    }
    const first = new Date(weeks[0].startDate + 'T00:00:00Z')
    expect(first.getUTCDate()).toBe(1)
    const last = weeks[weeks.length - 1]
    const lastDay = new Date(Date.UTC(2026, 1, 0)).getUTCDate()
    expect(last.endDate).toBe(`2026-01-${lastDay}`)
  })
})

// ---------------------------------------------------------------
// Available periods derived from data
// ---------------------------------------------------------------

describe('available periods', () => {
  const jan2026Lines = [
    line({ transactionId: 't1', date: '2026-01-05' }),
    line({ transactionId: 't2', date: '2026-01-12' }),
    line({ transactionId: 't3', date: '2026-02-03' }),
    line({ transactionId: 't4', date: '2027-01-09' }),
  ]

  it('getAvailableYears returns only years with data, sorted', () => {
    expect(getAvailableYears(jan2026Lines)).toEqual([2026, 2027])
  })

  it('getAvailableMonths returns only months with data in the year', () => {
    expect(getAvailableMonths(jan2026Lines, 2026)).toEqual([1, 2])
    expect(getAvailableMonths(jan2026Lines, 2027)).toEqual([1])
    expect(getAvailableMonths(jan2026Lines, 2028)).toEqual([])
  })

  it('generateCalendarWeeks marks weeks that contain data', () => {
    const weeks = generateCalendarWeeks(jan2026Lines, 2026, 1)
    // t1 on Jan 5 → Week 2 (Jan 5-11); t2 on Jan 12 → Week 3 (Jan 12-18)
    expect(weeks[0].hasData).toBe(false) // Week 1: Jan 1-4
    expect(weeks[1].hasData).toBe(true) // Week 2: Jan 5-11
    expect(weeks[2].hasData).toBe(true) // Week 3: Jan 12-18
    expect(weeks[3].hasData).toBe(false)
    expect(weeks[4].hasData).toBe(false)
  })
})

// ---------------------------------------------------------------
// Selection resolution
// ---------------------------------------------------------------

describe('resolveSelection', () => {
  const lines = [
    line({ transactionId: 't1', date: '2026-01-05' }),
    line({ transactionId: 't2', date: '2026-01-20' }),
    line({ transactionId: 't3', date: '2026-02-10' }),
    line({ transactionId: 't4', date: '2027-03-15' }),
  ]

  it('All Time resolves to earliest→latest across all years', () => {
    const resolved = resolveSelection({ kind: 'all-time' } as ReportingPeriodSelection, lines)
    expect(resolved).not.toBeNull()
    expect(resolved!.startDate).toBe('2026-01-05')
    expect(resolved!.endDate).toBe('2027-03-15')
    expect(resolved!.label).toBe('All Time')
  })

  it('Year-only selection resolves to the full year', () => {
    const resolved = resolveSelection({ kind: 'year', year: 2026 } as ReportingPeriodSelection, lines)
    expect(resolved!.startDate).toBe('2026-01-01')
    expect(resolved!.endDate).toBe('2026-12-31')
    expect(resolved!.label).toBe('2026')
  })

  it('Year selection returns null for a year with no data', () => {
    expect(
      resolveSelection({ kind: 'year', year: 2099 } as ReportingPeriodSelection, lines)
    ).toBeNull()
  })

  it('Month-only selection resolves to the full month', () => {
    const resolved = resolveSelection(
      { kind: 'month', year: 2026, month: 1 } as ReportingPeriodSelection,
      lines
    )
    expect(resolved!.startDate).toBe('2026-01-01')
    expect(resolved!.endDate).toBe('2026-01-31')
    expect(resolved!.label).toBe('Jan 2026')
  })

  it('Month selection returns null for a month with no data', () => {
    expect(
      resolveSelection({ kind: 'month', year: 2026, month: 6 } as ReportingPeriodSelection, lines)
    ).toBeNull()
  })

  it('Week selection resolves to the calendar week boundaries', () => {
    // Jan 5 2026 is in Week 2 (Jan 5-11).
    const resolved = resolveSelection(
      { kind: 'week', year: 2026, month: 1, weekIndex: 2 } as ReportingPeriodSelection,
      lines
    )
    expect(resolved!.startDate).toBe('2026-01-05')
    expect(resolved!.endDate).toBe('2026-01-11')
    expect(resolved!.label).toBe('Week 2 · Jan 2026')
  })

  it('Week selection returns null for an out-of-range week index', () => {
    expect(
      resolveSelection(
        { kind: 'week', year: 2026, month: 1, weekIndex: 9 } as ReportingPeriodSelection,
        lines
      )
    ).toBeNull()
  })

  it('returns null for an empty database', () => {
    expect(resolveSelection({ kind: 'all-time' } as ReportingPeriodSelection, [])).toBeNull()
    expect(resolveSelection({ kind: 'year', year: 2026 } as ReportingPeriodSelection, [])).toBeNull()
  })
})

// ---------------------------------------------------------------
// Previous period
// ---------------------------------------------------------------

describe('getPreviousPeriod', () => {
  it('year → preceding calendar year', () => {
    expect(getPreviousPeriod({ kind: 'year', year: 2026 } as ReportingPeriodSelection)).toEqual({
      kind: 'year',
      year: 2025,
    })
  })

  it('month → January has no previous month within the selected year', () => {
    expect(getPreviousPeriod({ kind: 'month', year: 2026, month: 1 } as ReportingPeriodSelection)).toBeNull()
  })

  it('month → preceding calendar month within the same year', () => {
    expect(getPreviousPeriod({ kind: 'month', year: 2026, month: 3 } as ReportingPeriodSelection)).toEqual({
      kind: 'month',
      year: 2026,
      month: 2,
    })
  })

  it('month → February precedes March within the same year', () => {
    expect(getPreviousPeriod({ kind: 'month', year: 2026, month: 2 } as ReportingPeriodSelection)).toEqual({
      kind: 'month',
      year: 2026,
      month: 1,
    })
  })

  it('week → preceding week within the same month', () => {
    expect(getPreviousPeriod({ kind: 'week', year: 2026, month: 3, weekIndex: 2 } as ReportingPeriodSelection)).toEqual({
      kind: 'week',
      year: 2026,
      month: 3,
      weekIndex: 1,
    })
  })

  it('week → Week 1 has no previous week within the selected month', () => {
    expect(
      getPreviousPeriod({ kind: 'week', year: 2026, month: 3, weekIndex: 1 } as ReportingPeriodSelection)
    ).toBeNull()
  })

  it('all-time → null (no previous period)', () => {
    expect(getPreviousPeriod({ kind: 'all-time' } as ReportingPeriodSelection)).toBeNull()
  })
})

// ---------------------------------------------------------------
// Previous-period resolution (same-hierarchy comparisons)
// ---------------------------------------------------------------

describe('previous-period resolution', () => {
  const prevLines = [
    line({ transactionId: 'y27', date: '2027-03-15' }),
    line({ transactionId: 'y26', date: '2026-03-10' }),
    line({ transactionId: 'm27-03', date: '2027-03-15' }),
    line({ transactionId: 'm27-02', date: '2027-02-10' }),
    line({ transactionId: 'm27-01', date: '2027-01-20' }),
    // March 2027: Week 1 = Mar 1-7, Week 2 = Mar 8-14, Week 3 = Mar 15-21
    line({ transactionId: 'w27-03-w1', date: '2027-03-03' }),
    line({ transactionId: 'w27-03-w2', date: '2027-03-10' }),
    line({ transactionId: 'w27-03-w3', date: '2027-03-18' }),
  ]

  it('Year 2027 → previous year 2026 (full year)', () => {
    const prev = getPreviousPeriod({ kind: 'year', year: 2027 } as ReportingPeriodSelection)
    expect(prev).toEqual({ kind: 'year', year: 2026 })
    const resolved = resolveSelection(prev!, prevLines)
    expect(resolved!.startDate).toBe('2026-01-01')
    expect(resolved!.endDate).toBe('2026-12-31')
    expect(resolved!.label).toBe('2026')
  })

  it('Year with no preceding-year data resolves to null', () => {
    const prev = getPreviousPeriod({ kind: 'year', year: 2026 } as ReportingPeriodSelection)
    expect(prev).toEqual({ kind: 'year', year: 2025 })
    expect(resolveSelection(prev!, prevLines)).toBeNull()
  })

  it('March 2027 → previous month February 2027 (same year)', () => {
    const prev = getPreviousPeriod({ kind: 'month', year: 2027, month: 3 } as ReportingPeriodSelection)
    expect(prev).toEqual({ kind: 'month', year: 2027, month: 2 })
    const resolved = resolveSelection(prev!, prevLines)
    expect(resolved!.startDate).toBe('2027-02-01')
    expect(resolved!.endDate).toBe('2027-02-28')
    expect(resolved!.label).toBe('Feb 2027')
  })

  it('January 2027 → no previous month within the selected year', () => {
    const prev = getPreviousPeriod({ kind: 'month', year: 2027, month: 1 } as ReportingPeriodSelection)
    expect(prev).toBeNull()
  })

  it('Week 3 March 2027 → Week 2 March 2027 (same month)', () => {
    const prev = getPreviousPeriod({
      kind: 'week',
      year: 2027,
      month: 3,
      weekIndex: 3,
    } as ReportingPeriodSelection)
    expect(prev).toEqual({ kind: 'week', year: 2027, month: 3, weekIndex: 2 })
    const resolved = resolveSelection(prev!, prevLines)
    expect(resolved!.startDate).toBe('2027-03-08')
    expect(resolved!.endDate).toBe('2027-03-14')
    expect(resolved!.label).toBe('Week 2 · Mar 2027')
  })

  it('Week 2 March 2027 → Week 1 March 2027 (same month)', () => {
    const prev = getPreviousPeriod({
      kind: 'week',
      year: 2027,
      month: 3,
      weekIndex: 2,
    } as ReportingPeriodSelection)
    expect(prev).toEqual({ kind: 'week', year: 2027, month: 3, weekIndex: 1 })
    const resolved = resolveSelection(prev!, prevLines)
    expect(resolved!.startDate).toBe('2027-03-01')
    expect(resolved!.endDate).toBe('2027-03-07')
  })

  it('Week 1 March 2027 → no previous week within the selected month', () => {
    const prev = getPreviousPeriod({
      kind: 'week',
      year: 2027,
      month: 3,
      weekIndex: 1,
    } as ReportingPeriodSelection)
    expect(prev).toBeNull()
  })
})

// ---------------------------------------------------------------
// January 2026 regression dataset
// ---------------------------------------------------------------

describe('January 2026 regression dataset', () => {
  // Verified January 2026 sales totals for an isolated import:
  //   912 transaction lines, 643 unique orders, ₹198,360 revenue,
  //   997 units sold, ₹127,900 weekday revenue, ₹70,460 weekend revenue.
  const EXPECTED = {
    lines: 912,
    orders: 643,
    revenue: 198360,
    units: 997,
    weekdayRevenue: 127900,
    weekendRevenue: 70460,
  }

  function buildJanuary2026Dataset(): ProcessedLine[] {
    const lines: ProcessedLine[] = []
    let orderCounter = 0
    let lineCounter = 0
    let twoLineOrdersUsed = 0
    let twoUnitLinesUsed = 0

    // Per-day target revenue.
    // Weekdays (22 days): 20 @ 5800 + 2 @ 5950 = 127900
    // Weekend days (9 days): 7 @ 7800 + 2 @ 7930 = 70460
    const dayTargets: Record<string, number> = {}
    const dayOrderCounts: Record<string, number> = {}

    let wdIdx = 0
    let weIdx = 0
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const isWk = isWeekday(dateStr)
      if (isWk) {
        dayTargets[dateStr] = wdIdx < 20 ? 5800 : 5950
        wdIdx++
      } else {
        dayTargets[dateStr] = weIdx < 7 ? 7800 : 7930
        weIdx++
      }
      // 643 orders across 31 days: 23 days × 21 orders + 8 days × 20 orders
      dayOrderCounts[dateStr] = d <= 23 ? 21 : 20
    }

    const totalOrders = Object.values(dayOrderCounts).reduce((a, b) => a + b, 0)
    expect(totalOrders).toBe(EXPECTED.orders)

    // Each day: split its revenue target evenly across its orders; last order
    // takes the remainder so the day sums exactly. Two-line orders (269 total)
    // split revenue across 2 lines; 85 lines carry quantity 2.
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const target = dayTargets[dateStr]
      const numOrders = dayOrderCounts[dateStr]
      const baseRev = Math.floor(target / numOrders)
      let dayRevSoFar = 0

      for (let oi = 0; oi < numOrders; oi++) {
        orderCounter++
        const isLastOrder = oi === numOrders - 1
        const orderRev = isLastOrder ? target - dayRevSoFar : baseRev
        dayRevSoFar += orderRev

        const isTwoLine = twoLineOrdersUsed < 269
        if (isTwoLine) twoLineOrdersUsed++
        const lineCount = isTwoLine ? 2 : 1

        let lineRevSoFar = 0
        for (let li = 0; li < lineCount; li++) {
          lineCounter++
          const isLastLine = li === lineCount - 1
          const isTwoUnit = twoUnitLinesUsed < 85
          if (isTwoUnit) twoUnitLinesUsed++
          const qty = isTwoUnit ? 2 : 1

          const lineRev = isLastLine ? orderRev - lineRevSoFar : Math.floor(orderRev / lineCount)
          lineRevSoFar += lineRev

          lines.push({
            compositeKey: `txn-${orderCounter}|${li + 1}`,
            transactionId: `txn-${orderCounter}`,
            lineId: String(li + 1),
            date: dateStr,
            time: '10:00',
            itemName: 'Test Product',
            categoryResolved: 'Coffee',
            quantity: qty,
            unitPriceInr: lineRev / qty,
            lineTotalInr: lineRev,
            productName: 'Test Product',
            validationIssues: [],
            isValid: true,
            isDuplicate: false,
          } as ProcessedLine)
        }
      }
    }

    return lines
  }

  it('reproduces the verified January 2026 totals for the whole month', async () => {
    const lines = buildJanuary2026Dataset()
    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    expect(lines.length).toBe(EXPECTED.lines)
    const orderCount = new Set(lines.map((l) => l.transactionId)).size
    expect(orderCount).toBe(EXPECTED.orders)
    const units = lines.reduce((s, l) => s + l.quantity, 0)
    expect(units).toBe(EXPECTED.units)

    const metrics = await computeDashboardMetrics('2026-01-01', '2026-01-31')
    expect(metrics.revenueInr).toBe(EXPECTED.revenue)
    expect(metrics.orderCount).toBe(EXPECTED.orders)
    expect(metrics.itemsSold).toBe(EXPECTED.units)

    const revenue = lines.reduce((s, l) => s + l.lineTotalInr, 0)
    expect(revenue).toBe(EXPECTED.revenue)

    const ww = await computeWeekdayWeekend('2026-01-01', '2026-01-31')
    expect(ww.weekdayRevenue).toBe(EXPECTED.weekdayRevenue)
    expect(ww.weekendRevenue).toBe(EXPECTED.weekendRevenue)
    expect(ww.weekdayRevenue + ww.weekendRevenue).toBe(EXPECTED.revenue)

    // Weekday vs Weekend bar-chart ordering (Revenue mode: weekday bar longer).
    expect(ww.weekdayRevenue).toBeGreaterThan(ww.weekendRevenue)
    // Daily Avg mode: weekend average per day is higher than weekday average.
    expect(ww.averageWeekendRevenue).toBeGreaterThan(ww.averageWeekdayRevenue!)
    // Observed-day counts.
    expect(ww.weekdayCount).toBe(22)
    expect(ww.weekendCount).toBe(9)
  })

  it('individual week totals sum to the January monthly total', async () => {
    const lines = buildJanuary2026Dataset()
    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    const weeks = generateCalendarWeeks(lines, 2026, 1)
    let weekRevenueSum = 0
    for (const w of weeks) {
      const m = await computeDashboardMetrics(w.startDate, w.endDate)
      weekRevenueSum += m.revenueInr
    }
    const month = await computeDashboardMetrics('2026-01-01', '2026-01-31')
    expect(weekRevenueSum).toBe(month.revenueInr)
    expect(month.revenueInr).toBe(EXPECTED.revenue)
  })

  it('weekday revenue + weekend revenue = total revenue for January 2026', async () => {
    const lines = buildJanuary2026Dataset()
    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    const ww = await computeWeekdayWeekend('2026-01-01', '2026-01-31')
    const total = lines.reduce((s, l) => s + l.lineTotalInr, 0)
    expect(ww.weekdayRevenue + ww.weekendRevenue).toBe(total)
    expect(ww.weekdayRevenue).toBeGreaterThan(0)
    expect(ww.weekendRevenue).toBeGreaterThan(0)
  })
})
