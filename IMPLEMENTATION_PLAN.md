# Phase 4A — Insights Implementation Plan

## Status: IN PROGRESS

### Step 1: Data Contracts (types)
- [ ] Create `src/types/insights.ts` — Insight and Recommendation interfaces

### Step 2: Insights Engine
- [ ] Create `src/lib/insights.ts` — Rule-based engine (Rules A-F)
- [ ] Evidence validation logic
- [ ] Candidate generation, validation, ranking, selection
- [ ] Deterministic tie-breaking

### Step 3: Recommendations Engine
- [ ] Create `src/lib/recommendations.ts` — Recommendation generation from insights

### Step 4: UI — Insights Page
- [ ] Create `src/pages/Insights.tsx` — Full page with header, period selector, insight cards, recommendation
- [ ] Empty state: placeholders before period selection
- [ ] Loading states

### Step 5: Navigation & Routing
- [ ] Add Insights sidebar item (Lightbulb icon) in `src/components/layout/Sidebar.tsx`
- [ ] Add `/insights` route in `src/App.tsx`

### Step 6: Tests
- [ ] Create `src/lib/insights.test.ts` — Comprehensive test suite

### Step 7: Verification
- [ ] `npm run build`
- [ ] `npx vitest run`
- [ ] `npx tsc --noEmit`

### Step 8: Final Report
- [ ] Consolidated implementation report