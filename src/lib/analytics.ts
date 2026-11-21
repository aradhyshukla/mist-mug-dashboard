/**
 * Mist & Mug — Analytics Engine
 *
 * Pure, deterministic functions for computing sales metrics from imported
 * transaction lines. No AI, no fabricated data, no invented insights.
 */

import type {
  ProcessedLine,
  DashboardMetrics,
  WeeklyData,
  MonthlyData,
  YearlyData,
  ProductPerformance,
  ProductCategory,
  CategoryPerformance,
  HourlyData,
  DailyData,
  WeekdayWeekendComparison,
  ComparisonType,
  GrowthMetric,
  ProductChange,
  CategoryChange,
  HistoricalGrowthRow,
  PeriodComparison,
} from '@/types'

import { getAllImportLines } from '@/db'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function isValidLine(line: ProcessedLine): boolean {
  return line.isValid && !line.isDuplicate
}

function getMonday(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const day = date.getUTCDay() // 0 = Sunday, 1 = Monday, ...
  const diff = day === 0 ? -6 : 1 - day // Monday is day 1
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().split('T')[0]
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function getYear(dateStr: string): number {
  return parseInt(dateStr.slice(0, 4), 10)
}

function getDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sun, 1 = Mon, ...
}

function getHour(timeStr?: string): number | null {
  if (!timeStr) return null
  // Match HH:mm or HH:mm:ss
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const h = parseInt(match[1], 10)
  return h >= 0 && h <= 23 ? h : null
}

function isWeekday(dateStr: string): boolean {
  const day = getDayOfWeek(dateStr)
  return day >= 1 && day <= 5 // Monday-Friday
}

// ---------------------------------------------------------------
// Fetch all valid lines
// ---------------------------------------------------------------

export async function fetchValidLines(): Promise<ProcessedLine[]> {
  const all = await getAllImportLines()
  return all.filter(isValidLine)
}

// ---------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------

export async function getLatestTransactionDate(): Promise<string | null> {
  const all = await getAllImportLines()
  const valid = all.filter(isValidLine)
  if (valid.length === 0) return null
  return valid.reduce((max, line) => (line.date > max ? line.date : max), valid[0].date)
}

export async function getEarliestTransactionDate(): Promise<string | null> {
  const all = await getAllImportLines()
  const valid = all.filter(isValidLine)
  if (valid.length === 0) return null
  return valid.reduce((min, line) => (line.date < min ? line.date : min), valid[0].date)
}

// ---------------------------------------------------------------
// Dashboard Metrics (KPI Cards)
// ---------------------------------------------------------------

export async function computeDashboardMetrics(
  startDate?: string,
  endDate?: string
): Promise<DashboardMetrics> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const revenue = filtered.reduce((sum, l) => sum + l.lineTotalInr, 0)
  const itemsSold = filtered.reduce((sum, l) => sum + l.quantity, 0)

  // Unique orders = distinct transaction IDs
  const transactionIds = new Set(filtered.map((l) => l.transactionId))
  const orderCount = transactionIds.size

  const averageOrderValue = orderCount > 0 ? revenue / orderCount : 0

  return {
    revenueInr: Math.round(revenue * 100) / 100,
    orderCount,
    itemsSold,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
  }
}

// ---------------------------------------------------------------
// Top-Selling Products
// ---------------------------------------------------------------

export async function computeTopProducts(
  startDate?: string,
  endDate?: string,
  limit = 10
): Promise<ProductPerformance[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const productMap = new Map<string, ProductPerformance>()

  for (const line of filtered) {
    const key = line.productId ?? line.productName
    const existing = productMap.get(key)
    if (existing) {
      existing.quantitySold += line.quantity
      existing.revenueInr += line.lineTotalInr
      existing.orderCount += 1 // each line is part of an order
    } else {
      productMap.set(key, {
        productId: line.productId,
        productName: line.productName,
        category: line.categoryResolved,
        quantitySold: line.quantity,
        revenueInr: line.lineTotalInr,
        averageSellingPrice: line.quantity > 0 ? line.lineTotalInr / line.quantity : 0,
        orderCount: 1,
      })
    }
  }

  const result = Array.from(productMap.values()).map((p) => ({
    ...p,
    averageSellingPrice:
      p.quantitySold > 0 ? Math.round((p.revenueInr / p.quantitySold) * 100) / 100 : 0,
  }))

  return result
    .sort((a, b) => b.revenueInr - a.revenueInr || a.productName.localeCompare(b.productName))
    .slice(0, limit)
}

