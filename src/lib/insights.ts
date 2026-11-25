/**
 * Mist & Mug — Rule-Based Insights Engine
 *
 * Pure, deterministic functions that analyze imported sales data and
 * generate evidence-backed business insights.
 *
 * Separation of concerns:
 *   Data retrieval   → fetchValidLines, filterByDateRange
 *   Statistical calculations → compute* helpers
 *   Candidate generation   → generateCandidates
 *   Evidence validation    → validateCandidate
 *   Candidate ranking      → rankCandidates
 *   Recommendation selection → selectRecommendation
 *   UI presentation        → handled by the Insights page
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
// Internal helpers
// ===========================================================================

function hourRangeLabel(hour: number): string {
  const start = String(hour).padStart(2, '0')
  const end = String((hour + 1) % 24).padStart(2, '0')
  return `${start}:00–${end}:00`
}

function metricInr(label: string, value: number): InsightMetric {
  return { label, value: formatInr(value), format: 'inr' }
}

function metricPercent(label: string, value: number): InsightMetric {
  return { label, value, format: 'percent' as const }
}

function metricCount(label: string, value: number): InsightMetric {
  return { label, value, format: 'count' as const }
}

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

function deterministicId(prefix: string, data: string): string {
  // Simple deterministic hash for stable insight IDs
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`
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
// Rule B — Busiest Hours
// ===========================================================================

async function candidateBusiestHours(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const hourly = await computeHourlyData(period.startDate, period.endDate)

  if (hourly.length === 0) {
    return {
      type: 'busiest-hours',
      title: 'Busiest Hours',
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
    type: 'busiest-hours',
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
// Rule C — Top-Selling Products
// ===========================================================================

async function candidateTopProducts(
  _lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const products = await computeTopProducts(period.startDate, period.endDate, 5)

  if (products.length === 0) {
    return {
      type: 'top-products',
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
    type: 'top-products',
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
// Rule D — Revenue Trends
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
// Rule E — Average Order Value
// ===========================================================================

async function candidateAverageOrderValue(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate> {
  const current = await computeDashboardMetrics(period.startDate, period.endDate)

  if (current.orderCount === 0) {
    return {
      type: 'average-order-value',
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
// Candidate generation — all rules
// ===========================================================================

export async function generateCandidates(
  lines: ProcessedLine[],
  period: ResolvedPeriod,
): Promise<InsightCandidate[]> {
  return Promise.all([
    candidateWeekdayWeekend(lines, period),
    candidateBusiestHours(lines, period),
    candidateTopProducts(lines, period),
    candidateRevenueTrend(lines, period),
    candidateAverageOrderValue(lines, period),
    candidateRevenueConcentration(lines, period),
  ])
}

// ===========================================================================
// Evidence validation
// ===========================================================================

export function validateCandidate(candidate: InsightCandidate): InsightCandidate {
  const errors: string[] = [...candidate.validationErrors]

  // Reporting period must be valid
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

  return { ...candidate, valid: errors.length === 0, validationErrors: errors }
}

// ===========================================================================
// Candidate ranking
// ===========================================================================

/**
 * Rank candidates by: business relevance, effect magnitude, data coverage,
 * evidence reliability, actionability, distinctiveness.
 * Deterministic tie-breaking by insight type order.
 */

const TYPE_PRIORITY: Record<InsightType, number> = {
  'weekday-weekend': 1,
  'busiest-hours': 2,
  'top-products': 3,
  'revenue-concentration': 4,
  'average-order-value': 5,
  'revenue-trend': 6,
}

export function rankCandidates(candidates: InsightCandidate[]): InsightCandidate[] {
  const valid = candidates.filter((c) => c.valid)

  return valid.sort((a, b) => {
    // 1. Evidence strength: strong > moderate > limited
    const strengthOrder: Record<EvidenceStrength, number> = { strong: 3, moderate: 2, limited: 1 }
    const strengthDiff = strengthOrder[b.evidenceStrength] - strengthOrder[a.evidenceStrength]
    if (strengthDiff !== 0) return strengthDiff

    // 2. Relevance score
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore

    // 3. Deterministic tie-breaking by type priority
    return (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99)
  })
}

// ===========================================================================
// Select top 3 non-redundant insights
// ===========================================================================

export function selectTopInsights(ranked: InsightCandidate[], period: ResolvedPeriod): Insight[] {
  const selected: Insight[] = []
  const usedTypes = new Set<InsightType>()

  for (const candidate of ranked) {
    if (selected.length >= 3) break
    if (usedTypes.has(candidate.type)) continue

    selected.push({
      id: deterministicId(candidate.type, `${candidate.title}|${candidate.supportingMetrics.map(m => m.label + ':' + m.value).join('|')}`),
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
  const insights = selectTopInsights(ranked, period)
  const recommendation = generateRecommendations(insights)

  return {
    insights,
    recommendation,
    period,
    hasData: true,
    error: null,
  }
}