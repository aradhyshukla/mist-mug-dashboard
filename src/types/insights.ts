/**
 * Mist & Mug — Insights Data Contracts
 *
 * Strict TypeScript types for the rule-based business insights engine.
 * These contracts define the interface between the analytics engine,
 * the recommendation engine, and the Insights UI.
 *
 * Designed so a future Gemini-powered hybrid engine can reuse the same
 * contracts without changing the UI layer.
 */

import type { ResolvedPeriod } from '@/lib/reporting-periods'

// ---------------------------------------------------------------------------
// Insight evidence strength classification
// ---------------------------------------------------------------------------

export type EvidenceStrength = 'strong' | 'moderate' | 'limited'

// ---------------------------------------------------------------------------
// Insight category / type
// ---------------------------------------------------------------------------

export type InsightType =
  | 'weekday-weekend'
  | 'busiest-hours'
  | 'top-products'
  | 'revenue-trend'
  | 'average-order-value'
  | 'revenue-concentration'

// ---------------------------------------------------------------------------
// Supporting metric displayed on an insight card
// ---------------------------------------------------------------------------

export interface InsightMetric {
  label: string // human-readable label, e.g. "Avg per weekend day"
  value: string | number // formatted value
  format?: 'inr' | 'number' | 'percent' | 'count'
}

// ---------------------------------------------------------------------------
// Core insight data contract
// ---------------------------------------------------------------------------

export interface Insight {
  id: string // stable, deterministic insight ID
  type: InsightType
  title: string
  explanation: string
  supportingMetrics: InsightMetric[]
  reportingPeriod: ResolvedPeriod
  evidence: string // plain-language evidence description
  evidenceStrength: EvidenceStrength
  relevanceScore: number // 0-100, higher = more relevant to the café owner
  limitation?: string // optional data limitation or caveat
}

// ---------------------------------------------------------------------------
// Recommendation data contract
// ---------------------------------------------------------------------------

export interface Recommendation {
  id: string
  title: string
  recommendedAction: string
  supportingInsightId: string // references the insight that drove this
  evidenceSummary: string
  businessRationale: string
  practicalNextStep: string
  limitationOrAssumption: string
}

// ---------------------------------------------------------------------------
// Engine output: the three insights plus at most one recommendation
// ---------------------------------------------------------------------------

export interface InsightsResult {
  insights: Insight[]
  recommendation: Recommendation | null
  period: ResolvedPeriod | null
  hasData: boolean
  error: string | null
}

// ---------------------------------------------------------------------------
// Candidate insight (pre-validation, pre-ranking)
// ---------------------------------------------------------------------------

export interface InsightCandidate {
  type: InsightType
  title: string
  explanation: string
  supportingMetrics: InsightMetric[]
  evidence: string
  evidenceStrength: EvidenceStrength
  relevanceScore: number
  limitation?: string
  valid: boolean
  validationErrors: string[]
}