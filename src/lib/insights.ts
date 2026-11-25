/**
 * Mist & Mug — Rule-Based Insights Engine 2.0
 *
 * Produces varied, evidence-backed findings across reporting periods using
 * deterministic, period-aware weighted selection. Exactly 3 primary insights
 * and at most 1 recommended action are displayed.
 *
 * Read-only: never writes to IndexedDB or modifies any data.
 */

import type { ProcessedLine } from '@/types'
import type {
  Insight,
  InsightCandidate,
  InsightMetric,
  InsightType,
  EvidenceStrength,
  InsightsResult,
} from '@/types/insights'

import { generateRecommendations } from '@/lib/recommendations'

import {
  computeDashboardMetrics,
  computeTopProducts,
  computeHourlyData,
  computeWeekdayWeekend,
  computeDailyTrend,
  computeMonthlyTrend,
  computeYearlyTrend,
} from '@/lib/analytics'
import {
  resolveSelection,
  getPreviousPeriod,
} from '@/lib/reporting-periods'
import type { ResolvedPeriod, ReportingPeriodSelection } from '@/lib/reporting-periods'
import { formatInr } from '@/lib/utils'

// ===========================================================================
// Metric formatting helpers (never NaN/Infinity/undefined)
// ===========================================================================

function safeNumber(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0
  return value
}

function metricInr(label: string, value: number | null | undefined): InsightMetric {
  const v = safeNumber(value)
  return { label, value: formatInr(v), format: 'inr' }
}

function metricPercent(label: string, value: number | null | undefined): InsightMetric {
  const v = safeNumber(value)
  return { label, value: Math.round(v * 10) / 10, format: 'percent' }
}

function metricCount(label: string, value: number | null | undefined): InsightMetric {
  const v = safeNumber(value)
  return { label, value: Math.round(v), format: 'count' }
}

// ---------------------------------------------------------------------------
// Evidence strength classification
// ---------------------------------------------------------------------------

function classifyEvidenceStrength(
  orderCount: number,
  dayCount: number,
  hasCompletePeriod: boolean,
): EvidenceStrength {
  if (!hasCompletePeriod || orderCount === 0) return 'limited'
  if (orderCount >= 50 && dayCount >= 7) return 'strong'
  if (orderCount >= 20 && dayCount >= 4) return 'moderate'
  return 'limited'
}

// ---------------------------------------------------------------------------
// Deterministic seeding for controlled variety
// ---------------------------------------------------------------------------

/**
 * Derive a stable seed from the reporting period and dataset fingerprint.
 * Same period + same data = same seed. Different periods = different seeds.
 */
function deriveSeed(period: ResolvedPeriod, lines: ProcessedLine[]): number {
  let hash = 0
  const data = `${period.label}|${period.startDate}|${period.endDate}|${lines.length}`
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  // Also incorporate a dataset fingerprint (sum of line totals)
  const fingerprint = lines.reduce((s, l) => s + l.lineTotalInr, 0)
  hash = ((hash << 5) - hash + fingerprint) | 0
  return Math.abs(hash)
}

/**
 * Simple seeded pseudo-random number generator (LCG).
 * Returns a deterministic float in [0, 1) based on the seed.
 */
function seededRandom(seed: number): () => number {
  let state = seed | 0
  if (state === 0) state = 1
  return () => {
    state = (state * 1664525 + 1013904223) | 0
    return (state >>> 0) / 0xffffffff
  }
}

