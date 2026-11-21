/**
 * Mist & Mug — Analytics Engine Tests
 *
 * Tests deterministic calculations with known fixtures.
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
import type { ProcessedLine, Product, ProductCategory, ProductId } from '@/types'
import {
  computeDashboardMetrics,
  computeTopProducts,
  computeTopProductsByQuantity,
  computeHourlyData,
  computeRevenueByDayOfWeek,
  computeWeekdayWeekend,
  computeDailyTrend,
  computeMonthlyTrend,
  computeYearlyTrend,
  computeWeeklyBreakdown,
  computeMonthlyBreakdown,
  computeYearlyBreakdown,
  computeCategoryPerformance,
  computeCategoryRevenue,
  resolveLineCategory,
} from '@/lib/analytics'

// Test fixtures with known expected totals
const FIXTURE_LINES: ProcessedLine[] = [
  {
    compositeKey: 'txn1|1',
    transactionId: 'txn1',
    lineId: '1',
    date: '2024-11-04',
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
    compositeKey: 'txn1|2',
    transactionId: 'txn1',
    lineId: '2',
    date: '2024-11-04',
    time: '09:30',
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
  {
    compositeKey: 'txn2|1',
    transactionId: 'txn2',
    lineId: '1',
    date: '2024-11-04',
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
    compositeKey: 'txn3|1',
    transactionId: 'txn3',
    lineId: '1',
    date: '2024-11-09',
    time: '10:00',
    itemName: 'Cold Brew with Honey Foam',
    categoryResolved: 'Cold Beverage',
    quantity: 1,
    unitPriceInr: 190,
    lineTotalInr: 190,
    productName: 'Cold Brew with Honey Foam',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
  {
    compositeKey: 'txn4|1',
    transactionId: 'txn4',
    lineId: '1',
    date: '2024-11-10',
    time: '11:00',
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
  {
    compositeKey: 'txn5|1',
    transactionId: 'txn5',
    lineId: '1',
    date: '2024-11-11',
    time: '08:00',
    itemName: 'Signature Mist Latte',
    categoryResolved: 'Signature',
    quantity: 1,
    unitPriceInr: 210,
    lineTotalInr: 210,
    productName: 'Signature Mist Latte',
    validationIssues: [],
    isValid: true,
    isDuplicate: false,
  },
]

beforeEach(() => {
  vi.mocked(getAllImportLines).mockResolvedValue(FIXTURE_LINES)
  vi.mocked(getAllProducts).mockResolvedValue([])
})

describe('computeDashboardMetrics', () => {
  it('returns correct KPIs for all fixtures', async () => {
    const m = await computeDashboardMetrics()
    expect(m.revenueInr).toBe(1610) // 360+90+480+190+280+210
    expect(m.orderCount).toBe(5) // txn1-txn5
    expect(m.itemsSold).toBe(10) // 2+1+3+1+2+1
    expect(m.averageOrderValue).toBe(322) // 1610/5
  })

  it('filters by date range', async () => {
    const m = await computeDashboardMetrics('2024-11-04', '2024-11-04')
    expect(m.revenueInr).toBe(930) // txn1(450) + txn2(480) = 930
    expect(m.orderCount).toBe(2)
  })

  it('returns zeros for empty database', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([])
    const m = await computeDashboardMetrics()
    expect(m.revenueInr).toBe(0)
    expect(m.orderCount).toBe(0)
    expect(m.itemsSold).toBe(0)
    expect(m.averageOrderValue).toBe(0)
  })
})

describe('computeTopProducts', () => {
  it('ranks products by revenue', async () => {
    const products = await computeTopProducts(undefined, undefined, 10)
    const croissant = products.find((p) => p.productName === 'Almond Croissant')!
    expect(croissant.revenueInr).toBe(480)
    expect(croissant.quantitySold).toBe(3)
    expect(products[0].productName).toBe('Almond Croissant')
  })

  it('returns only the top five when limit is five', async () => {
    const products = await computeTopProducts(undefined, undefined, 5)
    expect(products).toHaveLength(5)
    const revenues = products.map((p) => p.revenueInr)
    expect(revenues).toEqual([...revenues].sort((a, b) => b - a))
  })

  it('breaks revenue ties deterministically by product name', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[2], productName: 'Zebra Product', lineTotalInr: 480 },
      { ...FIXTURE_LINES[4], productName: 'Apple Product', lineTotalInr: 480, quantity: 1 },
    ])
    const products = await computeTopProducts(undefined, undefined, 10)
    expect(products[0].productName).toBe('Apple Product')
    expect(products[1].productName).toBe('Zebra Product')
  })
})

describe('computeTopProductsByQuantity', () => {
  it('ranks products by quantity', async () => {
    const products = await computeTopProductsByQuantity(undefined, undefined, 10)
    const croissant = products.find((p) => p.productName === 'Almond Croissant')!
    expect(croissant.quantitySold).toBe(3)
    expect(products[0].productName).toBe('Almond Croissant')
  })
})

describe('computeHourlyData', () => {
  it('groups by hour', async () => {
    const data = await computeHourlyData()
    const hour9 = data.find((d) => d.hour === 9)!
    expect(hour9.revenueInr).toBe(450) // txn1 total
    expect(hour9.orderCount).toBe(1) // txn1 is 1 unique order (was 2 when counting lines)
  })

  it('counts unique orders per hour, not lines', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], transactionId: 'txn1', lineId: '1', date: '2024-11-04', time: '09:30', lineTotalInr: 360 },
      { ...FIXTURE_LINES[1], transactionId: 'txn1', lineId: '2', date: '2024-11-04', time: '09:30', lineTotalInr: 90 },
      { ...FIXTURE_LINES[2], transactionId: 'txn2', lineId: '1', date: '2024-11-04', time: '09:45', lineTotalInr: 480 },
    ])
    const data = await computeHourlyData()
    const hour9 = data.find((d) => d.hour === 9)!
    // 3 lines but 2 unique orders at hour 9
    expect(hour9.revenueInr).toBe(930) // 360 + 90 + 480
    expect(hour9.orderCount).toBe(2)
  })

  it('ignores lines with missing or invalid time', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], time: '09:30' },
      { ...FIXTURE_LINES[2], time: undefined },
      { ...FIXTURE_LINES[4], time: 'not-a-time' },
    ])
    const data = await computeHourlyData()
    expect(data).toHaveLength(1)
    expect(data[0].hour).toBe(9)
  })

  it('returns empty array for no data', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([])
    const data = await computeHourlyData()
    expect(data).toEqual([])
  })

  it('chronologically orders hours', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[2], time: '14:15' },
      { ...FIXTURE_LINES[0], time: '09:30' },
      { ...FIXTURE_LINES[4], time: '08:00' },
    ])
    const data = await computeHourlyData()
    expect(data.map((d) => d.hour)).toEqual([8, 9, 14])
  })
})

describe('computeWeekdayWeekend', () => {
  it('distinguishes weekdays and weekends', async () => {
    const ww = await computeWeekdayWeekend()
    // 2024-11-04 is Monday, 2024-11-09 is Saturday, 2024-11-10 is Sunday, 2024-11-11 is Monday
    expect(ww.weekdayRevenue).toBe(1140) // txn1(450) + txn2(480) + txn5(210) = 1140
    expect(ww.weekendRevenue).toBe(470) // txn3(190) + txn4(280) = 470
    expect(ww.weekdayCount).toBe(2) // Nov 4 and Nov 11
    expect(ww.weekendCount).toBe(2) // Nov 9 and Nov 10
    expect(ww.averageWeekdayRevenue).toBe(570) // 1140/2
    expect(ww.averageWeekendRevenue).toBe(235) // 470/2
    expect(ww.percentageDifference).toBeCloseTo(-58.8, 1) // ((235-570)/570)*100
  })

  it('counts unique orders not lines for weekday/weekend', async () => {
    // txn1 has 2 lines on Monday (450 total), txn2 has 1 line on Monday (480)
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], transactionId: 'txn1', lineId: '1', date: '2024-11-04', lineTotalInr: 360 },
      { ...FIXTURE_LINES[1], transactionId: 'txn1', lineId: '2', date: '2024-11-04', lineTotalInr: 90 },
      { ...FIXTURE_LINES[2], transactionId: 'txn2', lineId: '1', date: '2024-11-04', lineTotalInr: 480 },
    ])
    const ww = await computeWeekdayWeekend()
    // 3 lines but only 2 unique orders on weekdays
    expect(ww.weekdayOrderCount).toBe(2)
    expect(ww.weekdayRevenue).toBe(930) // 360 + 90 + 480
  })

  it('counts unique weekend orders', async () => {
    // txn3 on Saturday, txn4 on Sunday
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[3], transactionId: 'txn3', lineId: '1', date: '2024-11-09', lineTotalInr: 190 },
      { ...FIXTURE_LINES[4], transactionId: 'txn4', lineId: '1', date: '2024-11-10', lineTotalInr: 280 },
    ])
    const ww = await computeWeekdayWeekend()
    expect(ww.weekendOrderCount).toBe(2)
    expect(ww.weekendRevenue).toBe(470)
  })
})

describe('computeDailyTrend', () => {
  it('groups by date', async () => {
    const data = await computeDailyTrend()
    expect(data.length).toBe(4)
    const nov4 = data.find((d) => d.date === '2024-11-04')!
    expect(nov4.revenueInr).toBe(930)
    expect(nov4.orderCount).toBe(2)
  })
})

describe('computeMonthlyTrend', () => {
  it('groups by month and reconciles with total revenue', async () => {
    const data = await computeMonthlyTrend()
    expect(data.length).toBe(1)
    expect(data[0].periodKey).toBe('2024-11')
    expect(data[0].revenueInr).toBe(1610)
    expect(data[0].orderCount).toBe(5)
    expect(data[0].itemsSold).toBe(10)

    const sumRevenue = data.reduce((s, d) => s + d.revenueInr, 0)
    const m = await computeDashboardMetrics()
    expect(sumRevenue).toBe(m.revenueInr)
    const sumItems = data.reduce((s, d) => s + d.itemsSold, 0)
    expect(sumItems).toBe(m.itemsSold)
  })
})

describe('computeYearlyTrend', () => {
  it('groups by year and reconciles with total revenue', async () => {
    const data = await computeYearlyTrend()
    expect(data.length).toBe(1)
    expect(data[0].periodKey).toBe('2024')
    expect(data[0].revenueInr).toBe(1610)

    const sumRevenue = data.reduce((s, d) => s + d.revenueInr, 0)
    const m = await computeDashboardMetrics()
    expect(sumRevenue).toBe(m.revenueInr)
  })
})

describe('computeWeeklyBreakdown', () => {
  it('groups by week starting Monday', async () => {
    const data = await computeWeeklyBreakdown()
    expect(data.length).toBeGreaterThan(0)
    const week = data[0]
    expect(week.revenueInr).toBeGreaterThan(0)
  })
})

describe('computeMonthlyBreakdown', () => {
  it('groups by month', async () => {
    const data = await computeMonthlyBreakdown()
    expect(data.length).toBe(1)
    expect(data[0].month).toBe('2024-11')
    expect(data[0].revenueInr).toBe(1610)
  })
})

describe('computeYearlyBreakdown', () => {
  it('groups by year', async () => {
    const data = await computeYearlyBreakdown()
    expect(data.length).toBe(1)
    expect(data[0].year).toBe(2024)
    expect(data[0].revenueInr).toBe(1610)
  })
})

describe('computeCategoryPerformance', () => {
  it('groups by category', async () => {
    const data = await computeCategoryPerformance()
    const bakery = data.find((c) => c.category === 'Bakery')!
    expect(bakery.revenueInr).toBe(760) // 480 + 280
    expect(bakery.quantitySold).toBe(5) // 3 + 2
  })
})

describe('computeCategoryRevenue', () => {
  it('groups by verified category and sums revenue', async () => {
    const data = await computeCategoryRevenue()
    const bakery = data.find((c) => c.category === 'Bakery')!
    expect(bakery.revenueInr).toBe(760)
    expect(bakery.quantitySold).toBe(5)
  })

  it('reports unknown categories as Unclassified instead of Coffee', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], categoryResolved: 'Coffee' },
      { ...FIXTURE_LINES[1], categoryResolved: 'Unknown Category' as ProductCategory },
    ])
    const data = await computeCategoryRevenue()
    const coffee = data.find((c) => c.category === 'Coffee')!
    const unclassified = data.find((c) => c.category === 'Unclassified')!
    expect(coffee.revenueInr).toBe(360)
    expect(unclassified.revenueInr).toBe(90)
    expect(data.find((c) => c.category === 'Coffee')!.revenueInr).toBe(360)
  })

  it('total category revenue reconciles with overall revenue', async () => {
    const cats = await computeCategoryRevenue()
    const catTotal = cats.reduce((s, c) => s + c.revenueInr, 0)
    const m = await computeDashboardMetrics()
    expect(catTotal).toBe(m.revenueInr)
  })

  it('returns empty array for no data', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([])
    const data = await computeCategoryRevenue()
    expect(data).toEqual([])
  })

  it('donut percentages sum to 100%', async () => {
    const data = await computeCategoryRevenue()
    const total = data.reduce((s, c) => s + c.revenueInr, 0)
    const pctSum = data.reduce((s, c) => s + (total > 0 ? (c.revenueInr / total) * 100 : 0), 0)
    expect(Math.round(pctSum)).toBe(100)
  })
})

describe('resolveLineCategory', () => {
  const baseLine: ProcessedLine = {
    ...FIXTURE_LINES[0],
    productId: 'p1' as ProductId,
    productName: 'Landour Latte',
    categoryResolved: 'Coffee',
  }

  const products: Product[] = [
    {
      id: 'p1' as ProductId,
      name: 'Landour Latte',
      category: 'Coffee',
      currentPriceInr: 220,
      isActive: true,
      source: 'website',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2' as ProductId,
      name: 'Almond Croissant',
      category: 'Bakery',
      currentPriceInr: 160,
      isActive: true,
      source: 'website',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]

  function lookupFor(products: Product[]) {
    const byId = new Map<ProductId, Product>()
    const byName = new Map<string, ProductCategory>()
    for (const p of products) {
      byId.set(p.id, p)
      byName.set(
        p.name.toString().trim().toLowerCase().replace(/[_\s]+/g, ' ').replace(/[^\w\s]/g, '').trim(),
        p.category
      )
    }
    return { byId, byName }
  }

  it('uses verified product ID → catalogue category', () => {
    const category = resolveLineCategory(baseLine, lookupFor(products))
    expect(category).toBe('Coffee')
  })

  it('uses verified normalized exact product-name match when productId absent', () => {
    const line = { ...baseLine, productId: undefined, productName: '  ALMOND Croissant  ' }
    const category = resolveLineCategory(line, lookupFor(products))
    expect(category).toBe('Bakery')
  })

  it('falls back to verified source transaction category', () => {
    const line: ProcessedLine = {
      ...baseLine,
      productId: undefined,
      productName: 'Unknown Item',
      categoryResolved: 'Tea',
    }
    const category = resolveLineCategory(line, lookupFor(products))
    expect(category).toBe('Tea')
  })

  it('reports unknown/unverified source categories as Unclassified, never Coffee', () => {
    const line = {
      ...baseLine,
      productId: undefined,
      productName: 'Mystery Item',
      categoryResolved: 'Unknown Category' as ProductCategory,
    }
    const category = resolveLineCategory(line, lookupFor([]))
    expect(category).toBe('Unclassified')
  })
})

describe('category attribution in analytics projections', () => {
  it('computeTopProducts uses catalogue category, not incorrect stored Coffee', async () => {
    vi.mocked(getAllProducts).mockResolvedValue([
      {
        id: 'p-margherita' as ProductId,
        name: 'Margherita Pizza',
        category: 'Bakery',
        currentPriceInr: 250,
        isActive: true,
        source: 'website',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ])
    vi.mocked(getAllImportLines).mockResolvedValue([
      {
        ...FIXTURE_LINES[2],
        productId: 'p-margherita' as ProductId,
        productName: 'Margherita Pizza',
        categoryResolved: 'Coffee', // incorrectly stored as Coffee
        lineTotalInr: 480,
        quantity: 3,
      },
    ])
    const products = await computeTopProducts()
    const pizza = products.find((p) => p.productName === 'Margherita Pizza')!
    expect(pizza.category).toBe('Bakery')
    expect(pizza.category).not.toBe('Coffee')
  })

  it('computeCategoryRevenue does not misattribute catalogue products to Coffee', async () => {
    vi.mocked(getAllProducts).mockResolvedValue([
      {
        id: 'p-cake' as ProductId,
        name: 'Chocolate Cake',
        category: 'Bakery',
        currentPriceInr: 250,
        isActive: true,
        source: 'website',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ])
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], productId: 'p-cake' as ProductId, productName: 'Chocolate Cake', categoryResolved: 'Coffee' },
    ])
    const data = await computeCategoryRevenue()
    const bakery = data.find((c) => c.category === 'Bakery')
    const coffee = data.find((c) => c.category === 'Coffee')
    expect(bakery?.revenueInr).toBe(360) // catalogue overrides incorrect stored Coffee
    expect(coffee).toBeUndefined()
  })

  it('computeCategoryRevenue reports unverified source categories as Unclassified, never Coffee', async () => {
    vi.mocked(getAllProducts).mockResolvedValue([])
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...FIXTURE_LINES[0], productName: 'Mystery Item', categoryResolved: 'Unknown Category' as ProductCategory },
    ])
    const data = await computeCategoryRevenue()
    const unclassified = data.find((c) => c.category === 'Unclassified')
    const coffee = data.find((c) => c.category === 'Coffee')
    expect(unclassified?.revenueInr).toBe(360)
    expect(coffee).toBeUndefined()
  })

  it('category totals reconcile with overall revenue', async () => {
    const cats = await computeCategoryRevenue()
    const catTotal = cats.reduce((s, c) => s + c.revenueInr, 0)
    const m = await computeDashboardMetrics()
    expect(catTotal).toBe(m.revenueInr)
  })
})

describe('computeRevenueByDayOfWeek', () => {
  it('returns daily revenue', async () => {
    const data = await computeRevenueByDayOfWeek()
    expect(data.length).toBeGreaterThan(0)
  })
})
