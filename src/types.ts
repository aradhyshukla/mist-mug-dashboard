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
  | 'Unclassified'

export type ProductSource = 'website' | 'user' | 'legacy' | 'starter'

export interface Product {
  id: ProductId
  name: string
  category: ProductCategory
  description?: string
  currentPriceInr: number // current catalog selling price (INR)
  imageUrl?: string
  isActive: boolean
  source: ProductSource // provenance: website (synced from mist-and-mug.onrender.com), user (manually added), legacy (pre-existing), starter (old fictional seed)
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
  source?: ProductSource
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
// Issue 1: Verified website catalogue (source: https://mist-and-mug.onrender.com)
// Website menu data extracted from the site's embedded MENU array (IDs m01-m30).
// Website categories map to dashboard categories as follows:
//   COFFEE → Coffee (hot) / Cold Beverage (cold items: Cold Brew, Orange Espresso Tonic)
//   MOUNTAIN WARMERS → Tea
//   BREAKFAST → Bakery
//   SMALL PLATES → Signature
//   SWEET → Signature
// ============================================================================

export type WebsiteCategory = 'COFFEE' | 'MOUNTAIN WARMERS' | 'BREAKFAST' | 'SMALL PLATES' | 'SWEET'

export interface WebsiteProduct {
  id: string // website m01-m30
  name: string
  category: WebsiteCategory
  description: string
  price: number
  vegetarian: boolean
  vegan: boolean
  allergens: string[]
  caffeine: string
  temp: 'hot' | 'cold' | 'room'
  taste: string[]
  mood: string[]
  featured: boolean
  housePick: boolean
}

export const WEBSITE_CATEGORY_MAP: Record<WebsiteCategory, ProductCategory> = {
  'COFFEE': 'Coffee',
  'MOUNTAIN WARMERS': 'Tea',
  'BREAKFAST': 'Bakery',
  'SMALL PLATES': 'Signature',
  'SWEET': 'Signature',
}

// Cold items from the COFFEE website category map to Cold Beverage instead of Coffee
export const COFFEE_COLD_ITEMS = new Set(['m06', 'm07']) // Cold Brew, Orange Espresso Tonic

export const VERIFIED_PRODUCTS: Array<Omit<WebsiteProduct, 'vegetarian' | 'vegan' | 'allergens' | 'caffeine' | 'temp' | 'taste' | 'mood' | 'featured' | 'housePick'>> = [
  { id: 'm01', name: 'Landour Latte', category: 'COFFEE', description: 'Espresso, steamed milk, a whisper of cardamom.', price: 220 },
  { id: 'm02', name: 'Classic Cappuccino', category: 'COFFEE', description: 'Equal parts espresso, milk, and foam.', price: 190 },
  { id: 'm03', name: 'Flat White', category: 'COFFEE', description: 'Ristretto shots under a thin layer of micro-foam.', price: 210 },
  { id: 'm04', name: 'Espresso', category: 'COFFEE', description: 'A double shot, nothing standing in its way.', price: 140 },
  { id: 'm05', name: 'Hazelnut Cortado', category: 'COFFEE', description: 'Espresso cut with warm milk, a note of roasted hazelnut.', price: 230 },
  { id: 'm06', name: 'Cold Brew', category: 'COFFEE', description: 'Steeped 18 hours, served over ice, no dilution.', price: 210 },
  { id: 'm07', name: 'Orange Espresso Tonic', category: 'COFFEE', description: 'Espresso over tonic water, a wide slice of orange.', price: 260 },
  { id: 'm08', name: 'Americano', category: 'COFFEE', description: 'Espresso, opened up with hot water.', price: 160 },
  { id: 'm09', name: 'Pahadi Masala Chai', category: 'MOUNTAIN WARMERS', description: 'Black tea, whole spices, simmered with milk the hill way.', price: 130 },
  { id: 'm10', name: 'Kashmiri Kahwa', category: 'MOUNTAIN WARMERS', description: 'Green tea, saffron, almond slivers, a little cinnamon.', price: 150 },
  { id: 'm11', name: 'Himalayan Hot Chocolate', category: 'MOUNTAIN WARMERS', description: 'Dark chocolate melted slowly into whole milk.', price: 240 },
  { id: 'm12', name: 'Ginger Lemon Honey', category: 'MOUNTAIN WARMERS', description: 'Fresh ginger, lemon, and honey in hot water.', price: 170 },
  { id: 'm13', name: 'Turmeric Milk', category: 'MOUNTAIN WARMERS', description: 'Warm milk, turmeric, a little black pepper.', price: 180 },
  { id: 'm14', name: 'French Butter Croissant', category: 'BREAKFAST', description: 'Laminated, baked each morning, nothing added.', price: 160 },
  { id: 'm15', name: 'Mountain Breakfast Plate', category: 'BREAKFAST', description: 'Eggs, sautéed greens, roasted potatoes, toast.', price: 480 },
  { id: 'm16', name: 'Avocado Sourdough', category: 'BREAKFAST', description: 'Smashed avocado, chili flake, lemon, on sourdough.', price: 320 },
  { id: 'm17', name: 'Wild Mushroom Toast', category: 'BREAKFAST', description: 'Sautéed local mushrooms, thyme, brown butter.', price: 340 },
  { id: 'm18', name: 'Cinnamon French Toast', category: 'BREAKFAST', description: 'Brioche, cinnamon custard, maple.', price: 300 },
  { id: 'm19', name: 'Bun Maska', category: 'BREAKFAST', description: 'Soft bun, cold butter, a little sugar on the side.', price: 150 },
  { id: 'm20', name: 'Cheese Chilli Toast', category: 'SMALL PLATES', description: 'Melted cheese, green chili, grilled bread.', price: 260 },
  { id: 'm21', name: 'Himalayan Herb Fries', category: 'SMALL PLATES', description: 'Hand-cut fries, mountain herbs, sea salt.', price: 220 },
  { id: 'm22', name: 'Roasted Vegetable Sandwich', category: 'SMALL PLATES', description: 'Seasonal vegetables, herb oil, grilled sourdough.', price: 280 },
  { id: 'm23', name: 'Paneer Tikka Toastie', category: 'SMALL PLATES', description: 'Tandoor-spiced paneer, mint chutney, toasted bread.', price: 300 },
  { id: 'm24', name: 'Soup of the Fog', category: 'SMALL PLATES', description: 'A rotating wild mushroom soup, cream, thyme oil.', price: 240 },
  { id: 'm25', name: 'Burnt Basque Cheesecake', category: 'SWEET', description: 'Deliberately scorched top, molten center.', price: 260 },
  { id: 'm26', name: 'Apple Cinnamon Tart', category: 'SWEET', description: 'Thin apple slices, cinnamon, a shortcrust base.', price: 210 },
  { id: 'm27', name: 'Dark Chocolate Eclair', category: 'SWEET', description: 'Choux pastry, vanilla cream, dark chocolate glaze.', price: 230 },
  { id: 'm28', name: 'Cloud Tiramisu', category: 'SWEET', description: 'Espresso-soaked layers, mascarpone, cocoa dust.', price: 280 },
  { id: 'm29', name: 'Classic Madeleines', category: 'SWEET', description: 'Shell-shaped, buttery, a little citrus zest.', price: 170 },
  { id: 'm30', name: 'Walnut Banana Loaf', category: 'SWEET', description: 'Dense banana loaf, toasted walnut, a little brown sugar.', price: 190 },
]

// Converts a WebsiteProduct to a ProductInput with dashboard category mapping
export function websiteProductToInput(wp: Omit<WebsiteProduct, 'vegetarian' | 'vegan' | 'allergens' | 'caffeine' | 'temp' | 'taste' | 'mood' | 'featured' | 'housePick'>): ProductInput {
  let category = WEBSITE_CATEGORY_MAP[wp.category]
  // Cold coffee items map to Cold Beverage instead of Coffee
  if (wp.category === 'COFFEE' && COFFEE_COLD_ITEMS.has(wp.id)) {
    category = 'Cold Beverage'
  }
  return {
    name: wp.name,
    category,
    currentPriceInr: wp.price,
    description: wp.description,
    source: 'website',
  }
}

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
  batchId?: UploadBatchId // originating upload batch, set at import time
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
