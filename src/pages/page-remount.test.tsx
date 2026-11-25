/**
 * Mist & Mug — Page Remount Integration Tests
 *
 * Tests that Sales Analytics, Performance Tracker, and Business Insights
 * restore their independently applied reporting periods and recalculate
 * analytics when the component remounts after navigation.
 *
 * The root cause fixed here: useReportingPeriodState's useState initializer
 * read sessionStorage before lines loaded (empty array), so validateSelection
 * always returned null and applied stayed null forever — analytics vanished
 * on navigation. A restoration effect now retries once validLines has data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { BrowserRouter } from 'react-router-dom'
import type { ProcessedLine } from '@/types'

vi.mock('@/db', () => ({
  db: { importLines: { toArray: vi.fn() } },
  getAllImportLines: vi.fn(),
  getAllProducts: vi.fn(),
  emitDataChanged: vi.fn(),
  onDataChanged: vi.fn(),
}))

import { getAllImportLines, getAllProducts } from '@/db'
import { SalesAnalytics } from '@/pages/SalesAnalytics'
import { PerformanceTracker } from '@/pages/PerformanceTracker'
import { Insights } from '@/pages/Insights'

// ---------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------

function line({
  transactionId,
  lineId = '1',
  date,
  quantity = 1,
  unitPriceInr = 100,
  productName = 'Test Product',
}: {
  transactionId: string
  lineId?: string
  date: string
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
    time: '10:00',
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

const SALES_LINES: ProcessedLine[] = [
  line({ transactionId: 'txn-1', date: '2026-01-05', quantity: 2, unitPriceInr: 180 }),
  line({ transactionId: 'txn-2', date: '2026-01-12', quantity: 1, unitPriceInr: 90 }),
  line({ transactionId: 'txn-3', date: '2026-01-20', quantity: 3, unitPriceInr: 160 }),
]

function clearSessionStorage() {
  window.sessionStorage.clear()
}

function mountPage(
  Component: React.ComponentType<any>,
): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(
      <BrowserRouter>
        <Component />
      </BrowserRouter>,
    )
  })
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount()
      })
      document.body.removeChild(container)
    },
  }
}

// Wait for async effects (data load + restoration) to flush
async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 200))
}

// Wait for analytics KPI values to appear (async computation)
async function waitForKPIs(container: HTMLElement, maxMs = 1000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    if (container.textContent!.includes('₹')) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

beforeEach(() => {
  clearSessionStorage()
  vi.clearAllMocks()
  ;(getAllImportLines as ReturnType<typeof vi.fn>).mockResolvedValue(SALES_LINES)
  ;(getAllProducts as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

afterEach(() => {
  clearSessionStorage()
})

describe('Sales Analytics page remount restoration', () => {
  it('restores applied period and analytics after remount', async () => {
    // First mount — no persisted selection, should show "Select a reporting period"
    const { container, unmount } = mountPage(SalesAnalytics)
    await flushEffects()
    expect(container.textContent!).toContain('Select a reporting period')
    unmount()

    // Simulate user having applied January 2026 — persist it directly
    const janSelection = { kind: 'month', year: 2026, month: 1 }
    window.sessionStorage.setItem(
      'mistmug:analytics:appliedPeriod',
      JSON.stringify(janSelection),
    )

    // Remount: the restoration effect should restore the applied period
    // and trigger analytics recalculation
    const { container: c2, unmount: u2 } = mountPage(SalesAnalytics)
    await flushEffects()

    // Should show "Analyzing:" with a range label, not "Select a reporting period"
    expect(c2.textContent).toContain('Analyzing:')
    expect(c2.textContent).not.toContain('Select a reporting period to begin analysis')

    // KPI cards should show currency values (not em dash placeholders)
    await waitForKPIs(c2)
    expect(c2.textContent).toContain('₹')
    u2()
  })
})

describe('Performance Tracker page remount restoration', () => {
  it('restores applied period and analytics after remount', async () => {
    const { container, unmount } = mountPage(PerformanceTracker)
    await flushEffects()
    expect(container.textContent).toContain('Select a reporting period')
    unmount()

    const janSelection = { kind: 'month', year: 2026, month: 1 }
    window.sessionStorage.setItem(
      'mistmug:performance:appliedPeriod',
      JSON.stringify(janSelection),
    )

    const { container: c2, unmount: u2 } = mountPage(PerformanceTracker)
    await flushEffects()

    expect(c2.textContent).toContain('Analyzing:')
    expect(c2.textContent).not.toContain('Select a reporting period to begin analysis')
    u2()
  })
})

describe('Insights page remount restoration', () => {
  it('restores applied period and analytics after remount', async () => {
    const { container, unmount } = mountPage(Insights)
    await flushEffects()
    expect(container.textContent).toContain('Select a reporting period')
    unmount()

    const allTimeSelection = { kind: 'all-time' }
    window.sessionStorage.setItem(
      'mistmug:insights:appliedPeriod',
      JSON.stringify(allTimeSelection),
    )

    const { container: c2, unmount: u2 } = mountPage(Insights)
    await flushEffects()

    expect(c2.textContent).toContain('Analyzing:')
    expect(c2.textContent).not.toContain('Select a reporting period to begin analysis')
    u2()
  })
})

describe('Independent section state', () => {
  it('keeps three sections independent after remount', async () => {
    // Apply different periods to each section
    window.sessionStorage.setItem(
      'mistmug:analytics:appliedPeriod',
      JSON.stringify({ kind: 'month', year: 2026, month: 1 }),
    )
    window.sessionStorage.setItem(
      'mistmug:performance:appliedPeriod',
      JSON.stringify({ kind: 'year', year: 2026 }),
    )
    window.sessionStorage.setItem(
      'mistmug:insights:appliedPeriod',
      JSON.stringify({ kind: 'all-time' }),
    )

    // Mount all three
    const a = mountPage(SalesAnalytics)
    const p = mountPage(PerformanceTracker)
    const i = mountPage(Insights)

    await flushEffects()

    // Each should show its own period label
    expect(a.container.textContent).toContain('Analyzing:')
    expect(p.container.textContent).toContain('Analyzing:')
    expect(i.container.textContent).toContain('Analyzing:')

    // None should show the generic "select a period" prompt
    expect(a.container.textContent).not.toContain('Select a reporting period to begin analysis')
    expect(p.container.textContent).not.toContain('Select a reporting period to begin analysis')
    expect(i.container.textContent).not.toContain('Select a reporting period to begin analysis')

    a.unmount()
    p.unmount()
    i.unmount()
  })
})

describe('Clear isolation', () => {
  it('clearing one section does not affect others', async () => {
    window.sessionStorage.setItem(
      'mistmug:analytics:appliedPeriod',
      JSON.stringify({ kind: 'month', year: 2026, month: 1 }),
    )
    window.sessionStorage.setItem(
      'mistmug:insights:appliedPeriod',
      JSON.stringify({ kind: 'all-time' }),
    )

    // Mount analytics first
    const a = mountPage(SalesAnalytics)
    await flushEffects()
    expect(a.container.textContent).toContain('Analyzing:')

    // Clear analytics (click Clear button)
    const buttons = Array.from(a.container.querySelectorAll('button'))
    const clearButton = buttons.find((b) => b.textContent === 'Clear')
    if (clearButton) {
      act(() => {
        clearButton.click()
      })
    }

    await flushEffects()
    expect(a.container.textContent).toContain('Select a reporting period to begin analysis')

    // Insights should be unaffected — remount it
    a.unmount()
    const i = mountPage(Insights)
    await flushEffects()
    expect(i.container.textContent).toContain('Analyzing:')
    expect(i.container.textContent).not.toContain('Select a reporting period to begin analysis')
    i.unmount()
  })
})