export async function computeTopProductsByQuantity(
  startDate?: string,
  endDate?: string,
  limit = 10
): Promise<ProductPerformance[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const productMap = new Map<string, ProductPerformance>()

  for (const line of filtered) {
    const key = line.productId ?? line.productName
    const existing = productMap.get(key)
    if (existing) {
      existing.quantitySold += line.quantity
      existing.revenueInr += line.lineTotalInr
    } else {
      productMap.set(key, {
        productId: line.productId,
        productName: line.productName,
        category: line.categoryResolved,
        quantitySold: line.quantity,
        revenueInr: line.lineTotalInr,
        averageSellingPrice: line.quantity > 0 ? line.lineTotalInr / line.quantity : 0,
        orderCount: 1,
      })
    }
  }

  const result = Array.from(productMap.values()).map((p) => ({
    ...p,
    averageSellingPrice:
      p.quantitySold > 0 ? Math.round((p.revenueInr / p.quantitySold) * 100) / 100 : 0,
  }))

  return result
    .sort((a, b) => b.quantitySold - a.quantitySold)
    .slice(0, limit)
}

// ---------------------------------------------------------------
// Busiest Periods
// ---------------------------------------------------------------

export async function computeHourlyData(
  startDate?: string,
  endDate?: string
): Promise<HourlyData[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const hourMap = new Map<number, { revenue: number; orderIds: Set<string> }>()

  for (const line of filtered) {
    const hour = getHour(line.time)
    if (hour === null) continue
    const existing = hourMap.get(hour) || { revenue: 0, orderIds: new Set() }
    existing.revenue += line.lineTotalInr
    existing.orderIds.add(line.transactionId)
    hourMap.set(hour, existing)
  }

  return Array.from(hourMap.entries())
    .map(([hour, data]) => ({
      hour,
      revenueInr: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderIds.size,
    }))
    .sort((a, b) => a.hour - b.hour)
}

export async function computeRevenueByDayOfWeek(
  startDate?: string,
  endDate?: string
): Promise<Array<{ day: string; revenueInr: number; orderCount: number }>> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayMap = new Map<number, { revenue: number; orderIds: Set<string> }>()

  for (const line of filtered) {
    const day = getDayOfWeek(line.date)
    const existing = dayMap.get(day) || { revenue: 0, orderIds: new Set() }
    existing.revenue += line.lineTotalInr
    existing.orderIds.add(line.transactionId)
    dayMap.set(day, existing)
  }

  return Array.from(dayMap.entries())
    .map(([day, data]) => ({
      day: dayNames[day],
      revenueInr: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderIds.size,
    }))
    .sort((a, b) => {
      const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      return order.indexOf(a.day) - order.indexOf(b.day)
    })
}

// ---------------------------------------------------------------
// Weekday vs Weekend Comparison
// ---------------------------------------------------------------

