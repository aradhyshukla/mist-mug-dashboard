/**
 * Mist & Mug — Recommendation Engine
 *
 * Generates actionable business recommendations from selected insights.
 * Each recommendation derives from a specific insight and remains advisory
 * — it never automatically modifies product settings, prices, inventory,
 * or sales records.
 *
 * Read-only: never writes to IndexedDB or modifies any data.
 */

import type { Insight } from '@/types/insights'
import type { Recommendation } from '@/types/insights'

function deterministicId(prefix: string, data: string): string {
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`
}

// ---------------------------------------------------------------------------
// Recommendation selection criteria
// ---------------------------------------------------------------------------

/**
 * Score a recommendation candidate based on:
 *   - Supporting evidence strength
 *   - Business relevance
 *   - Practical feasibility
 *   - Risk of unsupported assumptions
 */
function recommendationScore(
  insight: Insight,
): number {
  const strengthOrder: Record<'strong' | 'moderate' | 'limited', number> = {
    strong: 3,
    moderate: 2,
    limited: 1,
  }
  const strengthScore = strengthOrder[insight.evidenceStrength] * 25
  const relevanceScore = insight.relevanceScore * 0.5

  // Penalty for limitations that introduce assumption risk
  const limitationPenalty = insight.limitation ? 10 : 0

  return strengthScore + relevanceScore - limitationPenalty
}

// ---------------------------------------------------------------------------
// Generate recommendations from selected insights
// ---------------------------------------------------------------------------

export function generateRecommendations(
  insights: Insight[],
): Recommendation | null {
  const candidates: Array<{
    recommendation: Recommendation
    score: number
  }> = []

  for (const insight of insights) {
    switch (insight.type) {
      case 'busiest-hours': {
        const rec: Recommendation = {
          id: deterministicId('rec-peak-hours', insight.id),
          title: 'Review staffing during the sales peak',
          recommendedAction:
            'Review staffing and service capacity during the evening sales peak.',
          supportingInsightId: insight.id,
          evidenceSummary: insight.evidence,
          businessRationale:
            'Recorded revenue is concentrated during the peak hour. Reviewing service times and staffing coverage may help determine whether adjustments are needed.',
          practicalNextStep:
            'Compare scheduled staff shifts against the peak-hour sales pattern and consider aligning coverage with demand.',
          limitationOrAssumption:
            'Sales data alone cannot confirm staffing is insufficient — operational review needed.',
        }
        candidates.push({ recommendation: rec, score: recommendationScore(insight) })
        break
      }

      case 'top-products': {
        const rec: Recommendation = {
          id: deterministicId('rec-top-products', insight.id),
          title: 'Review inventory for leading products',
          recommendedAction:
            'Review inventory availability for the leading products.',
          supportingInsightId: insight.id,
          evidenceSummary: insight.evidence,
          businessRationale:
            'Leading products drive a large share of revenue. Ensuring they remain available protects recorded sales.',
          practicalNextStep:
            'Check current stock levels for the top products and confirm reorder points are appropriate.',
          limitationOrAssumption:
            'Do not automatically increase stock without inventory or wastage data.',
        }
        candidates.push({ recommendation: rec, score: recommendationScore(insight) })
        break
      }

      case 'revenue-concentration': {
        const rec: Recommendation = {
          id: deterministicId('rec-concentration', insight.id),
          title: 'Review product availability and concentration risk',
          recommendedAction:
            'Review inventory availability for the leading products.',
          supportingInsightId: insight.id,
          evidenceSummary: insight.evidence,
          businessRationale:
            'Revenue is concentrated in a small number of products. A stockout of any leading product could materially affect sales.',
          practicalNextStep:
            'Confirm adequate stock for top products and consider whether the menu should be broadened to reduce reliance on a few items.',
          limitationOrAssumption:
            'High revenue concentration does not imply high profitability — margin data not available.',
        }
        candidates.push({ recommendation: rec, score: recommendationScore(insight) })
        break
      }

      case 'weekday-weekend': {
        const rec: Recommendation = {
          id: deterministicId('rec-weekday-weekend', insight.id),
          title: 'Evaluate promotion during lower-activity period',
          recommendedAction:
            'Evaluate a small, measurable promotion during the lower-activity period.',
          supportingInsightId: insight.id,
          evidenceSummary: insight.evidence,
          businessRationale:
            'Recorded revenue is consistently lower during one period. A targeted promotion may help balance demand across the week.',
          practicalNextStep:
            'Design a time-bound promotion for the lower-activity days and measure its impact before committing to a recurring offer.',
          limitationOrAssumption:
            'Do not claim the promotion will increase profit without margin and cost data.',
        }
        candidates.push({ recommendation: rec, score: recommendationScore(insight) })
        break
      }

      case 'average-order-value': {
        const rec: Recommendation = {
          id: deterministicId('rec-aov', insight.id),
          title: 'Review product mix and add-on offers',
          recommendedAction:
            'Review changes in product mix and evaluate relevant add-on offers.',
          supportingInsightId: insight.id,
          evidenceSummary: insight.evidence,
          businessRationale:
            'Average order value changed compared with the preceding period. Adjusting the product mix or suggesting add-ons may influence order value.',
          practicalNextStep:
            'Analyze which products are commonly purchased together and test relevant add-on suggestions at point of sale.',
          limitationOrAssumption:
            'Do not infer the cause of AOV change without additional evidence.',
        }
        candidates.push({ recommendation: rec, score: recommendationScore(insight) })
        break
      }

      case 'revenue-trend': {
        // Revenue trend insights are observational; no direct actionable recommendation
        // beyond what top-products or weekday-weekend might already cover.
        break
      }
    }
  }

  if (candidates.length === 0) return null

  // Select the strongest recommendation: highest score, deterministic tie-break by ID
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.recommendation.id.localeCompare(b.recommendation.id)
  })

  return candidates[0].recommendation
}