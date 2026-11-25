/**
 * Mist & Mug — Insights Engine 2.0 Tests
 *
 * Tests deterministic rule-based insight generation with controlled variety,
 * evidence validation, ranking, and recommendation selection.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/db', () => ({
  db: { importLines: { toArray: vi.fn() } },
  getAllImportLines: vi.fn(),
  getAllProducts: vi.fn(),
}))

import { getAllImportLines, getAllProducts } from '@/db'
import type { ProcessedLine } from '@/types'
import {
  generateCandidates,
  generateInsights,
  selectTopInsights,
  validateCandidate,
  rankCandidates,
} from '@/lib/insights'
import { generateRecommendations } from '@/lib/recommendations'
import type { InsightCandidate, InsightType } from '@/types/insights'
import type { ReportingPeriodSelection } from '@/lib/reporting-periods'

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function line({
  transactionId,
  lineId = '1',
  date,
  time = '10:00',
  quantity = 1,
  unitPriceInr = 100,
  productName = 'Test Product',
}: {
  transactionId: string
  lineId?: string
  date: string
  time?: string
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
    time,
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

const allTimeSelection: ReportingPeriodSelection = { kind: 'all-time' }

const jan2026MonthSelection: ReportingPeriodSelection = {
  kind: 'month',
  year: 2026,
  month: 1,
}

const resolvedAllTime = {
  selection: allTimeSelection,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  label: 'All Time',
}

const resolvedJan2026 = {
  selection: jan2026MonthSelection,
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  label: 'Jan 2026',
}

function makeValidCandidate(
  overrides: Partial<InsightCandidate> = {},
): InsightCandidate {
  return {
    type: 'top-selling-products' as InsightType,
    title: 'Test insight',
    explanation: 'Test explanation',
    supportingMetrics: [
      { label: 'Revenue', value: '₹1,000', format: 'inr' },
    ],
    evidence: 'Test evidence',
    evidenceStrength: 'strong',
    relevanceScore: 80,
    family: 'product-performance',
    valid: true,
    validationErrors: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------
// beforeEach
// ---------------------------------------------------------------

beforeEach(() => {
  vi.mocked(getAllImportLines).mockResolvedValue([])
  vi.mocked(getAllProducts).mockResolvedValue([])
})

// ---------------------------------------------------------------
// Empty / no data
// ---------------------------------------------------------------

describe('no data', () => {
  it('returns empty insights with no selection', async () => {
    const result = await generateInsights(null, [])
    expect(result.insights).toEqual([])
    expect(result.recommendation).toBeNull()
    expect(result.period).toBeNull()
    expect(result.hasData).toBe(false)
    expect(result.error).toBeNull()
  })

  it('returns empty insights when no valid lines exist', async () => {
    const result = await generateInsights(allTimeSelection, [
      { ...line({ transactionId: 't1', date: '2026-01-05' }), isValid: false },
    ])
    expect(result.hasData).toBe(false)
    expect(result.insights).toEqual([])
  })
})

// ---------------------------------------------------------------
// Candidate generation — all 10 families
// ---------------------------------------------------------------

describe('candidate generation', () => {
  it('generates weekday-weekend candidate when both exist', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', quantity: 1, unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-06', quantity: 1, unitPriceInr: 100 }),
      line({ transactionId: 't3', date: '2026-01-10', quantity: 1, unitPriceInr: 200 }),
      line({ transactionId: 't4', date: '2026-01-11', quantity: 1, unitPriceInr: 200 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const ww = candidates.find((c) => c.type === 'weekday-weekend')
    expect(ww).toBeDefined()
    expect(ww!.valid).toBe(true)
  })

  it('generates peak sales hours candidate', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', time: '09:00', unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-05', time: '17:00', unitPriceInr: 500 }),
      line({ transactionId: 't3', date: '2026-01-05', time: '17:30', unitPriceInr: 500 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const peak = candidates.find((c) => c.type === 'peak-sales-hours')
    expect(peak).toBeDefined()
    expect(peak!.valid).toBe(true)
  })

  it('generates low-activity hours candidate', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', time: '08:00', unitPriceInr: 50 }),
      line({ transactionId: 't2', date: '2026-01-05', time: '12:00', unitPriceInr: 500 }),
      line({ transactionId: 't3', date: '2026-01-05', time: '17:00', unitPriceInr: 500 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const low = candidates.find((c) => c.type === 'low-activity-hours')
    expect(low).toBeDefined()
    expect(low!.valid).toBe(true)
  })

  it('generates top-selling products candidate', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', productName: 'Latte', unitPriceInr: 200, quantity: 2 }),
      line({ transactionId: 't2', date: '2026-01-05', productName: 'Croissant', unitPriceInr: 100, quantity: 1 }),
      line({ transactionId: 't3', date: '2026-01-05', productName: 'Latte', unitPriceInr: 200, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const tp = candidates.find((c) => c.type === 'top-selling-products')
    expect(tp).toBeDefined()
    expect(tp!.valid).toBe(true)
  })

  it('generates revenue concentration candidate', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', productName: 'Latte', unitPriceInr: 500, quantity: 1 }),
      line({ transactionId: 't2', date: '2026-01-05', productName: 'Tea', unitPriceInr: 100, quantity: 1 }),
      line({ transactionId: 't3', date: '2026-01-05', productName: 'Tea', unitPriceInr: 100, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const rc = candidates.find((c) => c.type === 'revenue-concentration')
    expect(rc).toBeDefined()
    expect(rc!.valid).toBe(true)
  })

  it('generates revenue trend candidate for month', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-06', unitPriceInr: 300 }),
      line({ transactionId: 't3', date: '2026-01-07', unitPriceInr: 200 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedJan2026)
    const trend = candidates.find((c) => c.type === 'revenue-trend')
    expect(trend).toBeDefined()
    expect(trend!.valid).toBe(true)
  })

  it('generates average order value candidate', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100, quantity: 2 }),
      line({ transactionId: 't2', date: '2026-01-05', unitPriceInr: 200, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const aov = candidates.find((c) => c.type === 'average-order-value')
    expect(aov).toBeDefined()
    expect(aov!.valid).toBe(true)
  })

  it('generates underperforming products candidate when data supports', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', productName: 'Popular', unitPriceInr: 500, quantity: 1 }),
      line({ transactionId: 't2', date: '2026-01-05', productName: 'Niche', unitPriceInr: 50, quantity: 1 }),
      line({ transactionId: 't3', date: '2026-01-05', productName: 'Niche', unitPriceInr: 50, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const up = candidates.find((c) => c.type === 'underperforming-products')
    expect(up).toBeDefined()
  })
})

// ---------------------------------------------------------------
// Evidence validation — no NaN/Infinity
// ---------------------------------------------------------------

describe('evidence validation', () => {
  it('invalidates candidate with no supporting metrics', () => {
    const candidate: InsightCandidate = {
      type: 'top-selling-products' as InsightType,
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [],
      evidence: 'Test evidence',
      evidenceStrength: 'limited',
      relevanceScore: 50,
      family: 'product-performance',
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain('No supporting metrics')
  })

  it('invalidates candidate with empty evidence', () => {
    const candidate: InsightCandidate = {
      type: 'top-selling-products' as InsightType,
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [{ label: 'Rev', value: '₹100', format: 'inr' }],
      evidence: '',
      evidenceStrength: 'limited',
      relevanceScore: 50,
      family: 'product-performance',
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain('Missing evidence description')
  })

  it('invalidates candidate with NaN metric value', () => {
    const candidate: InsightCandidate = {
      type: 'top-selling-products' as InsightType,
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [{ label: 'Bad Metric', value: NaN, format: 'number' as const }],
      evidence: 'Test evidence',
      evidenceStrength: 'limited',
      relevanceScore: 50,
      family: 'product-performance',
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain("Metric 'Bad Metric' has non-finite value")
  })

  it('rejects relevance score out of range', () => {
    const candidate: InsightCandidate = {
      type: 'top-selling-products' as InsightType,
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [{ label: 'Rev', value: '₹100', format: 'inr' }],
      evidence: 'Test evidence',
      evidenceStrength: 'limited',
      relevanceScore: 150,
      family: 'product-performance',
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain('Relevance score out of range')
  })
})

// ---------------------------------------------------------------
// Ranking — deterministic
// ---------------------------------------------------------------

describe('ranking', () => {
  it('ranks strong evidence higher', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({
        type: 'revenue-trend' as InsightType,
        evidenceStrength: 'limited',
        relevanceScore: 90,
        family: 'time-pattern',
      }),
      makeValidCandidate({
        type: 'weekday-weekend' as InsightType,
        evidenceStrength: 'strong',
        relevanceScore: 50,
        family: 'day-pattern',
      }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].type).toBe('weekday-weekend')
    expect(ranked[1].type).toBe('revenue-trend')
  })

  it('breaks ties by relevance score', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({
        type: 'revenue-trend' as InsightType,
        evidenceStrength: 'strong',
        relevanceScore: 50,
        family: 'time-pattern',
      }),
      makeValidCandidate({
        type: 'weekday-weekend' as InsightType,
        evidenceStrength: 'strong',
        relevanceScore: 90,
        family: 'day-pattern',
      }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].type).toBe('weekday-weekend')
  })
})

// ---------------------------------------------------------------
// Select top insights — exactly 3, distinct families
// ---------------------------------------------------------------

describe('select top insights', () => {
  it('selects at most 3 insights with distinct types', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'weekday-weekend' as InsightType, evidenceStrength: 'strong', relevanceScore: 90, family: 'day-pattern' }),
      makeValidCandidate({ type: 'peak-sales-hours' as InsightType, evidenceStrength: 'strong', relevanceScore: 85, family: 'hour-pattern' }),
      makeValidCandidate({ type: 'top-selling-products' as InsightType, evidenceStrength: 'strong', relevanceScore: 80, family: 'product-performance' }),
      makeValidCandidate({ type: 'revenue-concentration' as InsightType, evidenceStrength: 'strong', relevanceScore: 75, family: 'product-performance' }),
    ]
    const ranked = rankCandidates(candidates)
    const selected = selectTopInsights(ranked, resolvedAllTime, [])
    expect(selected).toHaveLength(3)
    const types = selected.map((s) => s.type)
    expect(new Set(types).size).toBe(3)
  })

  it('does not include duplicate types', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'top-selling-products' as InsightType, evidenceStrength: 'strong', relevanceScore: 90, family: 'product-performance' }),
      makeValidCandidate({ type: 'top-selling-products' as InsightType, evidenceStrength: 'moderate', relevanceScore: 80, family: 'product-performance' }),
      makeValidCandidate({ type: 'peak-sales-hours' as InsightType, evidenceStrength: 'strong', relevanceScore: 70, family: 'hour-pattern' }),
      makeValidCandidate({ type: 'weekday-weekend' as InsightType, evidenceStrength: 'strong', relevanceScore: 60, family: 'day-pattern' }),
    ]
    const ranked = rankCandidates(candidates)
    const selected = selectTopInsights(ranked, resolvedAllTime, [])
    const types = selected.map((s) => s.type)
    expect(types.filter((t) => t === 'top-selling-products')).toHaveLength(1)
  })

  it('generates stable IDs for same input', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'weekday-weekend' as InsightType, evidenceStrength: 'strong', relevanceScore: 90, family: 'day-pattern' }),
    ]
    const ranked = rankCandidates(candidates)
    const selected1 = selectTopInsights(ranked, resolvedAllTime, [])
    const selected2 = selectTopInsights(ranked, resolvedAllTime, [])
    expect(selected1[0].id).toBe(selected2[0].id)
  })
})

// ---------------------------------------------------------------
// Recommendations — exactly one, period-aware
// ---------------------------------------------------------------

describe('recommendation engine', () => {
  it('generates recommendation from peak-sales-hours insight', () => {
    const insight = {
      id: 'psh_1',
      type: 'peak-sales-hours' as InsightType,
      title: 'Peak hour: 17:00–18:00',
      explanation: '5 PM–6 PM generated the highest recorded hourly revenue.',
      supportingMetrics: [
        { label: 'Peak hourly revenue', value: '₹5,000', format: 'inr' as const },
        { label: 'Peak hour orders', value: 25, format: 'count' as const },
      ],
      reportingPeriod: resolvedAllTime,
      evidence: 'Analyzed 10 hours with 100 unique orders.',
      evidenceStrength: 'strong' as const,
      relevanceScore: 85,
    }
    const rec = generateRecommendations([insight], resolvedAllTime)
    expect(rec).toBeDefined()
    expect(rec!.supportingInsightId).toBe('psh_1')
  })

  it('generates recommendation from revenue-decline insight', () => {
    const insight = {
      id: 'rd_1',
      type: 'revenue-decline' as InsightType,
      title: 'Revenue is declining',
      explanation: 'Revenue decreased by 10% compared to the previous period.',
      supportingMetrics: [
        { label: 'Revenue decline vs previous period', value: 10, format: 'percent' as const },
      ],
      reportingPeriod: resolvedAllTime,
      evidence: 'Compared current period with previous period.',
      evidenceStrength: 'strong' as const,
      relevanceScore: 80,
    }
    const rec = generateRecommendations([insight], resolvedAllTime)
    expect(rec).toBeDefined()
    expect(rec!.title).toContain('Investigate')
  })

  it('returns null when no actionable insights', () => {
    const insight = {
      id: 'rt_1',
      type: 'revenue-trend' as InsightType,
      title: 'Revenue trend',
      explanation: 'Revenue varies across days.',
      supportingMetrics: [
        { label: 'Total revenue', value: '₹1,000', format: 'inr' as const },
      ],
      reportingPeriod: resolvedAllTime,
      evidence: 'Analyzed 7 days.',
      evidenceStrength: 'moderate' as const,
      relevanceScore: 40,
    }
    const rec = generateRecommendations([insight], resolvedAllTime)
    expect(rec).toBeNull()
  })

  it('selects strongest recommendation when multiple candidates', () => {
    const insights = [
      {
        id: 'rt_1',
        type: 'revenue-trend' as InsightType,
        title: 'Revenue trend',
        explanation: 'Trend observation.',
        supportingMetrics: [{ label: 'Total', value: '₹1000', format: 'inr' as const }],
        reportingPeriod: resolvedAllTime,
        evidence: 'Trend evidence.',
        evidenceStrength: 'limited' as const,
        relevanceScore: 30,
      },
      {
        id: 'psh_1',
        type: 'peak-sales-hours' as InsightType,
        title: 'Peak hour',
        explanation: 'Peak observation.',
        supportingMetrics: [{ label: 'Peak', value: '₹5000', format: 'inr' as const }],
        reportingPeriod: resolvedAllTime,
        evidence: 'Peak evidence.',
        evidenceStrength: 'strong' as const,
        relevanceScore: 90,
      },
    ]
    const rec = generateRecommendations(insights, resolvedAllTime)
    expect(rec!.supportingInsightId).toBe('psh_1')
  })
})

// ---------------------------------------------------------------
// Deterministic output — same period + same data = same result
// ---------------------------------------------------------------

describe('deterministic output', () => {
  it('produces identical results for identical data', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-06', unitPriceInr: 200 }),
      line({ transactionId: 't3', date: '2026-01-10', unitPriceInr: 300 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result1 = await generateInsights(allTimeSelection, lines)
    const result2 = await generateInsights(allTimeSelection, lines)
    expect(result1.insights.length).toBe(result2.insights.length)
    expect(result1.insights.map((i) => i.id)).toEqual(result2.insights.map((i) => i.id))
  })
})

// ---------------------------------------------------------------
// Metric formatting — no NaN/Infinity, correct precision
// ---------------------------------------------------------------

describe('metric formatting', () => {
  it('generated insights contain no NaN or Infinity metric values', async () => {
    const lines: ProcessedLine[] = []
    const products = ['Latte', 'Cappuccino', 'Croissant', 'Muffin', 'Tea']
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const day = new Date(dateStr + 'T00:00:00Z').getUTCDay()
      const isWeekday = day >= 1 && day <= 5
      const dailyRevenue = isWeekday ? 5800 : 7800
      const numOrders = 20
      for (let o = 0; o < numOrders; o++) {
        const product = products[o % products.length]
        const hour = 8 + (o % 10)
        lines.push({
          compositeKey: `txn-${d}-${o}|1`,
          transactionId: `txn-${d}-${o}`,
          lineId: '1',
          date: dateStr,
          time: `${String(hour).padStart(2, '0')}:00`,
          itemName: product,
          categoryResolved: 'Coffee',
          quantity: 1,
          unitPriceInr: dailyRevenue / numOrders,
          lineTotalInr: dailyRevenue / numOrders,
          productName: product,
          validationIssues: [],
          isValid: true,
          isDuplicate: false,
        } as ProcessedLine)
      }
    }

    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    const result = await generateInsights(jan2026MonthSelection, lines)

    for (const insight of result.insights) {
      for (const m of insight.supportingMetrics) {
        if (m.format === 'inr') continue // already a formatted string
        const val = typeof m.value === 'number' ? m.value : parseFloat(String(m.value))
        expect(Number.isFinite(val)).toBe(true)
        expect(val).not.toBeNaN()
      }
    }
  })

  it('percentage metrics are rounded to one decimal place', async () => {
    const lines: ProcessedLine[] = []
    const products = ['Latte', 'Cappuccino', 'Croissant', 'Muffin', 'Tea']
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const isWeekday = new Date(dateStr + 'T00:00:00Z').getUTCDay() >= 1 && new Date(dateStr + 'T00:00:00Z').getUTCDay() <= 5
      const dailyRevenue = isWeekday ? 5800 : 7800
      const numOrders = 20
      for (let o = 0; o < numOrders; o++) {
        lines.push({
          compositeKey: `txn-${d}-${o}|1`,
          transactionId: `txn-${d}-${o}`,
          lineId: '1',
          date: dateStr,
          time: `${String(8 + (o % 10)).padStart(2, '0')}:00`,
          itemName: products[o % products.length],
          categoryResolved: 'Coffee',
          quantity: 1,
          unitPriceInr: dailyRevenue / numOrders,
          lineTotalInr: dailyRevenue / numOrders,
          productName: products[o % products.length],
          validationIssues: [],
          isValid: true,
          isDuplicate: false,
        } as ProcessedLine)
      }
    }

    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    const result = await generateInsights(jan2026MonthSelection, lines)

    for (const insight of result.insights) {
      for (const m of insight.supportingMetrics) {
        if (m.format !== 'percent') continue
        const val = typeof m.value === 'number' ? m.value : parseFloat(String(m.value))
        // One decimal place: val * 10 should be an integer
        expect(Math.round(val * 10) / 10).toBe(val)
      }
    }
  })

  it('count metrics are integers', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', quantity: 1, unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-06', quantity: 1, unitPriceInr: 200 }),
      line({ transactionId: 't3', date: '2026-01-10', quantity: 1, unitPriceInr: 300 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)

    for (const insight of result.insights) {
      for (const m of insight.supportingMetrics) {
        if (m.format !== 'count') continue
        const val = typeof m.value === 'number' ? m.value : parseFloat(String(m.value))
        expect(Number.isInteger(val)).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------
// January 2026 regression dataset
// ---------------------------------------------------------------

describe('January 2026 regression dataset', () => {
  it('produces insights with the regression fixture', async () => {
    const lines: ProcessedLine[] = []
    const products = ['Latte', 'Cappuccino', 'Croissant', 'Muffin', 'Tea']
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const day = new Date(dateStr + 'T00:00:00Z').getUTCDay()
      const isWeekday = day >= 1 && day <= 5
      const dailyRevenue = isWeekday ? 5800 : 7800
      const numOrders = 20
      for (let o = 0; o < numOrders; o++) {
        const product = products[o % products.length]
        const hour = 8 + (o % 10) // hours 8-17
        lines.push({
          compositeKey: `txn-${d}-${o}|1`,
          transactionId: `txn-${d}-${o}`,
          lineId: '1',
          date: dateStr,
          time: `${String(hour).padStart(2, '0')}:00`,
          itemName: product,
          categoryResolved: 'Coffee',
          quantity: 1,
          unitPriceInr: dailyRevenue / numOrders,
          lineTotalInr: dailyRevenue / numOrders,
          productName: product,
          validationIssues: [],
          isValid: true,
          isDuplicate: false,
        } as ProcessedLine)
      }
    }

    vi.mocked(getAllImportLines).mockResolvedValue(lines)
    const result = await generateInsights(jan2026MonthSelection, lines)

    expect(result.hasData).toBe(true)
    expect(result.error).toBeNull()
    expect(result.insights.length).toBeGreaterThan(0)
    expect(result.insights.length).toBeLessThanOrEqual(3)
  })
})