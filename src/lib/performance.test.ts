/**
 * Mist & Mug — Phase 3: Performance Tracker Tests
 *
 * Tests growth calculations, comparison periods, and deterministic metrics.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: {
    importLines: {
      toArray: vi.fn(),
    },
  },
  getAllImportLines: vi.fn(),
  getAllProducts: vi.fn(),
}))

import { getAllImportLines, getAllProducts } from '@/db'
import { ProcessedLine } from '@/types'
import {
  computeGrowthMetrics,
  computeProductChanges,
  computeCategoryChanges,
  getComparisonPeriods,
} from '@/lib/analytics'

// Test fixtures
const FIXTURE_LINES_CURRENT: ProcessedLine[] = [
  {
    compositeKey: 'txn-cur-1|1',
    transactionId: 'txn-cur-1',
    lineId: '1',
    date: '2024-11-18',
    time: '09:30',
    itemName: 'Himalayan Cloud Coffee',
    categoryResolved: 'Coffee',
    quantity: 2,
    unitPriceInr: 180,
    lineTotalInr: 360,
    productName: 'Himalayan Cloud Coffee',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
  {
    compositeKey: 'txn-cur-2|1',
    transactionId: 'txn-cur-2',
    lineId: '1',
    date: '2024-11-18',
    time: '14:15',
    itemName: 'Almond Croissant',
    categoryResolved: 'Bakery',
    quantity: 3,
    unitPriceInr: 160,
    lineTotalInr: 480,
    productName: 'Almond Croissant',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
  {
    compositeKey: 'txn-cur-3|1',
    transactionId: 'txn-cur-3',
    lineId: '1',
    date: '2024-11-19',
    time: '10:00',
    itemName: 'Mist & Mug Masala Chai',
    categoryResolved: 'Tea',
    quantity: 1,
    unitPriceInr: 90,
    lineTotalInr: 90,
    productName: 'Mist & Mug Masala Chai',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
]

const FIXTURE_LINES_PREVIOUS: ProcessedLine[] = [
  {
    compositeKey: 'txn-prev-1|1',
    transactionId: 'txn-prev-1',
    lineId: '1',
    date: '2024-11-11',
    time: '09:30',
    itemName: 'Himalayan Cloud Coffee',
    categoryResolved: 'Coffee',
    quantity: 1,
    unitPriceInr: 180,
    lineTotalInr: 180,
    productName: 'Himalayan Cloud Coffee',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
  {
    compositeKey: 'txn-prev-2|1',
    transactionId: 'txn-prev-2',
    lineId: '1',
    date: '2024-11-11',
    time: '14:15',
    itemName: 'Blueberry Muffin',
    categoryResolved: 'Bakery',
    quantity: 2,
    unitPriceInr: 140,
    lineTotalInr: 280,
    productName: 'Blueberry Muffin',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
]

beforeEach(() => {
  vi.mocked(getAllImportLines).mockResolvedValue([])
  vi.mocked(getAllProducts).mockResolvedValue([])
})

describe('getComparisonPeriods', () => {
  it('computes week-over-week periods correctly', () => {
    const periods = getComparisonPeriods('week-over-week', '2024-11-18', '2024-11-24')
    expect(periods.type).toBe('week-over-week')
    expect(periods.currentStart).toBe('2024-11-18')
    expect(periods.currentEnd).toBe('2024-11-24')
    // 7 days difference = 1 week back
    expect(periods.previousStart).toBe('2024-11-11')
    expect(periods.previousEnd).toBe('2024-11-17')
  })

  it('computes month-over-month periods correctly', () => {
    const periods = getComparisonPeriods('month-over-month', '2024-11-01', '2024-11-30')
    expect(periods.type).toBe('month-over-month')
    expect(periods.currentStart).toBe('2024-11-01')
    expect(periods.currentEnd).toBe('2024-11-30')
    expect(periods.previousStart).toBe('2024-10-01')
    expect(periods.previousEnd).toBe('2024-10-30')
  })

  it('computes year-over-year periods correctly', () => {
    const periods = getComparisonPeriods('year-over-year', '2024-01-01', '2024-12-31')
    expect(periods.type).toBe('year-over-year')
    expect(periods.currentStart).toBe('2024-01-01')
    expect(periods.currentEnd).toBe('2024-12-31')
    expect(periods.previousStart).toBe('2023-01-01')
    expect(periods.previousEnd).toBe('2023-12-31')
  })
})

describe('computeGrowthMetrics', () => {
  it('calculates growth with positive change', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([...FIXTURE_LINES_CURRENT, ...FIXTURE_LINES_PREVIOUS])

    const metrics = await computeGrowthMetrics(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    const revenueMetric = metrics.find((m) => m.label === 'Revenue')
    expect(revenueMetric).toBeDefined()
    // Current: 360+480+90 = 930, Previous: 180+280 = 460
    expect(revenueMetric!.current).toBe(930)
    expect(revenueMetric!.previous).toBe(460)
    expect(revenueMetric!.absoluteDifference).toBe(470)
    expect(revenueMetric!.percentageChange).toBeCloseTo(102.2, 1)
    expect(revenueMetric!.isPositive).toBe(true)
  })

  it('returns N/A when previous is zero', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue(FIXTURE_LINES_CURRENT)

    const metrics = await computeGrowthMetrics(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    const revenueMetric = metrics.find((m) => m.label === 'Revenue')
    expect(revenueMetric!.current).toBe(930)
    expect(revenueMetric!.previous).toBe(0)
    expect(revenueMetric!.percentageChange).toBeNull()
    expect(revenueMetric!.isPositive).toBeNull()
  })

  it('returns zeros for empty database', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([])

    const metrics = await computeGrowthMetrics(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    expect(metrics.length).toBe(4)
    metrics.forEach((m) => {
      expect(m.current).toBe(0)
      expect(m.previous).toBe(0)
      expect(m.percentageChange).toBeNull()
    })
  })
})

describe('computeProductChanges', () => {
  it('identifies products with revenue increases', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([...FIXTURE_LINES_CURRENT, ...FIXTURE_LINES_PREVIOUS])

    const changes = await computeProductChanges(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    const coffee = changes.find((p) => p.productName === 'Himalayan Cloud Coffee')
    expect(coffee).toBeDefined()
    // Current: 360, Previous: 180
    expect(coffee!.currentRevenue).toBe(360)
    expect(coffee!.previousRevenue).toBe(180)
    expect(coffee!.revenueChange).toBe(180)
    expect(coffee!.revenuePercentChange).toBeCloseTo(100, 1)
  })

  it('only returns products present in current period', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([...FIXTURE_LINES_CURRENT, ...FIXTURE_LINES_PREVIOUS])

    const changes = await computeProductChanges(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    // Blueberry Muffin is only in previous period, not current
    const muffin = changes.find((p) => p.productName === 'Blueberry Muffin')
    expect(muffin).toBeUndefined()

    // Almond Croissant is only in current period
    const croissant = changes.find((p) => p.productName === 'Almond Croissant')
    expect(croissant).toBeDefined()
    expect(croissant!.currentRevenue).toBe(480)
    expect(croissant!.previousRevenue).toBeNull()
    expect(croissant!.revenueChange).toBeNull()
    expect(croissant!.revenuePercentChange).toBeNull()
  })
})

describe('computeCategoryChanges', () => {
  it('calculates category revenue changes', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([...FIXTURE_LINES_CURRENT, ...FIXTURE_LINES_PREVIOUS])

    const changes = await computeCategoryChanges(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    const coffee = changes.find((c) => c.category === 'Coffee')
    expect(coffee).toBeDefined()
    expect(coffee!.currentRevenue).toBe(360)
    expect(coffee!.previousRevenue).toBe(180)
    expect(coffee!.revenueChange).toBe(180)
    expect(coffee!.revenuePercentChange).toBeCloseTo(100, 1)
  })

  it('calculates bakery category revenue changes', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([...FIXTURE_LINES_CURRENT, ...FIXTURE_LINES_PREVIOUS])

    const changes = await computeCategoryChanges(
      'week-over-week',
      '2024-11-18',
      '2024-11-24'
    )

    const bakery = changes.find((c) => c.category === 'Bakery')
    expect(bakery).toBeDefined()
    // Current: 480 (croissant), Previous: 280 (muffin)
    expect(bakery!.currentRevenue).toBe(480)
    expect(bakery!.previousRevenue).toBe(280)
    expect(bakery!.revenueChange).toBe(200)
    expect(bakery!.revenuePercentChange).toBeCloseTo(71.4, 1)
  })
})