export async function computeWeekdayWeekend(
  startDate?: string,
  endDate?: string
): Promise<WeekdayWeekendComparison> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  let weekdayRevenue = 0
  let weekendRevenue = 0
  const weekdayOrderIds = new Set<string>()
  const weekendOrderIds = new Set<string>()
  const weekdayDates = new Set<string>()
  const weekendDates = new Set<string>()

  for (const line of filtered) {
    if (isWeekday(line.date)) {
      weekdayRevenue += line.lineTotalInr
      weekdayOrderIds.add(line.transactionId)
      weekdayDates.add(line.date)
    } else {
      weekendRevenue += line.lineTotalInr
      weekendOrderIds.add(line.transactionId)
      weekendDates.add(line.date)
    }
  }

  const weekdayCount = weekdayDates.size
  const weekendCount = weekendDates.size

  const averageWeekdayRevenue = weekdayCount > 0 ? weekdayRevenue / weekdayCount : null
  const averageWeekendRevenue = weekendCount > 0 ? weekendRevenue / weekendCount : null

  let percentageDifference: number | null = null
  if (averageWeekdayRevenue && averageWeekdayRevenue > 0 && averageWeekendRevenue !== null) {
    percentageDifference =
      ((averageWeekendRevenue - averageWeekdayRevenue) / averageWeekdayRevenue) * 100
  }

  return {
    weekdayRevenue: Math.round(weekdayRevenue * 100) / 100,
    weekendRevenue: Math.round(weekendRevenue * 100) / 100,
    weekdayOrderCount: weekdayOrderIds.size,
    weekendOrderCount: weekendOrderIds.size,
    weekdayCount: weekdayCount,
    weekendCount: weekendCount,
    averageWeekdayRevenue: averageWeekdayRevenue
      ? Math.round(averageWeekdayRevenue * 100) / 100
      : null,
    averageWeekendRevenue: averageWeekendRevenue
      ? Math.round(averageWeekendRevenue * 100) / 100
      : null,
    percentageDifference: percentageDifference
      ? Math.round(percentageDifference * 10) / 10
      : null,
  }
}

// ---------------------------------------------------------------
// Revenue Trends
// ---------------------------------------------------------------

