/**
 * Mist & Mug — Data types
 *
 * Shared TypeScript interfaces used across the dashboard.
 * Kept in one file so Phase 2 can import and extend them safely.
 */

export type ProductId = string & { __brand: 'ProductId' }
export type UploadBatchId = string & { __brand: 'UploadBatchId' }
export type ReportingPeriodId = string & { __brand: 'ReportingPeriodId' }

export type ProductCategory =
  | 'Coffee'
  | 'Tea'
  | 'Bakery'
  | 'Cold Beverage'
  | 'Signature'
  | 'Merchandise'

export interface Product {
  id: ProductId
  name: string
  category: ProductCategory
  description?: string
  currentPriceInr: number // current catalog selling price (INR)
  imageUrl?: string
  isActive: boolean
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

export interface ProductInput {
  name: string
  category: ProductCategory
  description?: string
  currentPriceInr: number
  imageUrl?: string
  isActive?: boolean
}

export interface TransactionLine {
  productId: ProductId
  productName: string // snapshot at time of sale
  category: ProductCategory
  quantity: number
  unitPriceInr: number // historical transaction price (separate from catalog price)
  lineTotalInr: number
}

export interface UploadBatch {
  id: UploadBatchId
  fileName: string
  fileSize: number
  uploadedAt: string // ISO timestamp
  status: 'pending' | 'imported' | 'failed'
  reportingPeriod?: ReportingPeriodId
  lineCount: number
  totalRevenueInr: number
  validationIssues: ValidationIssue[]
}

export interface ValidationIssue {
  row: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ReportingPeriod {
  id: ReportingPeriodId
  label: string // e.g. "Week 42 · 2024"
  type: 'week' | 'month' | 'year' | 'all-time'
  startDate: string // ISO date
  endDate: string // ISO date
  revenueInr: number
  orderCount: number
  itemsSold: number
  averageOrderValue: number
  createdAt: string
}

export interface DashboardMetrics {
  revenueInr: number
  orderCount: number
  itemsSold: number
  averageOrderValue: number
}

export interface PerformanceComparison {
  period: ReportingPeriod
  current: DashboardMetrics
  previous: DashboardMetrics
  changePercent: number
}

export interface Settings {
  cafeName: string
  cafeDescription: string
  location: string
  contact?: string
  currency: string
  theme: 'light' | 'dark'
  lowStockThreshold: number
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
  chartPreference?: 'bars' | 'lines'
}

export interface StarterProduct {
  name: string
  category: ProductCategory
  currentPriceInr: number
  description?: string
  imageUrl?: string
}

// ============================================================================
// Phase 2: Sales Import & Analytics Types
// ============================================================================

export type TimeFilter = 'week' | 'month' | 'year' | 'all-time'

export interface RawTransactionLine {
  transactionId: string
  lineId?: string
  date: string
  time?: string
  itemName: string
  category?: string
  quantity: number
  unitPrice?: number
  totalAmount?: number
  rowNumber: number
}

export interface ProcessedLine {
  compositeKey: string // stable composite identifier (transactionId + lineId or fallback)
  transactionId: string
  lineId?: string
  date: string // ISO date string
  time?: string
  itemName: string
  categoryResolved: ProductCategory
  quantity: number
  unitPriceInr: number
  lineTotalInr: number
  productId?: ProductId // matched to catalog if possible
  productName: string
  validationIssues: ValidationIssue[]
  isValid: boolean
  isDuplicate: boolean
}

export interface ColumnMapping {
  transactionId: string | null
  lineId: string | null
  date: string | null
  time: string | null
  itemName: string | null
  category: string | null
  quantity: string | null
  unitPrice: string | null
  totalAmount: string | null
}

export interface ImportPreview {
  totalRows: number
  acceptedCount: number
  rejectedCount: number
  duplicateCount: number
  columns: string[]
  mappedColumns: ColumnMapping
  sampleRecords: ProcessedLine[]
  allLines: ProcessedLine[]
  validationIssues: ValidationIssue[]
  canImport: boolean
}

export interface ImportResult {
  batchId: UploadBatchId
  totalRows: number
  acceptedRows: number
  rejectedRows: number
  duplicateRows: number
  lines: ProcessedLine[]
  validationIssues: ValidationIssue[]
  dateRange: { earliest: string | null; latest: string | null }
  totalRevenueInr: number
  status: 'pending' | 'imported' | 'failed'
}

export interface UploadBatchSummary {
  id: UploadBatchId
  fileName: string
  fileSize: number
  uploadedAt: string
  status: 'pending' | 'imported' | 'failed'
  acceptedRows: number
  rejectedRows: number
  duplicateRows: number
  totalRevenueInr: number
  earliestTransactionDate: string | null
  latestTransactionDate: string | null
}

export interface HourlyData {
  hour: number // 0-23
  revenueInr: number
  orderCount: number
}

export interface DailyData {
  date: string // ISO date
  revenueInr: number
  orderCount: number
  itemsSold: number
}

export interface WeeklyData {
  weekStart: string // ISO date (Monday)
  weekLabel: string
  revenueInr: number
  orderCount: number
  itemsSold: number
  daily: DailyData[]
}

export interface MonthlyData {
  month: string // "YYYY-MM"
  monthLabel: string
  revenueInr: number
  orderCount: number
  itemsSold: number
  weeks: WeeklyData[]
}

export interface YearlyData {
  year: number
  revenueInr: number
  orderCount: number
  itemsSold: number
  months: MonthlyData[]
}

export interface ProductPerformance {
  productId?: ProductId
  productName: string
  category: ProductCategory
  quantitySold: number
  revenueInr: number
  averageSellingPrice: number // historical transaction price
  orderCount: number
}

export interface CategoryPerformance {
  category: ProductCategory
  quantitySold: number
  revenueInr: number
  productCount: number
}

export interface WeekdayWeekendComparison {
  weekdayRevenue: number
  weekendRevenue: number
  weekdayOrderCount: number
  weekendOrderCount: number
  weekdayCount: number // number of distinct weekdays observed
  weekendCount: number // number of distinct weekend days observed
  averageWeekdayRevenue: number | null
  averageWeekendRevenue: number | null
  percentageDifference: number | null // valid only when both averages exist and weekday > 0
}

// ============================================================================
// Phase 3: Performance Tracking & Growth Types
// ============================================================================

export type ComparisonType = 'week-over-week' | 'month-over-month' | 'year-over-year'

export interface GrowthMetric {
  label: string
  current: number
  previous: number | null
  absoluteDifference: number | null
  percentageChange: number | null // null when previous is 0 or missing
  isPositive: boolean | null // null when N/A
}

export interface ProductChange {
  productName: string
  category: ProductCategory
  currentRevenue: number
  previousRevenue: number | null
  currentQuantity: number
  previousQuantity: number | null
  revenueChange: number | null
  revenuePercentChange: number | null
  quantityChange: number | null
  quantityPercentChange: number | null
  currentOrderCount: number
  previousOrderCount: number | null
}

export interface CategoryChange {
  category: ProductCategory
  currentRevenue: number
  previousRevenue: number | null
  currentQuantity: number
  previousQuantity: number | null
  revenueChange: number | null
  revenuePercentChange: number | null
}

export interface HistoricalGrowthRow {
  periodLabel: string
  periodStart: string
  periodEnd: string
  revenueInr: number
  orderCount: number
  itemsSold: number
  averageOrderValue: number
  revenueChangePercent: number | null
}

export interface PeriodComparison {
  type: ComparisonType
  currentStart: string
  currentEnd: string
  previousStart: string
  previousEnd: string
  isCurrentComplete: boolean
  isPreviousComplete: boolean
}
