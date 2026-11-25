/**
 * Mist & Mug — Recommendation Engine 2.0
 *
 * Generates actionable business recommendations from selected insights.
 * Uses controlled, period-aware weighted selection among similarly strong
 * candidates to produce varied recommendations across reporting periods.
 *
 * Each recommendation derives from a specific insight and remains advisory
 * — it never automatically modifies product settings, prices, inventory,
 * or sales records.
 *
 * Read-only: never writes to IndexedDB or modifies any data.
 */

import type { Insight } from '@/types/insights'
import type { Recommendation } from '@/types/insights'
import type { ResolvedPeriod } from '@/lib/reporting-periods'

function deterministicId(prefix: string, data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`
}

function deriveSeed(period: ResolvedPeriod): number {
  let hash = 0
  const data = `${period.label}|${period.startDate}|${period.endDate}`
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): () => number {
  let state = seed | 0
  if (state === 0) state = 1
  return () => {
    state = (state * 1664525 + 1013904223) | 0
    return (state >>> 0) / 0xffffffff
  }
}

const STRENGTH_ORDER: Record<'strong' | 'moderate' | 'limited', number> = {
  strong: 3,
  moderate: 2,
  limited: 1,
}

const FAMILY_ACTION_TITLES: Record<string, Array<{ title: string; action: string; rationale: string; nextStep: string; limitation: string }>> = {
  'peak-sales-hours': [
    {
      title: 'Review staffing during the sales peak',
      action: 'Review staffing and service capacity during the peak sales hour.',
      rationale: 'Recorded revenue is concentrated during the peak hour. Reviewing service times and staffing coverage may help determine whether adjustments are needed.',
      nextStep: 'Compare scheduled staff shifts against the peak-hour sales pattern and consider aligning coverage with demand.',
      limitation: 'Sales data alone cannot confirm staffing is insufficient — operational review needed.',
    },
    {
      title: 'Focus promotions on peak-hour demand',
      action: 'Consider targeted promotions during the peak sales window to maximize throughput.',
      rationale: 'The peak hour already generates the highest revenue. Promotions could further increase order volume during this high-demand window.',
      nextStep: 'Design a time-bound offer for the peak hour and measure its impact on order value and throughput.',
      limitation: 'Do not claim the promotion will increase profit without margin and cost data.',
    },
  ],
  'low-activity-hours': [
    {
      title: 'Evaluate promotion during lower-activity period',
      action: 'Evaluate a small, measurable promotion during the lower-activity period.',
      rationale: 'Recorded revenue is consistently lower during one period. A targeted promotion may help balance demand across the day.',
      nextStep: 'Design a time-bound promotion for the lower-activity hours and measure its impact before committing to a recurring offer.',
      limitation: 'Do not claim the promotion will increase profit without margin and cost data.',
    },
    {
      title: 'Review operating hours during low-activity windows',
      action: 'Review whether operating hours align with recorded demand patterns.',
      rationale: 'Revenue is consistently lower during specific hours. Adjusting opening or closing times may better match demand.',
      nextStep: 'Compare staffing and utility costs against revenue during low-activity hours to assess whether adjusted hours are warranted.',
      limitation: 'Do not infer profitability from revenue alone — cost data is not available.',
    },
  ],
  'top-selling-products': [
    {
      title: 'Review inventory for leading products',
      action: 'Review inventory availability for the leading products.',
      rationale: 'Leading products drive a large share of revenue. Ensuring they remain available protects recorded sales.',
      nextStep: 'Check current stock levels for the top products and confirm reorder points are appropriate.',
      limitation: 'Do not automatically increase stock without inventory or wastage data.',
    },
    {
      title: 'Bundle top products to increase order value',
      action: 'Create bundles featuring top-selling products to encourage larger orders.',
      rationale: 'Popular products already drive revenue. Bundling them with complementary items may increase average order value.',
      nextStep: 'Identify products commonly purchased together and test bundle pricing at point of sale.',
      limitation: 'Do not infer customer preferences without transaction-level attachment data.',
    },
  ],
  'underperforming-products': [
    {
      title: 'Review product mix for underperforming items',
      action: 'Review whether underperforming products should remain on the menu.',
      rationale: 'Some products contribute significantly less revenue than the average. Evaluating their continued availability may help focus on higher-performing items.',
      nextStep: 'Analyze sales trends for underperforming products over multiple periods before deciding to retain, reprice, or remove them.',
      limitation: 'Low revenue may reflect niche appeal or seasonal demand rather than poor performance.',
    },
    {
      title: 'Reprice or promote underperforming products',
      action: 'Consider repricing or promoting underperforming products to improve contribution.',
      rationale: 'Products with low revenue share may benefit from price adjustments or targeted promotion.',
      nextStep: 'Test a limited-time promotion on underperforming products and measure the impact on units sold.',
      limitation: 'Do not infer the cause of low sales without customer feedback or cost data.',
    },
  ],
  'revenue-concentration': [
    {
      title: 'Review product availability and concentration risk',
      action: 'Review inventory availability for the leading products.',
      rationale: 'Revenue is concentrated in a small number of products. A stockout of any leading product could materially affect sales.',
      nextStep: 'Confirm adequate stock for top products and consider whether the menu should be broadened to reduce reliance on a few items.',
      limitation: 'High revenue concentration does not imply high profitability — margin data not available.',
    },
    {
      title: 'Diversify menu to reduce concentration risk',
      action: 'Consider adding new products to reduce reliance on leading items.',
      rationale: 'Revenue concentration creates risk if a top product becomes unavailable. Broadening the menu can spread demand across more items.',
      nextStep: 'Survey customer preferences and test a small number of new menu items alongside existing leaders.',
      limitation: 'New products require inventory, preparation, and marketing investment — not all will succeed.',
    },
  ],
  'weekday-weekend': [
    {
      title: 'Evaluate promotion during lower-activity days',
      action: 'Evaluate a small, measurable promotion during the lower-activity days.',
      rationale: 'Recorded revenue is consistently lower during one period (weekday or weekend). A targeted promotion may help balance demand across the week.',
      nextStep: 'Design a time-bound promotion for the lower-activity days and measure its impact before committing to a recurring offer.',
      limitation: 'Do not claim the promotion will increase profit without margin and cost data.',
    },
  ],
  'average-order-value': [
    {
      title: 'Review product mix and add-on offers',
      action: 'Review changes in product mix and evaluate relevant add-on offers.',
      rationale: 'Average order value changed compared with the preceding period. Adjusting the product mix or suggesting add-ons may influence order value.',
      nextStep: 'Analyze which products are commonly purchased together and test relevant add-on suggestions at point of sale.',
      limitation: 'Do not infer the cause of AOV change without additional evidence.',
    },
    {
      title: 'Introduce higher-margin add-on items',
      action: 'Evaluate adding complementary add-on items to increase order value.',
      rationale: 'If average order value is stable or declining, add-on suggestions at point of sale may increase per-order revenue.',
      nextStep: 'Identify low-cost complementary items and test add-on prompts during checkout.',
      limitation: 'Do not infer margin improvements without cost data for add-on items.',
    },
  ],
  'revenue-growth': [
    {
      title: 'Sustain growth momentum',
      action: 'Review what drove revenue growth and consider scaling successful practices.',
      rationale: 'Revenue increased compared to the previous period. Understanding the drivers can help sustain growth.',
      nextStep: 'Analyze which products, days, or hours contributed most to the growth and replicate those conditions.',
      limitation: 'Growth may be driven by external factors (seasonality, events) not captured in sales data.',
    },
  ],
  'revenue-decline': [
    {
      title: 'Investigate revenue decline',
      action: 'Investigate factors behind the revenue decline compared to the previous period.',
      rationale: 'Revenue decreased compared to the previous period. Understanding the cause is the first step toward addressing it.',
      nextStep: 'Compare product mix, pricing, and operating hours between periods to identify potential causes of the decline.',
      limitation: 'Sales data alone cannot determine the root cause of a decline — operational context is needed.',
    },
  ],
  'order-volume-change': [
    {
      title: 'Investigate order volume change',
      action: 'Review factors driving the change in order volume compared to the previous period.',
      rationale: 'Order volume changed significantly compared to the previous period. Understanding the driver can inform operational decisions.',
      nextStep: 'Analyze which days, hours, or products contributed most to the volume change and assess whether the trend is likely to continue.',
      limitation: 'Order volume changes may reflect external factors not captured in sales data.',
    },
  ],
}

const TYPE_TO_FAMILY: Record<string, string> = {
  'peak-sales-hours': 'peak-sales-hours',
  'low-activity-hours': 'low-activity-hours',
  'top-selling-products': 'top-selling-products',
  'underperforming-products': 'underperforming-products',
  'revenue-concentration': 'revenue-concentration',
  'weekday-weekend': 'weekday-weekend',
  'average-order-value': 'average-order-value',
  'revenue-growth': 'revenue-growth',
  'revenue-decline': 'revenue-decline',
  'order-volume-change': 'order-volume-change',
}

function recommendationScore(
  insight: Insight,
): number {
  const strengthScore = STRENGTH_ORDER[insight.evidenceStrength] * 25
  const relevanceScore = insight.relevanceScore * 0.5
  const limitationPenalty = insight.limitation ? 10 : 0
  return strengthScore + relevanceScore - limitationPenalty
}

export function generateRecommendations(
  insights: Insight[],
  period: ResolvedPeriod,
): Recommendation | null {
  const candidates: Array<{
    recommendation: Recommendation
    score: number
    family: string
  }> = []

  const seed = deriveSeed(period)
  const rng = seededRandom(seed)

  for (const insight of insights) {
    const family = TYPE_TO_FAMILY[insight.type]
    if (!family) continue

    const actions = FAMILY_ACTION_TITLES[family]
    if (!actions || actions.length === 0) continue

    // Deterministically pick one action variant per family using seed
    const actionIndex = Math.floor(rng() * actions.length)
    const action = actions[actionIndex]

    const rec: Recommendation = {
      id: deterministicId(`rec-${family}`, insight.id),
      title: action.title,
      recommendedAction: action.action,
      supportingInsightId: insight.id,
      evidenceSummary: insight.evidence,
      businessRationale: action.rationale,
      practicalNextStep: action.nextStep,
      limitationOrAssumption: action.limitation,
    }

    candidates.push({
      recommendation: rec,
      score: recommendationScore(insight),
      family,
    })
  }

  if (candidates.length === 0) return null

  // Select strongest recommendation with deterministic tie-break
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Prefer different families across periods using seed
    const famDiff = (a.family < b.family ? -1 : a.family > b.family ? 1 : 0)
    return famDiff
  })

  return candidates[0].recommendation
}