export async function computeDailyTrend(
  startDate?: string,
  endDate?: string
): Promise<DailyData[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const dayMap = new Map<string, { revenue: number; items: number; orderIds: Set<string> }>()

  for (const line of filtered) {
    const existing = dayMap.get(line.date) || { revenue: 0, items: 0, orderIds: new Set() }
    existing.revenue += line.lineTotalInr
    existing.items += line.quantity
    existing.orderIds.add(line.transactionId)
    dayMap.set(line.date, existing)
  }

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      revenueInr: Math.round(data.revenue * 100) / 100,
      orderCount: data.orderIds.size,
      itemsSold: data.items,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function computeWeeklyBreakdown(
  startDate?: string,
  endDate?: string
): Promise<WeeklyData[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const weekMap = new Map<string, WeeklyData>()

  for (const line of filtered) {
    const weekStart = getMonday(line.date)
    const weekLabel = `Week starting ${formatWeekLabel(weekStart)}`
    const existing = weekMap.get(weekStart)
    if (existing) {
      existing.revenueInr += line.lineTotalInr
      existing.orderCount += 1
      existing.itemsSold += line.quantity
      existing.daily.push({
        date: line.date,
        revenueInr: line.lineTotalInr,
        orderCount: 1,
        itemsSold: line.quantity,
      })
    } else {
      weekMap.set(weekStart, {
        weekStart,
        weekLabel,
        revenueInr: line.lineTotalInr,
        orderCount: 1,
        itemsSold: line.quantity,
        daily: [
          {
            date: line.date,
            revenueInr: line.lineTotalInr,
            orderCount: 1,
            itemsSold: line.quantity,
          },
        ],
      })
    }
  }

  return Array.from(weekMap.values()).map((w) => ({
    ...w,
    revenueInr: Math.round(w.revenueInr * 100) / 100,
    daily: w.daily.sort((a, b) => a.date.localeCompare(b.date)),
  }))
}

export async function computeMonthlyBreakdown(
  startDate?: string,
  endDate?: string
): Promise<MonthlyData[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const monthMap = new Map<string, MonthlyData>()

  for (const line of filtered) {
    const monthKey = getMonthKey(line.date)
    const monthLabel = formatMonthLabel(monthKey)
    const existing = monthMap.get(monthKey)
    if (existing) {
      existing.revenueInr += line.lineTotalInr
      existing.orderCount += 1
      existing.itemsSold += line.quantity
    } else {
      monthMap.set(monthKey, {
        month: monthKey,
        monthLabel,
        revenueInr: line.lineTotalInr,
        orderCount: 1,
        itemsSold: line.quantity,
        weeks: [],
      })
    }
  }

  return Array.from(monthMap.values()).map((m) => ({
    ...m,
    revenueInr: Math.round(m.revenueInr * 100) / 100,
  })).sort((a, b) => a.month.localeCompare(b.month))
}

export async function computeYearlyBreakdown(
  startDate?: string,
  endDate?: string
): Promise<YearlyData[]> {
  const all = await fetchValidLines()
  const filtered = filterByDateRange(all, startDate, endDate)

  const yearMap = new Map<number, YearlyData>()

  for (const line of filtered) {
    const year = getYear(line.date)
    const existing = yearMap.get(year)
    if (existing) {
      existing.revenueInr += line.lineTotalInr
      existing.orderCount += 1
      existing.itemsSold += line.quantity
    } else {
      yearMap.set(year, {
        year,
        revenueInr: line.lineTotalInr,
        orderCount: 1,
        itemsSold: line.quantity,
        months: [],
      })
    }
  }

  return Array.from(yearMap.values()).map((y) => ({
    ...y,
    revenueInr: Math.round(y.revenueInr * 100) / 100,
  })).sort((a, b) => a.year - b.year)
}

// ---------------------------------------------------------------
// Category Performance
// ---------------------------------------------------------------

export async function computeCategoryPerformance(
  startDate?: string,
  endDate?: string
): Promise<CategoryPerformance[]> {
  const revenue = await computeCategoryRevenue(startDate, endDate)
  return revenue.map((c) => ({
    category: c.category as ProductCategory,
    quantitySold: c.quantitySold,
    revenueInr: c.revenueInr,
    productCount: c.productCount,
  }))
}

// ---------------------------------------------------------------
// Shared Category Revenue Aggregation (Preferences 2 & 4)
//
// Single source of truth for category-wise revenue distribution used by
// both the Top-Selling Products donut view and the Category Performance
// donut chart. Categories not in the verified set are reported as
// "Unclassified" rather than being incorrectly lumped into Coffee.
// Historical records are never modified.
// ---------------------------------------------------------------

export const VERIFIED_CATEGORIES: ReadonlySet<string> = new Set([
  'Coffee',
  'Tea',
  'Bakery',
  'Cold Beverage',
  'Signature',
  'Merchandise',
]);

// Shared category color map used by both category donut charts (Preferences 2 & 4).
// Matches the Mist & Mug light café palette. Unknown/unresolved categories fall
// back to the Unclassified swatch rather than being misassigned to Coffee.
export const CATEGORY_COLORS: Record<string, string> = {
  Coffee: '#142E25',        // deep forest green
  Tea: '#6E422B',           // wood
  Bakery: '#A6533F',        // muted terracotta / brick
  'Cold Beverage': '#2a4a3c', // softer forest
  Signature: '#8a2f1d',     // deep earth
  Merchandise: '#a28b5a',   // muted gold
  Unclassified: '#9aa7a1',  // muted rain
};

export interface CategoryRevenue {
  category: string;
  revenueInr: number;
  quantitySold: number;
  productCount: number;
}

export async function computeCategoryRevenue(
  startDate?: string,
  endDate?: string
): Promise<CategoryRevenue[]> {
  const all = await fetchValidLines();
  const filtered = filterByDateRange(all, startDate, endDate);

  const catMap = new Map<string, { revenue: number; quantity: number; products: Set<string> }>();

  for (const line of filtered) {
    const category = VERIFIED_CATEGORIES.has(line.categoryResolved)
      ? line.categoryResolved
      : 'Unclassified';
    const existing = catMap.get(category) || { revenue: 0, quantity: 0, products: new Set() };
    existing.revenue += line.lineTotalInr;
    existing.quantity += line.quantity;
    existing.products.add(line.productName);
    catMap.set(category, existing);
  }

  return Array.from(catMap.entries())
    .map(([category, data]) => ({
      category,
      quantitySold: data.quantity,
      revenueInr: Math.round(data.revenue * 100) / 100,
      productCount: data.products.size,
    }))
    .sort((a, b) => b.revenueInr - a.revenueInr);
}

// ============================================================================
// Phase 3: Growth & Comparison Functions
// ============================================================================

function addWeeks(dateStr: string, weeks: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + weeks * 7)
  return date.toISOString().split('T')[0]
}

