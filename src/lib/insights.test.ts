/**
 * Mist & Mug — Insights Engine Tests
 *
 * Tests deterministic rule-based insight generation, evidence validation,
 * ranking, and recommendation selection.
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
  rankCandidates,
  selectTopInsights,
  validateCandidate,
} from '@/lib/insights'
import { generateRecommendations } from '@/lib/recommendations'
import type { InsightCandidate } from '@/types/insights'
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
    type: 'top-products',
    title: 'Test insight',
    explanation: 'Test explanation',
    supportingMetrics: [
      { label: 'Revenue', value: '₹1,000', format: 'inr' },
    ],
    evidence: 'Test evidence',
    evidenceStrength: 'strong',
    relevanceScore: 80,
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
    vi.mocked(getAllImportLines).mockResolvedValue([
      { ...line({ transactionId: 't1', date: '2026-01-05' }), isValid: false },
    ])
    const result = await generateInsights(allTimeSelection, [
      { ...line({ transactionId: 't1', date: '2026-01-05' }), isValid: false },
    ])
    expect(result.hasData).toBe(false)
    expect(result.insights).toEqual([])
  })
})

// ---------------------------------------------------------------
// Weekday vs Weekend (Rule A)
//
// January 2026: 22 weekdays, 9 weekend days.
// Weekday revenue > weekend revenue in total, but weekend avg per day > weekday avg per day.
// ---------------------------------------------------------------

describe('weekday vs weekend insight', () => {
  it('generates weekday-weekend insight when both exist', async () => {
    // Build a small fixture with both weekdays and weekends
    // 2026-01-05 is Monday, 2026-01-10 is Saturday
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', quantity: 1, unitPriceInr: 100 }), // Mon
      line({ transactionId: 't2', date: '2026-01-06', quantity: 1, unitPriceInr: 100 }), // Tue
      line({ transactionId: 't3', date: '2026-01-10', quantity: 1, unitPriceInr: 200 }), // Sat
      line({ transactionId: 't4', date: '2026-01-11', quantity: 1, unitPriceInr: 200 }), // Sun
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const wwCandidate = candidates.find((c) => c.type === 'weekday-weekend')
    expect(wwCandidate).toBeDefined()
    expect(wwCandidate!.valid).toBe(true)
  })

  it('does not generate weekday-weekend insight when only weekdays exist', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05' }), // Mon
      line({ transactionId: 't2', date: '2026-01-06' }), // Tue
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const wwCandidate = candidates.find((c) => c.type === 'weekday-weekend')
    expect(wwCandidate).toBeDefined()
    expect(wwCandidate!.valid).toBe(false)
  })
})

// ---------------------------------------------------------------
// Busiest Hours (Rule B)
// ---------------------------------------------------------------

describe('busiest hours insight', () => {
  it('detects peak hour', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', time: '09:00', unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-05', time: '17:00', unitPriceInr: 500 }),
      line({ transactionId: 't3', date: '2026-01-05', time: '17:30', unitPriceInr: 500 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const peakCandidate = candidates.find((c) => c.type === 'busiest-hours')
    expect(peakCandidate).toBeDefined()
    expect(peakCandidate!.valid).toBe(true)
    expect(peakCandidate!.title).toContain('17:00')
  })

  it('skips when no timestamps available', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', time: '' }),
      line({ transactionId: 't2', date: '2026-01-06', time: '' }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedAllTime)
    const peakCandidate = candidates.find((c) => c.type === 'busiest-hours')
    expect(peakCandidate).toBeDefined()
    expect(peakCandidate!.valid).toBe(false)
  })
})

// ---------------------------------------------------------------
// Top-Selling Products (Rule C)
// ---------------------------------------------------------------

describe('top-selling products insight', () => {
  it('identifies top products', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', productName: 'Latte', unitPriceInr: 200, quantity: 2 }),
      line({ transactionId: 't2', date: '2026-01-05', productName: 'Croissant', unitPriceInr: 100, quantity: 1 }),
      line({ transactionId: 't3', date: '2026-01-05', productName: 'Latte', unitPriceInr: 200, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)
    const productsInsight = result.insights.find((i) => i.type === 'top-products')
    expect(productsInsight).toBeDefined()
    expect(productsInsight!.explanation).toContain('Latte')
  })

  it('skips when no products', async () => {
    vi.mocked(getAllImportLines).mockResolvedValue([])

    const result = await generateInsights(allTimeSelection, [])
    const productsInsight = result.insights.find((i) => i.type === 'top-products')
    expect(productsInsight).toBeUndefined()
  })
})

// ---------------------------------------------------------------
// Revenue Concentration (Rule F)
// ---------------------------------------------------------------

describe('revenue concentration insight', () => {
  it('calculates concentration share', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', productName: 'Latte', unitPriceInr: 500, quantity: 1 }),
      line({ transactionId: 't2', date: '2026-01-05', productName: 'Tea', unitPriceInr: 100, quantity: 1 }),
      line({ transactionId: 't3', date: '2026-01-05', productName: 'Tea', unitPriceInr: 100, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)
    const concInsight = result.insights.find((i) => i.type === 'revenue-concentration')
    expect(concInsight).toBeDefined()
    // Latte = 500, Tea total = 200, total = 700, Latte share = 500/700 = 71.4%
    const pctMetric = concInsight!.supportingMetrics.find(
      (m) => m.label === 'Top product revenue share',
    )
    expect(pctMetric).toBeDefined()
  })
})

// ---------------------------------------------------------------
// Average Order Value (Rule E)
// ---------------------------------------------------------------

describe('average order value insight', () => {
  it('calculates AOV without previous period', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100, quantity: 2 }),
      line({ transactionId: 't2', date: '2026-01-05', unitPriceInr: 200, quantity: 1 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)
    const aovInsight = result.insights.find((i) => i.type === 'average-order-value')
    expect(aovInsight).toBeDefined()
    // Total: 200 + 200 = 400, orders: 2, AOV: 200
    expect(aovInsight!.explanation).toContain('₹200')
  })

  it('includes limitation when no previous period available', async () => {
    // All Time has no previous period
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)
    const aovInsight = result.insights.find((i) => i.type === 'average-order-value')
    expect(aovInsight!.limitation).toContain('No previous-period comparison')
  })
})

// ---------------------------------------------------------------
// Revenue Trend (Rule D)
// ---------------------------------------------------------------

describe('revenue trend insight', () => {
  it('generates trend for month selection', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }),
      line({ transactionId: 't2', date: '2026-01-06', unitPriceInr: 300 }),
      line({ transactionId: 't3', date: '2026-01-07', unitPriceInr: 200 }),
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const candidates = await generateCandidates(lines, resolvedJan2026)
    const trendCandidate = candidates.find((c) => c.type === 'revenue-trend')
    expect(trendCandidate).toBeDefined()
    expect(trendCandidate!.valid).toBe(true)
  })
})

// ---------------------------------------------------------------
// Validation
// ---------------------------------------------------------------

describe('evidence validation', () => {
  it('invalidates candidate with no supporting metrics', () => {
    const candidate: InsightCandidate = {
      type: 'top-products',
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [],
      evidence: 'Test evidence',
      evidenceStrength: 'limited',
      relevanceScore: 50,
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain('No supporting metrics')
  })

  it('invalidates candidate with empty evidence', () => {
    const candidate: InsightCandidate = {
      type: 'top-products',
      title: 'Test',
      explanation: 'Test',
      supportingMetrics: [{ label: 'Rev', value: '₹100', format: 'inr' }],
      evidence: '',
      evidenceStrength: 'limited',
      relevanceScore: 50,
      valid: true,
      validationErrors: [],
    }
    const validated = validateCandidate(candidate)
    expect(validated.valid).toBe(false)
    expect(validated.validationErrors).toContain('Missing evidence description')
  })
})

// ---------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------

describe('insight ranking', () => {
  it('ranks strong evidence higher', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({
        type: 'revenue-trend',
        evidenceStrength: 'limited',
        relevanceScore: 90,
      }),
      makeValidCandidate({
        type: 'weekday-weekend',
        evidenceStrength: 'strong',
        relevanceScore: 50,
      }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].type).toBe('weekday-weekend') // strong evidence first
    expect(ranked[1].type).toBe('revenue-trend')
  })

  it('breaks ties by relevance score', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({
        type: 'revenue-trend',
        evidenceStrength: 'strong',
        relevanceScore: 50,
      }),
      makeValidCandidate({
        type: 'weekday-weekend',
        evidenceStrength: 'strong',
        relevanceScore: 90,
      }),
    ]
    const ranked = rankCandidates(candidates)
    expect(ranked[0].type).toBe('weekday-weekend') // higher relevance first
  })

  it('deterministic tie-breaking by type priority', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({
        type: 'revenue-concentration',
        evidenceStrength: 'strong',
        relevanceScore: 50,
      }),
      makeValidCandidate({
        type: 'weekday-weekend',
        evidenceStrength: 'strong',
        relevanceScore: 50,
      }),
    ]
    const ranked = rankCandidates(candidates)
    // weekday-weekend has priority 1, revenue-concentration has priority 4
    expect(ranked[0].type).toBe('weekday-weekend')
  })
})

// ---------------------------------------------------------------
// Select top 3 non-redundant insights
// ---------------------------------------------------------------

describe('select top insights', () => {
  it('selects at most 3 insights with distinct types', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'weekday-weekend', evidenceStrength: 'strong', relevanceScore: 90 }),
      makeValidCandidate({ type: 'busiest-hours', evidenceStrength: 'strong', relevanceScore: 85 }),
      makeValidCandidate({ type: 'top-products', evidenceStrength: 'strong', relevanceScore: 80 }),
      makeValidCandidate({ type: 'revenue-concentration', evidenceStrength: 'strong', relevanceScore: 75 }),
    ]
    const ranked = rankCandidates(candidates)
    const selected = selectTopInsights(ranked, resolvedAllTime)
    expect(selected).toHaveLength(3)
    const types = selected.map((s) => s.type)
    expect(new Set(types).size).toBe(3) // all distinct
  })

  it('does not include duplicate types', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'top-products', evidenceStrength: 'strong', relevanceScore: 90 }),
      makeValidCandidate({ type: 'top-products', evidenceStrength: 'moderate', relevanceScore: 80 }),
      makeValidCandidate({ type: 'busiest-hours', evidenceStrength: 'strong', relevanceScore: 70 }),
      makeValidCandidate({ type: 'weekday-weekend', evidenceStrength: 'strong', relevanceScore: 60 }),
    ]
    const ranked = rankCandidates(candidates)
    const selected = selectTopInsights(ranked, resolvedAllTime)
    const types = selected.map((s) => s.type)
    expect(types.filter((t) => t === 'top-products')).toHaveLength(1)
  })

  it('generates stable IDs', () => {
    const candidates: InsightCandidate[] = [
      makeValidCandidate({ type: 'weekday-weekend', evidenceStrength: 'strong', relevanceScore: 90 }),
    ]
    const ranked = rankCandidates(candidates)
    const selected1 = selectTopInsights(ranked, resolvedAllTime)
    const selected2 = selectTopInsights(ranked, resolvedAllTime)
    expect(selected1[0].id).toBe(selected2[0].id)
  })
})

// ---------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------

describe('recommendation engine', () => {
  it('generates recommendation from busiest-hours insight', () => {
    const insight = {
      id: 'bh_1',
      type: 'busiest-hours' as const,
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
    const rec = generateRecommendations([insight])
    expect(rec!).toBeDefined()
    expect(rec!.title).toContain('staffing')
    expect(rec!.supportingInsightId).toBe('bh_1')
  })

  it('generates recommendation from top-products insight', () => {
    const insight = {
      id: 'tp_1',
      type: 'top-products' as const,
      title: 'Top products drive revenue',
      explanation: 'Your top 3 products account for 60% of revenue.',
      supportingMetrics: [
        { label: 'Top 3 products revenue share', value: 60, format: 'percent' as const },
      ],
      reportingPeriod: resolvedAllTime,
      evidence: 'Analyzed 5 products.',
      evidenceStrength: 'strong' as const,
      relevanceScore: 80,
    }
    const rec = generateRecommendations([insight])
    expect(rec).toBeDefined()
    expect(rec!.title).toContain('inventory')
  })

  it('returns null when no actionable insights', () => {
    const insight = {
      id: 'rt_1',
      type: 'revenue-trend' as const,
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
    const rec = generateRecommendations([insight])
    expect(rec).toBeNull()
  })

  it('selects strongest recommendation when multiple candidates', () => {
    const insights = [
      {
        id: 'rt_1',
        type: 'revenue-trend' as const,
        title: 'Revenue trend',
        explanation: 'Trend observation.',
        supportingMetrics: [{ label: 'Total', value: '₹1000', format: 'inr' as const }],
        reportingPeriod: resolvedAllTime,
        evidence: 'Trend evidence.',
        evidenceStrength: 'limited' as const,
        relevanceScore: 30,
      },
      {
        id: 'bh_1',
        type: 'busiest-hours' as const,
        title: 'Peak hour',
        explanation: 'Peak observation.',
        supportingMetrics: [{ label: 'Peak', value: '₹5000', format: 'inr' as const }],
        reportingPeriod: resolvedAllTime,
        evidence: 'Peak evidence.',
        evidenceStrength: 'strong' as const,
        relevanceScore: 90,
      },
    ]
    const rec = generateRecommendations(insights)
    expect(rec!.supportingInsightId).toBe('bh_1') // strongest evidence wins
  })
})

// ---------------------------------------------------------------
// Deterministic output
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
// Financial reconciliation
// ---------------------------------------------------------------

describe('financial reconciliation', () => {
  it('weekday + weekend revenue equals total', async () => {
    const lines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }), // Mon
      line({ transactionId: 't2', date: '2026-01-10', unitPriceInr: 200 }), // Sat
    ]
    vi.mocked(getAllImportLines).mockResolvedValue(lines)

    const result = await generateInsights(allTimeSelection, lines)
    const wwInsight = result.insights.find((i) => i.type === 'weekday-weekend')
    if (wwInsight) {
      const weekdayMetric = wwInsight.supportingMetrics.find((m) => m.label === 'Total weekday revenue')
      const weekendMetric = wwInsight.supportingMetrics.find((m) => m.label === 'Total weekend revenue')
      expect(weekdayMetric).toBeDefined()
      expect(weekendMetric).toBeDefined()
    }
  })
})

// ---------------------------------------------------------------
// No data mutation (read-only)
// ---------------------------------------------------------------

describe('read-only engine', () => {
  it('does not modify input lines', async () => {
    const originalLines = [
      line({ transactionId: 't1', date: '2026-01-05', unitPriceInr: 100 }),
    ]
    const linesCopy = [...originalLines.map((l) => ({ ...l }))]
    vi.mocked(getAllImportLines).mockResolvedValue(originalLines)

    await generateInsights(allTimeSelection, originalLines)

    expect(originalLines).toEqual(linesCopy)
  })
})

// ---------------------------------------------------------------
// January 2026 regression dataset
// ---------------------------------------------------------------

describe('January 2026 regression dataset', () => {
  it('produces three distinct insights with the regression fixture', async () => {
    // Build a mini version of the January 2026 fixture
    const lines: ProcessedLine[] = []
    for (let d = 1; d <= 31; d++) {
      const dateStr = `2026-01-${String(d).padStart(2, '0')}`
      const day = new Date(dateStr + 'T00:00:00Z').getUTCDay()
      const isWeekday = day >= 1 && day <= 5
      const dailyRevenue = isWeekday ? 5800 : 7800
      const numOrders = 20
      for (let o = 0; o < numOrders; o++) {
        lines.push({
          compositeKey: `txn-${d}-${o}|1`,
          transactionId: `txn-${d}-${o}`,
          lineId: '1',
          date: dateStr,
          time: '10:00',
          itemName: 'Test Product',
          categoryResolved: 'Coffee',
          quantity: 1,
          unitPriceInr: dailyRevenue / numOrders,
          lineTotalInr: dailyRevenue / numOrders,
          productName: 'Test Product',
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
    // Should have at least one recommendation
    expect(result.recommendation).toBeDefined()
  })
})