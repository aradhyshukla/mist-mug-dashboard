/**
 * Mist & Mug — useReportingPeriodState Tests
 *
 * Tests session-scoped reporting-period state restoration across page
 * remounts. The critical defect being tested: the hook's useState initializer
 * read sessionStorage before lines loaded (empty array), so validateSelection
 * always returned null and applied stayed null forever — analytics vanished
 * on navigation. A restoration effect now retries once validLines has data.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import type { ProcessedLine } from '@/types'
import type { ReportingPeriodSelection } from '@/lib/reporting-periods'
import { useReportingPeriodState } from '@/lib/useReportingPeriodState'

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

const JAN_2026_LINES: ProcessedLine[] = [
  line({ transactionId: 'txn-1', date: '2026-01-05', quantity: 2, unitPriceInr: 180 }),
  line({ transactionId: 'txn-2', date: '2026-01-12', quantity: 1, unitPriceInr: 90 }),
  line({ transactionId: 'txn-3', date: '2026-01-20', quantity: 3, unitPriceInr: 160 }),
]

const ALL_TIME_SELECTION: ReportingPeriodSelection = { kind: 'all-time' }
const JAN_2026_MONTH_SELECTION: ReportingPeriodSelection = {
  kind: 'month',
  year: 2026,
  month: 1,
}

// ---------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------

function clearSessionStorage() {
  window.sessionStorage.clear()
}

function persistSelection(key: string, selection: ReportingPeriodSelection) {
  window.sessionStorage.setItem(key, JSON.stringify(selection))
}

// Test component that renders the applied value so we can observe it.
function Harness({ storageKey, lines }: { storageKey: string; lines: ProcessedLine[] }) {
  const { applied, setApplied, clearApplied } = useReportingPeriodState({
    storageKey,
    lines,
  })
  return (
    <div>
      <span data-testid="applied">{applied ? JSON.stringify(applied) : 'null'}</span>
      <button data-testid="set-applied" onClick={() => setApplied(ALL_TIME_SELECTION)}>
        Set Applied
      </button>
      <button data-testid="clear-applied" onClick={clearApplied}>
        Clear Applied
      </button>
    </div>
  )
}

function mountHarness(
  storageKey: string,
  lines: ProcessedLine[],
): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(<Harness storageKey={storageKey} lines={lines} />)
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

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

beforeEach(() => {
  clearSessionStorage()
})

afterEach(() => {
  clearSessionStorage()
})

describe('useReportingPeriodState restoration after data load', () => {
  it('restores persisted selection once validLines has data', () => {
    persistSelection('mistmug:test:appliedPeriod', JAN_2026_MONTH_SELECTION)

    const { container, unmount } = mountHarness('mistmug:test:appliedPeriod', [])
    expect(container.querySelector('[data-testid="applied"]')!.textContent).toBe('null')
    unmount()

    // Re-mount with data — the restoration effect should fire and set applied.
    const { container: container2, unmount: unmount2 } = mountHarness(
      'mistmug:test:appliedPeriod',
      JAN_2026_LINES,
    )
    const appliedText = container2.querySelector('[data-testid="applied"]')!.textContent
    expect(appliedText).toContain('"kind":"month"')
    expect(appliedText).toContain('"year":2026')
    expect(appliedText).toContain('"month":1')
    unmount2()
  })

  it('does not restore when no persisted selection exists', () => {
    // Nothing in sessionStorage
    const { container, unmount } = mountHarness('mistmug:test:none', JAN_2026_LINES)
    expect(container.querySelector('[data-testid="applied"]')!.textContent).toBe('null')
    unmount()
  })

  it('does not restore a stale selection that no longer matches data', () => {
    // Persist a month selection for Feb 2026, but only January data exists.
    persistSelection(
      'mistmug:test:stale',
      { kind: 'month', year: 2026, month: 2 } as ReportingPeriodSelection,
    )

    const { container, unmount } = mountHarness('mistmug:test:stale', JAN_2026_LINES)
    expect(container.querySelector('[data-testid="applied"]')!.textContent).toBe('null')
    unmount()
  })

  it('does not override an already-applied selection', () => {
    const { container, unmount } = mountHarness('mistmug:test:override', JAN_2026_LINES)
    const setButton = container.querySelector('[data-testid="set-applied"]') as HTMLButtonElement
    act(() => {
      setButton.click()
    })
    expect(
      container.querySelector('[data-testid="applied"]')!.textContent,
    ).toContain('all-time')
    unmount()
  })
})

describe('independent storage keys per section', () => {
  it('keeps analytics and insights selections independent', () => {
    persistSelection('mistmug:analytics:appliedPeriod', JAN_2026_MONTH_SELECTION)
    persistSelection('mistmug:insights:appliedPeriod', ALL_TIME_SELECTION)

    const { container: c1, unmount: u1 } = mountHarness(
      'mistmug:analytics:appliedPeriod',
      JAN_2026_LINES,
    )
    expect(c1.querySelector('[data-testid="applied"]')!.textContent).toContain(
      '"kind":"month"',
    )
    u1()

    const { container: c2, unmount: u2 } = mountHarness(
      'mistmug:insights:appliedPeriod',
      JAN_2026_LINES,
    )
    expect(c2.querySelector('[data-testid="applied"]')!.textContent).toContain(
      '"kind":"all-time"',
    )
    u2()
  })

  it('clearing one section does not affect another', () => {
    persistSelection('mistmug:analytics:appliedPeriod', JAN_2026_MONTH_SELECTION)
    persistSelection('mistmug:insights:appliedPeriod', ALL_TIME_SELECTION)

    // Clear analytics
    const { container: c1, unmount: u1 } = mountHarness(
      'mistmug:analytics:appliedPeriod',
      JAN_2026_LINES,
    )
    const clearBtn = c1.querySelector('[data-testid="clear-applied"]') as HTMLButtonElement
    act(() => {
      clearBtn.click()
    })
    expect(c1.querySelector('[data-testid="applied"]')!.textContent).toBe('null')
    expect(window.sessionStorage.getItem('mistmug:analytics:appliedPeriod')).toBeNull()
    u1()

    // Insights should still have its selection
    const { container: c2, unmount: u2 } = mountHarness(
      'mistmug:insights:appliedPeriod',
      JAN_2026_LINES,
    )
    expect(c2.querySelector('[data-testid="applied"]')!.textContent).toContain(
      '"kind":"all-time"',
    )
    u2()
  })
})

describe('sessionStorage scope', () => {
  it('persists to sessionStorage (not localStorage)', () => {
    persistSelection('mistmug:test:scope', JAN_2026_MONTH_SELECTION)
    expect(window.sessionStorage.getItem('mistmug:test:scope')).not.toBeNull()
    expect(window.localStorage.getItem('mistmug:test:scope')).toBeNull()
  })
})