function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1 + months, day))
  // Handle day overflow (e.g., Jan 31 - 1 month = Dec 31)
  if (d.getUTCDate() !== day) {
    d.setUTCDate(0)
  }
  return d.toISOString().split('T')[0]
}

function addYears(dateStr: string, years: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year + years, month - 1, day))
  return d.toISOString().split('T')[0]
}

export function getComparisonPeriods(
  type: ComparisonType,
  currentStart: string,
  currentEnd: string
): PeriodComparison {
  let previousStart = ''
  let previousEnd = ''

  switch (type) {
    case 'week-over-week': {
      const diffDays =
        new Date(currentEnd + 'T00:00:00').getTime() -
        new Date(currentStart + 'T00:00:00').getTime()
      const diffWeeks = Math.ceil(diffDays / (1000 * 60 * 60 * 24 * 7))
      previousStart = addWeeks(currentStart, -diffWeeks)
      previousEnd = addWeeks(currentEnd, -diffWeeks)
      break
    }
    case 'month-over-month': {
      // Count months between start and end
      const [cy, cm] = currentStart.split('-').map(Number)
      const [ey, em] = currentEnd.split('-').map(Number)
      const monthDiff = (ey - cy) * 12 + (em - cm)
      previousStart = addMonths(currentStart, -(monthDiff + 1))
      previousEnd = addMonths(currentEnd, -(monthDiff + 1))
      break
    }
    case 'year-over-year': {
      previousStart = addYears(currentStart, -1)
      previousEnd = addYears(currentEnd, -1)
      break
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const isCurrentComplete = currentEnd <= today
  const isPreviousComplete = previousEnd <= today

  return {
    type,
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    isCurrentComplete,
    isPreviousComplete,
  }
}

export async function computeGrowthMetrics(
  type: ComparisonType,
  currentStart: string,
  currentEnd: string
): Promise<GrowthMetric[]> {
  const periods = getComparisonPeriods(type, currentStart, currentEnd)

  const [current, previous] = await Promise.all([
    computeDashboardMetrics(periods.currentStart, periods.currentEnd),
    computeDashboardMetrics(periods.previousStart, periods.previousEnd),
  ])

  const buildMetric = (
    label: string,
    currentVal: number,
    previousVal: number | null
  ): GrowthMetric => {
    const absDiff = previousVal === null ? null : currentVal - previousVal
    let pctChange: number | null = null
    let isPositive: boolean | null = null

    if (previousVal !== null && previousVal > 0) {
      pctChange = Math.round(((currentVal - previousVal) / previousVal) * 100 * 10) / 10
      isPositive = pctChange >= 0
    }

    return {
      label,
      current: currentVal,
      previous: previousVal,
      absoluteDifference: absDiff,
      percentageChange: pctChange,
      isPositive,
    }
  }

  return [
    buildMetric('Revenue', current.revenueInr, previous.revenueInr),
    buildMetric('Orders', current.orderCount, previous.orderCount),
    buildMetric('Units Sold', current.itemsSold, previous.itemsSold),
    buildMetric('Avg Order Value', current.averageOrderValue, previous.averageOrderValue),
  ]
}

export async function computeProductChanges(
  type: ComparisonType,
  currentStart: string,
  currentEnd: string,
  limit = 10
): Promise<ProductChange[]> {
  const periods = getComparisonPeriods(type, currentStart, currentEnd)

  const [currentProducts, previousProducts] = await Promise.all([
    computeTopProducts(periods.currentStart, periods.currentEnd, 100),
    computeTopProducts(periods.previousStart, periods.previousEnd, 100),
  ])

  const prevMap = new Map<string, ProductPerformance>()
  for (const p of previousProducts) {
    prevMap.set(p.productName, p)
  }

  const changes: ProductChange[] = []

  for (const curr of currentProducts) {
    const prev = prevMap.get(curr.productName)
    const prevRevenue = prev ? prev.revenueInr : null
    const prevQuantity = prev ? prev.quantitySold : null
    const prevOrders = prev ? prev.orderCount : null

    let revenueChange: number | null = null
    let revenuePctChange: number | null = null
    let quantityChange: number | null = null
    let quantityPctChange: number | null = null

    if (prevRevenue !== null && prevRevenue > 0) {
      revenueChange = Math.round((curr.revenueInr - prevRevenue) * 100) / 100
      revenuePctChange = Math.round(
        ((curr.revenueInr - prevRevenue) / prevRevenue) * 100 * 10
      ) / 10
    }

    if (prevQuantity !== null && prevQuantity > 0) {
      quantityChange = curr.quantitySold - prevQuantity
      quantityPctChange = Math.round(
        ((curr.quantitySold - prevQuantity) / prevQuantity) * 100 * 10
      ) / 10
    }

    changes.push({
      productName: curr.productName,
      category: curr.category,
      currentRevenue: curr.revenueInr,
      previousRevenue: prevRevenue,
      currentQuantity: curr.quantitySold,
      previousQuantity: prevQuantity,
      revenueChange,
      revenuePercentChange: revenuePctChange,
      quantityChange,
      quantityPercentChange: quantityPctChange,
      currentOrderCount: curr.orderCount,
      previousOrderCount: prevOrders,
    })
  }

  return changes
    .sort((a, b) => (b.revenueChange ?? -Infinity) - (a.revenueChange ?? -Infinity))
    .slice(0, limit)
}

export async function computeCategoryChanges(
  type: ComparisonType,
  currentStart: string,
  currentEnd: string
): Promise<CategoryChange[]> {
  const periods = getComparisonPeriods(type, currentStart, currentEnd)

  const [currentCats, previousCats] = await Promise.all([
    computeCategoryPerformance(periods.currentStart, periods.currentEnd),
    computeCategoryPerformance(periods.previousStart, periods.previousEnd),
  ])

  const prevMap = new Map<string, CategoryPerformance>()
  for (const c of previousCats) {
    prevMap.set(c.category, c)
  }

  const changes: CategoryChange[] = []

  for (const curr of currentCats) {
    const prev = prevMap.get(curr.category)
    const prevRevenue = prev ? prev.revenueInr : null
    const prevQuantity = prev ? prev.quantitySold : null

    let revenueChange: number | null = null
    let revenuePctChange: number | null = null

    if (prevRevenue !== null && prevRevenue > 0) {
      revenueChange = Math.round((curr.revenueInr - prevRevenue) * 100) / 100
      revenuePctChange = Math.round(
        ((curr.revenueInr - prevRevenue) / prevRevenue) * 100 * 10
      ) / 10
    }

    changes.push({
      category: curr.category,
      currentRevenue: curr.revenueInr,
      previousRevenue: prevRevenue,
      currentQuantity: curr.quantitySold,
      previousQuantity: prevQuantity,
      revenueChange,
      revenuePercentChange: revenuePctChange,
    })
  }

  return changes.sort((a, b) => (b.revenueChange ?? -Infinity) - (a.revenueChange ?? -Infinity))
}

export async function computeHistoricalGrowth(
  type: ComparisonType
): Promise<HistoricalGrowthRow[]> {
  const all = await fetchValidLines()
  if (all.length === 0) return []

  const dates = all.map((l) => l.date).sort()
  const earliest = dates[0]
  const latest = dates[dates.length - 1]

  const rows: HistoricalGrowthRow[] = []

  switch (type) {
    case 'week-over-week': {
      let weekStart = getMonday(earliest)
      while (weekStart <= latest) {
        const weekEnd = addWeeks(weekStart, 1)
        // Subtract 1 day to get the last day of the week (Sunday)
        const d = new Date(weekEnd + 'T00:00:00')
        d.setDate(d.getDate() - 1)
        const actualEnd = d.toISOString().split('T')[0]

        const current = await computeDashboardMetrics(weekStart, actualEnd)

        // Previous week
        const prevStart = addWeeks(weekStart, -1)
        const prevEnd = addWeeks(actualEnd, -1)
        const previous = await computeDashboardMetrics(prevStart, prevEnd)

        let revenuePct: number | null = null
        if (previous.revenueInr > 0) {
          revenuePct = Math.round(
            ((current.revenueInr - previous.revenueInr) / previous.revenueInr) * 100 * 10
          ) / 10
        }

        rows.push({
          periodLabel: `Week of ${formatWeekLabel(weekStart)}`,
          periodStart: weekStart,
          periodEnd: actualEnd,
          revenueInr: current.revenueInr,
          orderCount: current.orderCount,
          itemsSold: current.itemsSold,
          averageOrderValue: current.averageOrderValue,
          revenueChangePercent: revenuePct,
        })

        weekStart = addWeeks(weekStart, 1)
      }
      break
    }
    case 'month-over-month': {
      const [ey, em] = latest.split('-').map(Number)
      const [sy, sm] = earliest.split('-').map(Number)
      let totalMonths = (ey - sy) * 12 + (em - sm) + 1

      let monthStart = earliest
      for (let i = 0; i < totalMonths; i++) {
        const [y, m] = monthStart.split('-').map(Number)
        const d = new Date(y, m, 0) // last day of month
        const monthEnd = d.toISOString().split('T')[0]

        const current = await computeDashboardMetrics(monthStart, monthEnd)

        // Previous month
        const prevStart = addMonths(monthStart, -1)
        const [py, pm] = prevStart.split('-').map(Number)
        const pd = new Date(py, pm, 0)
        const prevEnd = pd.toISOString().split('T')[0]
        const previous = await computeDashboardMetrics(prevStart, prevEnd)

        let revenuePct: number | null = null
        if (previous.revenueInr > 0) {
          revenuePct = Math.round(
            ((current.revenueInr - previous.revenueInr) / previous.revenueInr) * 100 * 10
          ) / 10
        }

        const [cy, cm2] = monthStart.split('-').map(Number)
        const cd = new Date(cy, cm2 - 1, 1)
        const label = cd.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

        rows.push({
          periodLabel: label,
          periodStart: monthStart,
          periodEnd: monthEnd,
          revenueInr: current.revenueInr,
          orderCount: current.orderCount,
          itemsSold: current.itemsSold,
          averageOrderValue: current.averageOrderValue,
          revenueChangePercent: revenuePct,
        })

        monthStart = addMonths(monthStart, 1)
      }
      break
    }
    case 'year-over-year': {
      const [sy] = earliest.split('-').map(Number)
      const [ey2] = latest.split('-').map(Number)

      for (let y = sy; y <= ey2; y++) {
        const yearStart = `${y}-01-01`
        const yearEnd = `${y}-12-31`

        const current = await computeDashboardMetrics(yearStart, yearEnd)

        // Previous year
        const prevStart = `${y - 1}-01-01`
        const prevEnd = `${y - 1}-12-31`
        const previous = await computeDashboardMetrics(prevStart, prevEnd)

        let revenuePct: number | null = null
        if (previous.revenueInr > 0) {
          revenuePct = Math.round(
            ((current.revenueInr - previous.revenueInr) / previous.revenueInr) * 100 * 10
          ) / 10
        }

        rows.push({
          periodLabel: `${y}`,
          periodStart: yearStart,
          periodEnd: yearEnd,
          revenueInr: current.revenueInr,
          orderCount: current.orderCount,
          itemsSold: current.itemsSold,
          averageOrderValue: current.averageOrderValue,
          revenueChangePercent: revenuePct,
        })
      }
      break
    }
  }

  return rows
}

// ---------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------

function filterByDateRange(
  lines: ProcessedLine[],
  startDate?: string,
  endDate?: string
): ProcessedLine[] {
  if (!startDate && !endDate) return lines
  return lines.filter((line) => {
    if (startDate && line.date < startDate) return false
    if (endDate && line.date > endDate) return false
    return true
  })
}

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}
