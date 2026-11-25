/**
 * Mist & Mug — Business Insights Page
 *
 * Rule-based business insights and recommendations computed from imported
 * sales data, filtered by a hierarchical reporting period chosen through
 * the shared ReportingPeriodNavigator.
 *
 * Selection and application are separate states: insights only change after
 * the user clicks Apply. All available periods are derived from actual
 * imported transaction dates, never from the system clock.
 *
 * The engine is read-only: it never modifies historical transactions,
 * product catalogue, upload batches, or IndexedDB schema.
 */

import * as React from 'react'
import { ReportingPeriodNavigator } from '@/components/common/ReportingPeriodNavigator'
import { generateInsights } from '@/lib/insights'
import { getAllImportLines } from '@/db'
import { resolveSelection, type ResolvedPeriod } from '@/lib/reporting-periods'
import { useReportingPeriodState } from '@/lib/useReportingPeriodState'
import type { ProcessedLine } from '@/types'
import { onDataChanged } from '@/lib/events'
import { formatInr } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { Lightbulb, TrendingUp, Clock, Package, ShoppingCart, AlertCircle } from 'lucide-react'

const INSIGHTS_STORAGE_KEY = 'mistmug:insights:appliedPeriod'

// Contextual icons per insight type
const INSIGHT_ICONS: Record<string, typeof Lightbulb> = {
  'weekday-weekend': TrendingUp,
  'busiest-hours': Clock,
  'top-products': Package,
  'revenue-concentration': ShoppingCart,
  'average-order-value': ShoppingCart,
  'revenue-trend': TrendingUp,
}

function formatMetric(metric: { label: string; value: string | number; format?: string }): string {
  // Defensive: never render NaN, Infinity, null, or undefined.
  if (metric.value === null || metric.value === undefined) return 'N/A'
  if (typeof metric.value === 'number' && !Number.isFinite(metric.value)) return 'N/A'

  if (metric.format === 'inr') {
    // metricInr already returns a pre-formatted currency string (e.g. "₹5,800").
    // Do not re-parse it — parseFloat("₹5,800") would produce NaN.
    if (typeof metric.value === 'string') return metric.value
    return formatInr(metric.value)
  }
  if (metric.format === 'percent') {
    const v = typeof metric.value === 'number' ? metric.value : parseFloat(String(metric.value))
    if (!Number.isFinite(v)) return 'N/A'
    return `${v.toFixed(1)}%`
  }
  // count / number: integer, no decimals
  return String(metric.value)
}