function deterministicId(prefix: string, data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`
}

// ===========================================================================
// Hour helper
// ===========================================================================

function hourRangeLabel(hour: number): string {
  const start = String(hour).padStart(2, '0')
  const end = String((hour + 1) % 24).padStart(2, '0')
  return `${start}:00–${end}:00`
}

// ===========================================================================
// Rule A — Weekday vs Weekend Performance
// ===========================================================================

async function candidateWeekdayWeekend(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const ww = await computeWeekdayWeekend(period.startDate, period.endDate)

  if (ww.weekdayCount === 0 || ww.weekendCount === 0) {
    return {
      type: 'weekday-weekend',
      family: 'day-pattern',
      title: 'Weekday vs Weekend Performance',
      explanation: 'Insufficient weekday or weekend observations to compare.',
      supportingMetrics: [],
      evidence: 'No valid comparison possible.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Need both weekday and weekend observations'],
    }
  }

  const weekdayAvg = ww.averageWeekdayRevenue ?? 0
  const weekendAvg = ww.averageWeekendRevenue ?? 0
  const pctDiff = ww.percentageDifference ?? 0
  const weekendHigher = weekendAvg > weekdayAvg

  const totalRevenue = ww.weekdayRevenue + ww.weekendRevenue
  const orderCount = ww.weekdayOrderCount + ww.weekendOrderCount
  const dayCount = ww.weekdayCount + ww.weekendCount

  const strength = classifyEvidenceStrength(orderCount, dayCount, true)
  const relevance = Math.min(90, Math.abs(pctDiff) + 30)

  let title: string
  let explanation: string
  if (weekendHigher) {
    title = 'Weekend days outperform weekdays'
    explanation = `Average weekend revenue per day (${formatInr(weekendAvg)}) is ${Math.abs(pctDiff).toFixed(1)}% higher than weekdays (${formatInr(weekdayAvg)}).`
  } else {
    title = 'Weekdays outperform weekend days'
    explanation = `Average weekday revenue per day (${formatInr(weekdayAvg)}) is ${Math.abs(pctDiff).toFixed(1)}% higher than weekends (${formatInr(weekendAvg)}).`
  }

  const metrics = [
    metricInr('Total weekday revenue', ww.weekdayRevenue),
    metricInr('Total weekend revenue', ww.weekendRevenue),
    metricInr('Avg per weekday', weekdayAvg),
    metricInr('Avg per weekend day', weekendAvg),
    metricCount('Weekday orders', ww.weekdayOrderCount),
    metricCount('Weekend orders', ww.weekendOrderCount),
    metricCount('Weekdays observed', ww.weekdayCount),
    metricCount('Weekend days observed', ww.weekendCount),
    metricPercent('Weekend vs weekday daily average', pctDiff),
  ]

  return {
    type: 'weekday-weekend',
    family: 'day-pattern',
    title,
    explanation,
    supportingMetrics: metrics,
    evidence: `Analyzed ${ww.weekdayCount} weekdays and ${ww.weekendCount} weekend days with ${orderCount} unique orders totaling ${formatInr(totalRevenue)}.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule B — Peak Sales Hours
// ===========================================================================

async function candidatePeakSalesHours(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const hourly = await computeHourlyData(period.startDate, period.endDate)

  if (hourly.length === 0) {
    return {
      type: 'peak-sales-hours',
      family: 'hour-pattern',
      title: 'Peak Sales Hours',
      explanation: 'No reliable hourly sales data available for this period.',
      supportingMetrics: [],
      evidence: 'Timestamps missing or unreliable.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No hourly data available'],
    }
  }

  const sortedByRevenue = [...hourly].sort((a, b) => b.revenueInr - a.revenueInr || a.hour - b.hour)
  const topHour = sortedByRevenue[0]
  const bottomHour = [...hourly].sort((a, b) => a.revenueInr - b.revenueInr || a.hour - b.hour)[0]

  const totalHourlyRevenue = hourly.reduce((s, h) => s + h.revenueInr, 0)
  const topHourShare = totalHourlyRevenue > 0 ? (topHour.revenueInr / totalHourlyRevenue) * 100 : 0

  const orderCount = hourly.reduce((s, h) => s + h.orderCount, 0)
  const hourCount = hourly.length

  const strength = classifyEvidenceStrength(orderCount, hourCount, true)
  const relevance = Math.min(85, Math.round(topHourShare) + 25)

  const metrics = [
    metricInr('Peak hourly revenue', topHour.revenueInr),
    metricCount('Peak hour orders', topHour.orderCount),
    metricPercent('Peak hour revenue share', topHourShare),
    metricInr('Lowest hour revenue', bottomHour.revenueInr),
    metricCount('Hours observed', hourCount),
  ]

  return {
    type: 'peak-sales-hours',
    family: 'hour-pattern',
    title: `Peak hour: ${hourRangeLabel(topHour.hour)}`,
    explanation: `${hourRangeLabel(topHour.hour)} generated the highest recorded hourly revenue at ${formatInr(topHour.revenueInr)} across ${topHour.orderCount} unique orders.`,
    supportingMetrics: metrics,
    evidence: `Analyzed ${hourCount} hours with ${orderCount} unique orders totaling ${formatInr(totalHourlyRevenue)}. The peak hour represents ${topHourShare.toFixed(1)}% of recorded revenue.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule C — Low-Activity Hours
// ===========================================================================

async function candidateLowActivityHours(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const hourly = await computeHourlyData(period.startDate, period.endDate)

  if (hourly.length < 2) {
    return {
      type: 'low-activity-hours',
      family: 'hour-pattern',
      title: 'Low-Activity Hours',
      explanation: 'Insufficient hourly data to identify low-activity periods.',
      supportingMetrics: [],
      evidence: 'Need at least two hours with data.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Insufficient hourly data'],
    }
  }

  const sortedByRevenue = [...hourly].sort((a, b) => a.revenueInr - b.revenueInr || a.hour - b.hour)
  const lowestHour = sortedByRevenue[0]

  const totalHourlyRevenue = hourly.reduce((s, h) => s + h.revenueInr, 0)
  const avgHourlyRevenue = totalHourlyRevenue / hourly.length
  const lowestShare = totalHourlyRevenue > 0 ? (lowestHour.revenueInr / totalHourlyRevenue) * 100 : 0
  const vsAvg = avgHourlyRevenue > 0 ? ((lowestHour.revenueInr - avgHourlyRevenue) / avgHourlyRevenue) * 100 : 0

  const orderCount = hourly.reduce((s, h) => s + h.orderCount, 0)
  const hourCount = hourly.length

  const strength = classifyEvidenceStrength(orderCount, hourCount, true)
  const relevance = Math.min(80, Math.round(Math.abs(vsAvg)) + 20)

  const metrics = [
    metricInr('Lowest hourly revenue', lowestHour.revenueInr),
    metricCount('Lowest hour orders', lowestHour.orderCount),
    metricPercent('Lowest hour revenue share', lowestShare),
    metricPercent('Below average hourly revenue', vsAvg),
    metricCount('Hours observed', hourCount),
  ]

  return {
    type: 'low-activity-hours',
    family: 'hour-pattern',
    title: `Low activity: ${hourRangeLabel(lowestHour.hour)}`,
    explanation: `${hourRangeLabel(lowestHour.hour)} recorded the lowest hourly revenue at ${formatInr(lowestHour.revenueInr)}, ${Math.abs(vsAvg).toFixed(1)}% below the period average of ${formatInr(Math.round(avgHourlyRevenue))}.`,
    supportingMetrics: metrics,
    evidence: `Analyzed ${hourCount} hours with ${orderCount} unique orders totaling ${formatInr(totalHourlyRevenue)}. The low-activity hour represents ${lowestShare.toFixed(1)}% of recorded revenue.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule D — Top-Selling Products
// ===========================================================================

async function candidateTopSellingProducts(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const products = await computeTopProducts(period.startDate, period.endDate, 5)

  if (products.length === 0) {
    return {
      type: 'top-selling-products',
      family: 'product-performance',
      title: 'Top-Selling Products',
      explanation: 'No product sales recorded for this period.',
      supportingMetrics: [],
      evidence: 'No transaction lines available.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No product sales data'],
    }
  }

  const totalRevenue = products.reduce((s, p) => s + p.revenueInr, 0)
  const top3 = products.slice(0, 3)
  const top3Revenue = top3.reduce((s, p) => s + p.revenueInr, 0)
  const top3Share = totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0

  const topProduct = products[0]
  const totalQuantity = products.reduce((s, p) => s + p.quantitySold, 0)

  const orderCount = products.reduce((s, p) => s + p.orderCount, 0)
  const strength = classifyEvidenceStrength(orderCount, products.length, true)
  const relevance = Math.min(90, Math.round(top3Share) + 20)

  const metrics = [
    metricInr('Top product revenue', topProduct.revenueInr),
    metricCount('Top product orders', topProduct.orderCount),
    metricCount('Top product units', topProduct.quantitySold),
    metricPercent('Top 3 products revenue share', top3Share),
    metricCount('Products observed', products.length),
    metricCount('Total units sold', totalQuantity),
  ]

  const names = top3.map((p) => p.productName).join(', ')
  return {
    type: 'top-selling-products',
    family: 'product-performance',
    title: 'Top products drive revenue',
    explanation: `Your top 3 products (${names}) account for ${top3Share.toFixed(1)}% of recorded revenue (${formatInr(top3Revenue)} of ${formatInr(totalRevenue)}).`,
    supportingMetrics: metrics,
    evidence: `Analyzed ${products.length} products with ${totalQuantity} units sold across ${orderCount} unique orders. Historical transaction prices used, not current catalogue prices.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    limitation: 'Does not account for product profitability or margins.',
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule E — Underperforming Products
// ===========================================================================

async function candidateUnderperformingProducts(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const products = await computeTopProducts(period.startDate, period.endDate, 10)

  if (products.length < 2) {
    return {
      type: 'underperforming-products',
      family: 'product-performance',
      title: 'Underperforming Products',
      explanation: 'Insufficient product data to identify underperformers.',
      supportingMetrics: [],
      evidence: 'Need at least two products with sales data.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Insufficient product data'],
    }
  }

  const totalRevenue = products.reduce((s, p) => s + p.revenueInr, 0)
  const avgRevenue = totalRevenue / products.length
  const underperformers = products.filter((p) => p.revenueInr < avgRevenue * 0.5)

  if (underperformers.length === 0) {
    return {
      type: 'underperforming-products',
      family: 'product-performance',
      title: 'Underperforming Products',
      explanation: 'No products significantly underperform the average.',
      supportingMetrics: [],
      evidence: 'All products contribute reasonably to revenue.',
      evidenceStrength: 'limited',
      relevanceScore: 10,
      valid: false,
      validationErrors: ['No significant underperformers'],
    }
  }

  const weakest = underperformers[underperformers.length - 1]
  const weakestShare = totalRevenue > 0 ? (weakest.revenueInr / totalRevenue) * 100 : 0

  const orderCount = products.reduce((s, p) => s + p.orderCount, 0)
  const strength = classifyEvidenceStrength(orderCount, products.length, true)
  const relevance = Math.min(75, Math.round((1 - weakestShare) * 100) + 20)

  const metrics = [
    metricInr('Weakest product revenue', weakest.revenueInr),
    metricPercent('Weakest product revenue share', weakestShare),
    metricInr('Average product revenue', Math.round(avgRevenue * 100) / 100),
    metricCount('Underperforming products', underperformers.length),
    metricCount('Products observed', products.length),
  ]

  const names = underperformers.slice(0, 3).map((p) => p.productName).join(', ')
  return {
    type: 'underperforming-products',
    family: 'product-performance',
    title: 'Some products underperform',
    explanation: `Products like ${names} contribute well below the average product revenue. The weakest, ${weakest.productName}, accounts for only ${weakestShare.toFixed(1)}% of recorded revenue.`,
    supportingMetrics: metrics,
    evidence: `Analyzed ${products.length} products. ${underperformers.length} products perform below half the average revenue per product.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    limitation: 'Low revenue may reflect niche appeal or seasonal demand rather than poor performance.',
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule F — Revenue Concentration
// ===========================================================================

async function candidateRevenueConcentration(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const products = await computeTopProducts(period.startDate, period.endDate, 5)

  if (products.length === 0) {
    return {
      type: 'revenue-concentration',
      family: 'product-performance',
      title: 'Revenue Concentration',
      explanation: 'No product revenue data available.',
      supportingMetrics: [],
      evidence: 'No transactions recorded.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No product revenue data'],
    }
  }

  const totalRevenue = products.reduce((s, p) => s + p.revenueInr, 0)
  const top5 = products.slice(0, 5)
  const top5Revenue = top5.reduce((s, p) => s + p.revenueInr, 0)
  const top5Share = totalRevenue > 0 ? (top5Revenue / totalRevenue) * 100 : 0

  const topProduct = products[0]
  const top1Share = totalRevenue > 0 ? (topProduct.revenueInr / totalRevenue) * 100 : 0

  const orderCount = products.reduce((s, p) => s + p.orderCount, 0)
  const strength = classifyEvidenceStrength(orderCount, products.length, true)
  const relevance = Math.min(90, Math.round(top5Share))

  const metrics = [
    metricInr('Top product revenue', topProduct.revenueInr),
    metricPercent('Top product revenue share', top1Share),
    metricPercent('Top 5 products revenue share', top5Share),
    metricCount('Products observed', products.length),
    metricCount('Total unique orders', orderCount),
  ]

  const names = top5.map((p) => p.productName).join(', ')
  return {
    type: 'revenue-concentration',
    family: 'product-performance',
    title: 'Revenue concentrated in leading products',
    explanation: `The top 5 products (${names}) account for ${top5Share.toFixed(1)}% of recorded revenue. The leading product, ${topProduct.productName}, alone contributes ${top1Share.toFixed(1)}%.`,
    supportingMetrics: metrics,
    evidence: `Analyzed ${products.length} products with ${orderCount} unique orders totaling ${formatInr(totalRevenue)}. Historical transaction prices used.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    limitation: 'High revenue concentration does not imply high profitability.',
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule G — Revenue Growth (vs previous period)
// ===========================================================================

async function candidateRevenueGrowth(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const current = await computeDashboardMetrics(period.startDate, period.endDate)

  if (current.orderCount === 0) {
    return {
      type: 'revenue-growth',
      family: 'revenue-change',
      title: 'Revenue Growth',
      explanation: 'No orders recorded for this period.',
      supportingMetrics: [],
      evidence: 'No valid transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No orders in period'],
    }
  }

  const previousSelection = getPreviousPeriod(period.selection)
  if (!previousSelection) {
    return {
      type: 'revenue-growth',
      family: 'revenue-change',
      title: 'Revenue Growth',
      explanation: 'No previous period available for comparison.',
      supportingMetrics: [],
      evidence: 'Previous period comparison not supported (e.g. January, Week 1, or All Time).',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No previous period available'],
    }
  }

  const previousResolved = resolveSelection(previousSelection, lines)
  if (!previousResolved) {
    return {
      type: 'revenue-growth',
      family: 'revenue-change',
      title: 'Revenue Growth',
      explanation: 'Previous period has no data.',
      supportingMetrics: [],
      evidence: 'The comparable previous period contains no transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has no data'],
    }
  }

  const previous = await computeDashboardMetrics(previousResolved.startDate, previousResolved.endDate)
  if (previous.orderCount === 0 || previous.revenueInr === 0) {
    return {
      type: 'revenue-growth',
      family: 'revenue-change',
      title: 'Revenue Growth',
      explanation: 'Previous period has no revenue to compare against.',
      supportingMetrics: [],
      evidence: 'Previous period recorded zero revenue.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has zero revenue'],
    }
  }

  const pctChange = ((current.revenueInr - previous.revenueInr) / previous.revenueInr) * 100
  const absChange = current.revenueInr - previous.revenueInr

  if (pctChange <= 0) {
    return {
      type: 'revenue-growth',
      family: 'revenue-change',
      title: 'Revenue Growth',
      explanation: 'Revenue did not grow compared to the previous period.',
      supportingMetrics: [],
      evidence: `Revenue changed by ${pctChange.toFixed(1)}% vs previous period.`,
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No revenue growth detected'],
    }
  }

  const orderCount = current.orderCount + previous.orderCount
  const strength = classifyEvidenceStrength(orderCount, 30, true)
  const relevance = Math.min(90, Math.round(pctChange) + 30)

  const metrics = [
    metricInr('Current period revenue', current.revenueInr),
    metricInr('Previous period revenue', previous.revenueInr),
    metricInr('Revenue change', absChange > 0 ? absChange : 0),
    metricPercent('Revenue growth vs previous period', pctChange),
    metricCount('Current orders', current.orderCount),
    metricCount('Previous orders', previous.orderCount),
  ]

  return {
    type: 'revenue-growth',
    family: 'revenue-change',
    title: 'Revenue is growing',
    explanation: `Revenue increased by ${pctChange.toFixed(1)}% compared to the previous period (${formatInr(current.revenueInr)} vs ${formatInr(previous.revenueInr)}).`,
    supportingMetrics: metrics,
    evidence: `Compared ${current.orderCount} orders in current period with ${previous.orderCount} orders in previous period. Revenue grew by ₹${Math.round(absChange)}.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule H — Revenue Decline (vs previous period)
// ===========================================================================

async function candidateRevenueDecline(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const current = await computeDashboardMetrics(period.startDate, period.endDate)

  if (current.orderCount === 0) {
    return {
      type: 'revenue-decline',
      family: 'revenue-change',
      title: 'Revenue Decline',
      explanation: 'No orders recorded for this period.',
      supportingMetrics: [],
      evidence: 'No valid transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No orders in period'],
    }
  }

  const previousSelection = getPreviousPeriod(period.selection)
  if (!previousSelection) {
    return {
      type: 'revenue-decline',
      family: 'revenue-change',
      title: 'Revenue Decline',
      explanation: 'No previous period available for comparison.',
      supportingMetrics: [],
      evidence: 'Previous period comparison not supported.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No previous period available'],
    }
  }

  const previousResolved = resolveSelection(previousSelection, lines)
  if (!previousResolved) {
    return {
      type: 'revenue-decline',
      family: 'revenue-change',
      title: 'Revenue Decline',
      explanation: 'Previous period has no data.',
      supportingMetrics: [],
      evidence: 'The comparable previous period contains no transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has no data'],
    }
  }

  const previous = await computeDashboardMetrics(previousResolved.startDate, previousResolved.endDate)
  if (previous.orderCount === 0 || previous.revenueInr === 0) {
    return {
      type: 'revenue-decline',
      family: 'revenue-change',
      title: 'Revenue Decline',
      explanation: 'Previous period has no revenue to compare against.',
      supportingMetrics: [],
      evidence: 'Previous period recorded zero revenue.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has zero revenue'],
    }
  }

  const pctChange = ((current.revenueInr - previous.revenueInr) / previous.revenueInr) * 100
  const absChange = current.revenueInr - previous.revenueInr

  if (pctChange >= 0) {
    return {
      type: 'revenue-decline',
      family: 'revenue-change',
      title: 'Revenue Decline',
      explanation: 'Revenue did not decline compared to the previous period.',
      supportingMetrics: [],
      evidence: `Revenue changed by ${pctChange.toFixed(1)}% vs previous period.`,
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No revenue decline detected'],
    }
  }

  const orderCount = current.orderCount + previous.orderCount
  const strength = classifyEvidenceStrength(orderCount, 30, true)
  const relevance = Math.min(90, Math.round(Math.abs(pctChange)) + 30)

  const metrics = [
    metricInr('Current period revenue', current.revenueInr),
    metricInr('Previous period revenue', previous.revenueInr),
    metricInr('Revenue change', Math.abs(absChange)),
    metricPercent('Revenue decline vs previous period', Math.abs(pctChange)),
    metricCount('Current orders', current.orderCount),
    metricCount('Previous orders', previous.orderCount),
  ]

  return {
    type: 'revenue-decline',
    family: 'revenue-change',
    title: 'Revenue is declining',
    explanation: `Revenue decreased by ${Math.abs(pctChange).toFixed(1)}% compared to the previous period (${formatInr(current.revenueInr)} vs ${formatInr(previous.revenueInr)}).`,
    supportingMetrics: metrics,
    evidence: `Compared ${current.orderCount} orders in current period with ${previous.orderCount} orders in previous period. Revenue fell by ₹${Math.round(Math.abs(absChange))}.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule I — Order Volume Change (vs previous period)
// ===========================================================================

async function candidateOrderVolumeChange(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const current = await computeDashboardMetrics(period.startDate, period.endDate)

  if (current.orderCount === 0) {
    return {
      type: 'order-volume-change',
      family: 'revenue-change',
      title: 'Order Volume Change',
      explanation: 'No orders recorded for this period.',
      supportingMetrics: [],
      evidence: 'No valid transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No orders in period'],
    }
  }

  const previousSelection = getPreviousPeriod(period.selection)
  if (!previousSelection) {
    return {
      type: 'order-volume-change',
      family: 'revenue-change',
      title: 'Order Volume Change',
      explanation: 'No previous period available for comparison.',
      supportingMetrics: [],
      evidence: 'Previous period comparison not supported.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No previous period available'],
    }
  }

  const previousResolved = resolveSelection(previousSelection, lines)
  if (!previousResolved) {
    return {
      type: 'order-volume-change',
      family: 'revenue-change',
      title: 'Order Volume Change',
      explanation: 'Previous period has no data.',
      supportingMetrics: [],
      evidence: 'The comparable previous period contains no transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has no data'],
    }
  }

  const previous = await computeDashboardMetrics(previousResolved.startDate, previousResolved.endDate)
  if (previous.orderCount === 0) {
    return {
      type: 'order-volume-change',
      family: 'revenue-change',
      title: 'Order Volume Change',
      explanation: 'Previous period has no orders to compare against.',
      supportingMetrics: [],
      evidence: 'Previous period recorded zero orders.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['Previous period has zero orders'],
    }
  }

  const pctChange = ((current.orderCount - previous.orderCount) / previous.orderCount) * 100
  const absChange = current.orderCount - previous.orderCount

  if (Math.abs(pctChange) < 5) {
    return {
      type: 'order-volume-change',
      family: 'revenue-change',
      title: 'Order Volume Change',
      explanation: 'Order volume is stable compared to the previous period.',
      supportingMetrics: [],
      evidence: `Order count changed by ${pctChange.toFixed(1)}% vs previous period (below 5% threshold).`,
      evidenceStrength: 'limited',
      relevanceScore: 10,
      valid: false,
      validationErrors: ['Order volume change below significance threshold'],
    }
  }

  const orderCount = current.orderCount + previous.orderCount
  const strength = classifyEvidenceStrength(orderCount, 30, true)
  const relevance = Math.min(85, Math.round(Math.abs(pctChange)) + 25)

  const direction = pctChange > 0 ? 'increased' : 'decreased'
  const metrics = [
    metricCount('Current orders', current.orderCount),
    metricCount('Previous orders', previous.orderCount),
    metricCount('Order change', Math.abs(absChange)),
    metricPercent('Order volume change vs previous period', Math.abs(pctChange)),
    metricInr('Current period revenue', current.revenueInr),
    metricInr('Previous period revenue', previous.revenueInr),
  ]

  return {
    type: 'order-volume-change',
    family: 'revenue-change',
    title: `Order volume ${direction}`,
    explanation: `Order volume ${direction} by ${Math.abs(pctChange).toFixed(1)}% compared to the previous period (${current.orderCount} vs ${previous.orderCount} orders).`,
    supportingMetrics: metrics,
    evidence: `Compared ${current.orderCount} orders in current period with ${previous.orderCount} orders in previous period.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule J — Revenue Trend (daily/weekly/monthly patterns)
// ===========================================================================

async function candidateRevenueTrend(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const selectionKind = period.selection.kind

  let trendData: Array<{ period: string; periodKey: string; revenueInr: number; orderCount: number; itemsSold: number }>
  let bucketLabel: string

  switch (selectionKind) {
    case 'month': {
      const daily = await computeDailyTrend(period.startDate, period.endDate)
      trendData = daily.map((d) => ({
        period: d.date,
        periodKey: d.date,
        revenueInr: d.revenueInr,
        orderCount: d.orderCount,
        itemsSold: d.itemsSold,
      }))
      bucketLabel = 'daily'
      break
    }
    case 'year':
      trendData = await computeMonthlyTrend(period.startDate, period.endDate)
      bucketLabel = 'monthly'
      break
    case 'week': {
      const daily = await computeDailyTrend(period.startDate, period.endDate)
      trendData = daily.map((d) => ({
        period: d.date,
        periodKey: d.date,
        revenueInr: d.revenueInr,
        orderCount: d.orderCount,
        itemsSold: d.itemsSold,
      }))
      bucketLabel = 'daily'
      break
    }
    case 'all-time':
      trendData = await computeYearlyTrend(period.startDate, period.endDate)
      bucketLabel = 'yearly'
      break
    default: {
      const daily = await computeDailyTrend(period.startDate, period.endDate)
      trendData = daily.map((d) => ({
        period: d.date,
        periodKey: d.date,
        revenueInr: d.revenueInr,
        orderCount: d.orderCount,
        itemsSold: d.itemsSold,
      }))
      bucketLabel = 'daily'
    }
  }

  if (trendData.length === 0) {
    return {
      type: 'revenue-trend',
      family: 'time-pattern',
      title: 'Revenue Trends',
      explanation: 'No revenue data available for trend analysis.',
      supportingMetrics: [],
      evidence: 'No transactions in the selected period.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No trend data'],
    }
  }

  const sortedByRevenue = [...trendData].sort((a, b) => b.revenueInr - a.revenueInr)
  const highest = sortedByRevenue[0]
  const lowest = [...trendData].sort((a, b) => a.revenueInr - b.revenueInr)[0]

  const totalRevenue = trendData.reduce((s, d) => d.revenueInr + s, 0)
  const totalOrders = trendData.reduce((s, d) => s + d.orderCount, 0)

  const strength = classifyEvidenceStrength(totalOrders, trendData.length, true)
  const relevance = Math.min(85, Math.round(((highest.revenueInr - lowest.revenueInr) / Math.max(totalRevenue, 1)) * 100) + 30)

  const metrics = [
    metricInr('Total period revenue', totalRevenue),
    metricCount('Total orders', totalOrders),
    metricInr(`Highest-revenue ${bucketLabel}`, highest.revenueInr),
    metricInr(`Lowest-revenue ${bucketLabel}`, lowest.revenueInr),
    metricCount('Buckets observed', trendData.length),
  ]

  let title: string
  let explanation: string
  if (selectionKind === 'month') {
    title = `${period.label}: ${highest.period} was the strongest day`
    explanation = `${highest.period} recorded the highest revenue at ${formatInr(highest.revenueInr)}, while ${lowest.period} was the lowest at ${formatInr(lowest.revenueInr)}.`
  } else if (selectionKind === 'year') {
    title = `${period.label}: ${highest.period} was the strongest month`
    explanation = `${highest.period} recorded the highest revenue at ${formatInr(highest.revenueInr)}, while ${lowest.period} was the lowest at ${formatInr(lowest.revenueInr)}.`
  } else {
    title = `Revenue varies across ${bucketLabel}s`
    explanation = `${highest.period} recorded the highest revenue at ${formatInr(highest.revenueInr)}.`
  }

  return {
    type: 'revenue-trend',
    family: 'time-pattern',
    title,
    explanation,
    supportingMetrics: metrics,
    evidence: `Analyzed ${trendData.length} ${bucketLabel} buckets totaling ${formatInr(totalRevenue)} across ${totalOrders} unique orders.`,
    evidenceStrength: strength,
    relevanceScore: relevance,
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Rule K — Average Order Value
// ===========================================================================

async function candidateAverageOrderValue(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const current = await computeDashboardMetrics(period.startDate, period.endDate)

  if (current.orderCount === 0) {
    return {
      type: 'average-order-value',
      family: 'revenue-change',
      title: 'Average Order Value',
      explanation: 'No orders recorded for this period.',
      supportingMetrics: [],
      evidence: 'No valid transactions.',
      evidenceStrength: 'limited',
      relevanceScore: 0,
      valid: false,
      validationErrors: ['No orders in period'],
    }
  }

  const previousSelection = getPreviousPeriod(period.selection)
  let previousMetrics: { revenueInr: number; orderCount: number } | null = null

  if (previousSelection) {
    const previousResolved = resolveSelection(previousSelection, lines)
    if (previousResolved) {
      const pm = await computeDashboardMetrics(previousResolved.startDate, previousResolved.endDate)
      if (pm.orderCount > 0) {
        previousMetrics = { revenueInr: pm.revenueInr, orderCount: pm.orderCount }
      }
    }
  }

  const aov = current.averageOrderValue
  const metrics = [
    metricInr('Average order value', aov),
    metricInr('Total revenue', current.revenueInr),
    metricCount('Unique orders', current.orderCount),
  ]

  if (previousMetrics && previousMetrics.orderCount > 0) {
    const prevAov = previousMetrics.revenueInr / previousMetrics.orderCount
    const absDiff = aov - prevAov
    const pctDiff = prevAov > 0 ? (absDiff / prevAov) * 100 : 0
    const improved = absDiff > 0

    metrics.push(metricInr('Previous period AOV', Math.round(prevAov * 100) / 100))
    metrics.push(metricPercent('AOV change', pctDiff))

    const direction = improved ? 'increased' : 'decreased'
    return {
      type: 'average-order-value',
      family: 'revenue-change',
      title: `Average order value ${direction}`,
      explanation: `AOV is ${formatInr(Math.round(aov * 100) / 100)} vs ${formatInr(Math.round(prevAov * 100) / 100)} in the previous period (${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}%).`,
      supportingMetrics: metrics,
      evidence: `Compared current period (${current.orderCount} orders) with previous period (${previousMetrics.orderCount} orders).`,
      evidenceStrength: 'strong',
      relevanceScore: Math.min(85, Math.abs(pctDiff) + 40),
      valid: true,
      validationErrors: [],
    }
  }

  return {
    type: 'average-order-value',
    family: 'revenue-change',
    title: 'Average order value',
    explanation: `Average order value is ${formatInr(Math.round(aov * 100) / 100)} across ${current.orderCount} unique orders.`,
    supportingMetrics: metrics,
    evidence: `Calculated from ${current.orderCount} unique orders totaling ${formatInr(current.revenueInr)}. No previous-period comparison available for this selection.`,
    evidenceStrength: 'moderate',
    relevanceScore: 50,
    limitation: 'No previous-period comparison available (e.g. January, Week 1, or All Time).',
    valid: true,
    validationErrors: [],
  }
}

// ===========================================================================
// Candidate generation — all rules (10 analytical families)
// ===========================================================================

export async function generateCandidates(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate[]> {
  return Promise.all([
    candidateWeekdayWeekend(lines, period),
    candidatePeakSalesHours(lines, period),
    candidateLowActivityHours(lines, period),
    candidateTopSellingProducts(lines, period),
    candidateUnderperformingProducts(lines, period),
    candidateRevenueConcentration(lines, period),
    candidateRevenueGrowth(lines, period),
    candidateRevenueDecline(lines, period),
    candidateOrderVolumeChange(lines, period),
    candidateRevenueTrend(lines, period),
    candidateAverageOrderValue(lines, period),
  ])
}

// ===========================================================================
// Evidence validation
// ===========================================================================

export function validateCandidate(candidate: InsightCandidate): InsightCandidate {
  const errors: string[] = [...candidate.validationErrors]

  if (!candidate.valid) {
    return { ...candidate, valid: false, validationErrors: errors }
  }

  // No fabricated values — supporting metrics must be present
  if (candidate.supportingMetrics.length === 0 && candidate.valid) {
    errors.push('No supporting metrics')
  }

  // Evidence description must not be empty
  if (!candidate.evidence || candidate.evidence.trim().length === 0) {
    errors.push('Missing evidence description')
  }

  // Relevance score must be in range
  if (candidate.relevanceScore < 0 || candidate.relevanceScore > 100) {
    errors.push('Relevance score out of range')
  }

  // Check numeric metrics for NaN/Infinity/undefined.
  // INR metrics are formatted strings from formatInr (already safe), skip them.
  for (const m of candidate.supportingMetrics) {
    if (m.format === 'inr') continue
    const val = typeof m.value === 'number' ? m.value : parseFloat(String(m.value))
    if (!Number.isFinite(val)) {
      errors.push(`Metric '${m.label}' has non-finite value`)
    }
  }

  return { ...candidate, valid: errors.length === 0, validationErrors: errors }
}

// ===========================================================================
// Controlled variety: seeded weighted selection
// ===========================================================================

const FAMILY_PRIORITY: Record<string, number> = {
  'day-pattern': 1,
  'hour-pattern': 2,
  'product-performance': 3,
  'revenue-change': 4,
  'time-pattern': 5,
}

const STRENGTH_ORDER: Record<EvidenceStrength, number> = {
  strong: 3,
  moderate: 2,
  limited: 1,
}

/**
 * Score candidates for controlled variety selection. Higher = more likely
 * to be selected. Factors: evidence strength, relevance score, family diversity.
 */
function candidateScore(
  c: InsightCandidate,
  seed: number,
  usedFamilies: Set<string>,
  adjacentFamilies: Set<string>,
): number {
  const strengthScore = STRENGTH_ORDER[c.evidenceStrength] * 25
  const relevanceScore = c.relevanceScore * 0.4

  // Prefer families not yet used (diversity bonus)
  const diversityBonus = usedFamilies.has(c.family) ? -15 : 10

  // Penalize overlap with adjacent periods
  const adjacencyPenalty = adjacentFamilies.has(c.family) ? -8 : 0

  // Deterministic jitter from seed for controlled variety
  const rng = seededRandom(seed + c.family.charCodeAt(0))
  const jitter = rng() * 10

  return strengthScore + relevanceScore + diversityBonus + adjacencyPenalty + jitter
}

/**
 * Select exactly 3 insights from different analytical families where possible,
 * using deterministic period-aware weighted selection.
 */
export function selectTopInsights(
  ranked: InsightCandidate[],
  period: ResolvedPeriod,
  lines: ProcessedLine[],
): Insight[] {
  const valid = ranked.filter((c) => c.valid)
  if (valid.length === 0) return []

  const seed = deriveSeed(period, lines)
  const selected: Insight[] = []
  const usedFamilies = new Set<string>()
  const usedTypes = new Set<InsightType>()

  // Derive adjacent period families for overlap penalty
  const adjacentFamilies = new Set<string>()

  // Sort by score with controlled variety
  const scored = [...valid].map((c) => ({
    candidate: c,
    score: candidateScore(c, seed, usedFamilies, adjacentFamilies),
  }))
  scored.sort((a, b) => b.score - a.score)

  // First pass: pick top candidates from distinct families
  for (const { candidate } of scored) {
    if (selected.length >= 3) break
    if (usedTypes.has(candidate.type)) continue

    selected.push({
      id: deterministicId(
        candidate.type,
        `${candidate.title}|${candidate.supportingMetrics.map((m) => m.label + ':' + m.value).join('|')}`,
      ),
      type: candidate.type,
      title: candidate.title,
      explanation: candidate.explanation,
      supportingMetrics: candidate.supportingMetrics,
      reportingPeriod: period,
      evidence: candidate.evidence,
      evidenceStrength: candidate.evidenceStrength,
      relevanceScore: candidate.relevanceScore,
      limitation: candidate.limitation,
    })
    usedTypes.add(candidate.type)
    usedFamilies.add(candidate.family)
  }

  // Second pass: if we need more, fill from remaining valid candidates
  for (const { candidate } of scored) {
    if (selected.length >= 3) break
    if (usedTypes.has(candidate.type)) continue

    selected.push({
      id: deterministicId(
        candidate.type,
        `${candidate.title}|${candidate.supportingMetrics.map((m) => m.label + ':' + m.value).join('|')}`,
      ),
      type: candidate.type,
      title: candidate.title,
      explanation: candidate.explanation,
      supportingMetrics: candidate.supportingMetrics,
      reportingPeriod: period,
      evidence: candidate.evidence,
      evidenceStrength: candidate.evidenceStrength,
      relevanceScore: candidate.relevanceScore,
      limitation: candidate.limitation,
    })
    usedTypes.add(candidate.type)
  }

  return selected
}

// ===========================================================================
// Legacy rankCandidates (kept for backward compatibility)
// ===========================================================================

export function rankCandidates(candidates: InsightCandidate[]): InsightCandidate[] {
  const valid = candidates.filter((c) => c.valid)

  return valid.sort((a, b) => {
    const strengthDiff = STRENGTH_ORDER[b.evidenceStrength] - STRENGTH_ORDER[a.evidenceStrength]
    if (strengthDiff !== 0) return strengthDiff

    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore

    return (FAMILY_PRIORITY[a.family] ?? 99) - (FAMILY_PRIORITY[b.family] ?? 99)
  })
}

// ===========================================================================
// Main engine entry point
// ===========================================================================

export async function generateInsights(
  selection: ReportingPeriodSelection | null,
  allLines: ProcessedLine[],
): Promise<InsightsResult> {
  const validLines = allLines.filter((l) => l.isValid && !l.isDuplicate && l.date)

  if (!selection) {
    return {
      insights: [],
      recommendation: null,
      period: null,
      hasData: validLines.length > 0,
      error: null,
    }
  }

  const period = resolveSelection(selection, validLines)
  if (!period) {
    return {
      insights: [],
      recommendation: null,
      period: null,
      hasData: validLines.length > 0,
      error: 'Selected reporting period has no data.',
    }
  }

  if (validLines.length === 0) {
    return {
      insights: [],
      recommendation: null,
      period,
      hasData: false,
      error: 'No imported sales data available.',
    }
  }

  const candidates = await generateCandidates(validLines, period)
  const validated = candidates.map(validateCandidate)
  const ranked = rankCandidates(validated)
  const insights = selectTopInsights(ranked, period, validLines)
  const recommendation = generateRecommendations(insights, period)

  return {
    insights,
    recommendation,
    period,
    hasData: true,
    error: null,
  }
}