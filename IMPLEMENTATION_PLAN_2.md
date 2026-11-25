# Phase 4A — Insights Engine 2.0 Implementation Plan

## Status: IN PROGRESS

### Step 1: Update types — Add new insight types (10 families)
- [ ] Add: revenue-growth, revenue-decline, low-activity-hours, order-volume-change, underperforming-products
- [ ] Keep: weekday-weekend, busiest-hours, top-products, revenue-concentration, average-order-value, revenue-trend

### Step 2: Fix metric formatting (NaN prevention)
- [ ] Safe formatMetric with NaN/Infinity/undefined checks
- [ ] Indian digit grouping for INR
- [ ] One decimal place for percentages
- [ ] Integer formatting for orders/quantities
- [ ] N/A for genuinely unavailable metrics

### Step 3: Expand candidate pool to 10 analytical families
- [ ] Revenue growth insight
- [ ] Revenue decline insight
- [ ] Peak sales hours (exists)
- [ ] Low-activity hours (new)
- [ ] Weekday/weekend (exists)
- [ ] Average order value (exists)
- [ ] Order-volume change (new)
- [ ] Top-selling products (exists)
- [ ] Underperforming products (new)
- [ ] Product revenue concentration (exists)
- [ ] Daily/weekly/monthly patterns (exists as revenue-trend)

### Step 4: Implement controlled randomization
- [ ] Stable seed from period + dataset fingerprint
- [ ] Seeded weighted selection among comparably strong candidates
- [ ] Group by analytical family, prefer 3 distinct families
- [ ] Penalize overlap with adjacent periods
- [ ] Stable across refreshes when data unchanged

### Step 5: Implement recommendation variety
- [ ] Multiple action families (inventory, product mix, peak-hour ops, etc.)
- [ ] Period-aware selection among similarly strong recommendations
- [ ] Exactly ONE recommendation displayed

### Step 6: Update UI page
- [ ] Preserve existing layout, styling, exactly 3 cards + 1 recommendation
- [ ] Fix NaN metric display
- [ ] Handle fewer than 3 insights gracefully

### Step 7: Add comprehensive tests
- [ ] No NaN/Infinity
- [ ] Correct currency/percentage formatting
- [ ] Same period + same data = same output
- [ ] Different periods produce different selections
- [ ] Adjacent-period repetition reduced
- [ ] Exactly 3 insights when sufficient evidence
- [ ] Exactly 1 recommendation when supported
- [ ] No alternative recommendations
- [ ] Stable after refresh
- [ ] Recalculation after import/delete
- [ ] No historical transaction mutation

### Step 8: Build and verify
- [ ] npm run build
- [ ] npx vitest run
- [ ] tsc --noEmit