function EvidenceStrengthBadge({ strength }: { strength: string }) {
  const variants: Record<string, string> = {
    strong: 'bg-sage/15 text-forest border border-sage/30',
    moderate: 'bg-wood/15 text-wood border border-wood/30',
    limited: 'bg-rain/15 text-rain border border-rain/30',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[strength] || variants.limited}`}>
      {strength === 'strong' ? 'Strong evidence' : strength === 'moderate' ? 'Moderate evidence' : 'Limited evidence'}
    </span>
  )
}

function InsightPlaceholder() {
  return (
    <div className="card-premium p-6 flex flex-col h-full">
      <div className="w-10 h-10 rounded-lg bg-forest/10 flex items-center justify-center text-forest mb-4">
        <Lightbulb className="w-5 h-5" />
      </div>
      <h3 className="font-serif text-lg text-ink mb-2">Insight placeholder</h3>
      <p className="text-rain/60 text-sm flex-1">
        Select a reporting period to generate insights.
      </p>
      <div className="mt-4">
        <EvidenceStrengthBadge strength="limited" />
      </div>
    </div>
  )
}

function RecommendationPlaceholder() {
  return (
    <div className="card-premium p-6">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center text-coffee shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg text-ink mb-1">Recommended Action</h3>
          <p className="text-rain/60 text-sm">
            Recommendations will appear after analyzing your sales data.
          </p>
        </div>
      </div>
    </div>
  )
}

function NoDataState() {
  return (
    <div className="card-premium p-8 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-terracotta/15 flex items-center justify-center text-terracotta mb-4">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="font-serif text-lg text-ink mb-2">No sales data imported yet</h3>
      <p className="text-rain/60 text-sm mb-6 max-w-sm">
        Import sales transactions to generate business insights and recommendations.
      </p>
      <Button
        variant="brand-gold"
        asChild
        size="sm"
        className="flex items-center justify-center gap-2"
      >
        <Link to="/upload">
          <ShoppingCart className="w-4 h-4" />
          Upload Data
        </Link>
      </Button>
    </div>
  )
}

function InsightCard({ insight }: { insight: any }) {
  const Icon = INSIGHT_ICONS[insight.type] || Lightbulb

  return (
    <div className="card-premium p-5 flex flex-col h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-forest/10 flex items-center justify-center text-forest shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <EvidenceStrengthBadge strength={insight.evidenceStrength} />
      </div>
      <h3 className="font-serif text-base text-ink mb-2 leading-snug">{insight.title}</h3>
      <p className="text-rain/70 text-sm mb-4 flex-1 leading-relaxed">
        {insight.explanation}
      </p>
      <div className="mt-auto pt-4 border-t border-border">
        {insight.supportingMetrics.map((m: any, i: number) => (
          <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-rain/50">{m.label}</span>
            <span className="font-serif text-ink font-medium">{formatMetric(m)}</span>
          </div>
        ))}
        {insight.limitation && (
          <div className="mt-3 p-3 rounded-lg bg-rain/10 border border-rain/20">
            <p className="text-[11px] text-rain/60 font-medium uppercase tracking-wider mb-1">
              Limitation
            </p>
            <p className="text-sm text-rain/70 leading-relaxed">{insight.limitation}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RecommendedActionCard({ recommendation }: { recommendation: any }) {
  return (
    <div className="card-premium p-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center text-coffee shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-serif text-lg text-ink mb-1">Recommended Action</h3>
          <p className="text-rain/60 text-sm mb-4 leading-relaxed">
            {recommendation.recommendedAction}
          </p>
          <div className="space-y-3">
            <div className="p-3 rounded-lg border border-border bg-paper/50">
              <p className="text-[11px] text-rain font-medium uppercase tracking-wider mb-1">
                Supporting evidence
              </p>
              <p className="text-sm text-ink leading-relaxed">{recommendation.evidenceSummary}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-paper/50">
              <p className="text-[11px] text-rain font-medium uppercase tracking-wider mb-1">
                Practical next step
              </p>
              <p className="text-sm text-ink leading-relaxed">{recommendation.practicalNextStep}</p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-paper/50">
              <p className="text-[11px] text-rain font-medium uppercase tracking-wider mb-1">
                Advisory note
              </p>
              <p className="text-sm text-rain/70 leading-relaxed">
                {recommendation.limitationOrAssumption}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Insights() {
  const [lines, setLines] = React.useState<ProcessedLine[]>([])
  const [initialLoading, setInitialLoading] = React.useState(true)

  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey: INSIGHTS_STORAGE_KEY,
    lines,
  })

  const [computing, setComputing] = React.useState(false)
  const [result, setResult] = React.useState<{
    insights: any[]
    recommendation: any | null
    period: ResolvedPeriod | null
    hasData: boolean
    error: string | null
  } | null>(null)

  const [periodOpen, setPeriodOpen] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [range, setRange] = React.useState<ResolvedPeriod | null>(null)

  // Monotonically increasing id to ignore superseded async results
  const insightsRequestId = React.useRef(0)

  const hasAnyData = lines.some((l) => l.isValid && !l.isDuplicate && l.date)
  const isLoading = initialLoading || computing
  const noPeriod = !applied
  const hasError = error != null

  // Resolve the applied selection to an inclusive date range
  React.useEffect(() => {
    let resolved: ResolvedPeriod | null = null
    if (applied) {
      resolved = resolveSelection(applied, lines) ?? null
    }
    setRange(resolved)
  }, [applied, lines])

  async function loadData() {
    setInitialLoading(true)
    setError(null)
    try {
      const all = await getAllImportLines()
      setLines(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales data')
    } finally {
      setInitialLoading(false)
    }
  }

  React.useEffect(() => {
    loadData()
  }, [])

  // Recompute insights when data or applied range changes
  React.useEffect(() => {
    if (!range) {
      insightsRequestId.current += 1
      setResult(null)
      setError(null)
      return
    }
    const requestId = ++insightsRequestId.current
    loadInsights(requestId)
  }, [range])

  // Recompute when data changes (e.g. after upload deletion)
  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadData()
      if (range) loadInsights(++insightsRequestId.current)
    })
    return unsubscribe
  }, [range])

  async function loadInsights(requestId: number) {
    if (requestId !== insightsRequestId.current) return
    setComputing(true)
    setError(null)
    try {
      const res = await generateInsights(range!.selection, lines)
      if (requestId !== insightsRequestId.current) return
      setResult(res)
    } catch (err) {
      if (requestId !== insightsRequestId.current) return
      setError(err instanceof Error ? err.message : 'Failed to generate insights')
    } finally {
      if (requestId !== insightsRequestId.current) return
      setComputing(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center w-full gap-6 mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Business Insights</h2>
          <p className="section-subtitle">
            Discover meaningful patterns and opportunities in your café's sales.
          </p>
        </div>
        <div className="w-full shrink-0 sm:w-[48%]">
          <Button
            variant="brand-gold"
            size="sm"
            className="flex w-full h-[44px] items-center justify-center rounded-full px-4 whitespace-nowrap"
            onClick={() => setPeriodOpen(true)}
            aria-expanded={periodOpen}
          >
            Select Reporting Period
          </Button>
        </div>
      </div>

      {/* Full-width reporting-period information bar */}
      <div className="bg-cream border border-border rounded-xl p-4 md:p-5">
        {range ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-rain font-medium uppercase tracking-wider">
                Analyzing:
              </span>
              <span className="font-serif text-ink">{range.label}</span>
              {range.startDate && range.endDate && (
                <span className="text-[10px] text-rain/60">
                  {range.startDate} → {range.endDate}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  clearApplied()
                  setPeriodOpen(false)
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-rain/70 text-center sm:text-left">
            Select a reporting period to begin analysis.
          </p>
        )}
      </div>

      {/* Hierarchical reporting-period navigator */}
      {periodOpen && (
        <ReportingPeriodNavigator
          lines={lines}
          applied={applied}
          onApply={setApplied}
          open={periodOpen}
          onOpenChange={setPeriodOpen}
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="p-3 rounded bg-[#f5dede]/30 border border-[#8a2f1d]/30 text-sm text-[#8a2f1d] flex items-center gap-2">
          {error}
          <Button variant="outline" size="sm" onClick={loadData}>
            Retry
          </Button>
        </div>
      )}

      {/* No imported data */}
      {!hasAnyData && !hasError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-terracotta/15 border border-terracotta/30 text-terracotta text-sm font-medium">
          No sales data imported yet.
          <Button variant="outline" size="sm" asChild>
            <Link to="/upload">Upload Data</Link>
          </Button>
        </div>
      )}

      {/* Empty selected period */}
      {range && hasAnyData && result === null && !hasError && !isLoading && (
        <div className="p-3 rounded bg-terracotta/15 border border-terracotta/30 text-sm text-terracotta">
          No transactions found for the selected period.
        </div>
      )}

      {/* Insights content area */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-64" />
          ))}
          <div className="lg:col-span-3 skeleton h-64" />
        </div>
      ) : noPeriod || result === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <InsightPlaceholder />
          <InsightPlaceholder />
          <InsightPlaceholder />
          <div className="lg:col-span-3">
            <RecommendationPlaceholder />
          </div>
        </div>
      ) : !hasAnyData ? (
        <NoDataState />
      ) : result.insights.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-3 card-premium p-6 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-full bg-forest/10 flex items-center justify-center text-forest mb-4">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-lg text-ink mb-2">No insights available</h3>
            <p className="text-rain/60 text-sm max-w-sm text-center">
              There isn't enough data in the selected period to generate
              reliable insights. Try a different reporting period or import
              more sales transactions.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {result.insights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>

          {/* Recommended Action section */}
          {result.recommendation && (
            <section className="card-premium p-6 lg:col-span-3">
              <RecommendedActionCard recommendation={result.recommendation} />
            </section>
          )}
          {!result.recommendation && (
            <section className="lg:col-span-3">
              <RecommendationPlaceholder />
            </section>
          )}
        </>
      )}
    </div>
  )
}