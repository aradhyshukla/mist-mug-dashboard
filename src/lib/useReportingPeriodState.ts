/**
 * Mist & Mug — useReportingPeriodState
 *
 * Shared state hook for the reporting-period navigator. Each page that uses the
 * navigator instantiates its own hook so pending and applied selections are
 * independent per page.
 *
 * The applied selection is persisted to sessionStorage and validated against the
 * current transaction data on mount (and whenever data changes), so a stale
 * selection is never restored after its underlying sales data has been removed.
 * sessionStorage is session-scoped: it survives refreshes in the same tab but is
 * not shared across independent browser sessions/tabs.
 */

import * as React from 'react'
import type { ReportingPeriodSelection } from '@/lib/reporting-periods'
import { validateSelection } from '@/lib/reporting-periods'
import type { ProcessedLine } from '@/types'

interface UseReportingPeriodStateOptions {
  storageKey: string
  lines: ProcessedLine[]
  initialSelection?: ReportingPeriodSelection | null
}

interface UseReportingPeriodStateReturn {
  applied: ReportingPeriodSelection | null
  setApplied: (selection: ReportingPeriodSelection | null) => void
  clearApplied: () => void
}

export function useReportingPeriodState({
  storageKey,
  lines,
  initialSelection = null,
}: UseReportingPeriodStateOptions): UseReportingPeriodStateReturn {
  const validLines = React.useMemo(
    () => lines.filter((l) => l.isValid && !l.isDuplicate && l.date),
    [lines]
  )

  const [applied, setAppliedState] = React.useState<ReportingPeriodSelection | null>(
    () => {
      const persisted = readPersisted(storageKey)
      if (!persisted) return initialSelection
      // Restore only if the underlying sales data still exists.
      return validateSelection(persisted, validLines) ?? null
    }
  )

  // Re-validate whenever data changes (e.g. after upload deletion).
  React.useEffect(() => {
    if (!applied) return
    const stillValid = validateSelection(applied, validLines)
    if (!stillValid) {
      setAppliedState(null)
      removePersisted(storageKey)
    }
  }, [applied, validLines, storageKey])

  // Restore a persisted selection once data becomes available.
  //
  // The useState initializer runs before lines load (empty array), so the
  // persisted selection cannot be validated at mount — validateSelection
  // returns null against empty data and applied stays null forever.
  // This effect retries restoration once validLines has data. When a user
  // returns to a page, the previously applied period is restored and the
  // page's range effect then recalculates analytics automatically.
  React.useEffect(() => {
    if (applied) return // already have an applied selection; nothing to restore
    if (validLines.length === 0) return // no data yet; wait for next cycle
    const persisted = readPersisted(storageKey)
    if (!persisted) return
    const restored = validateSelection(persisted, validLines)
    if (restored) {
      setAppliedState(restored)
    }
    // If restored is null, the persisted selection is stale; leave applied
    // as null so the user must select a new period.
  }, [validLines, storageKey, applied])

  const setApplied = React.useCallback(
    (selection: ReportingPeriodSelection | null) => {
      setAppliedState(selection)
      if (selection) {
        writePersisted(storageKey, selection)
      } else {
        removePersisted(storageKey)
      }
    },
    [storageKey]
  )

  const clearApplied = React.useCallback(() => {
    setAppliedState(null)
    removePersisted(storageKey)
  }, [storageKey])

  return { applied, setApplied, clearApplied }
}

// ---------------------------------------------------------------
// sessionStorage helpers (session-scoped: survives same-tab refresh,
// cleared when a new independent browser session/tab is opened)
// ---------------------------------------------------------------

function readPersisted(key: string): ReportingPeriodSelection | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed.kind === 'string' ? (parsed as ReportingPeriodSelection) : null
  } catch {
    return null
  }
}

function writePersisted(key: string, selection: ReportingPeriodSelection): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, JSON.stringify(selection))
  } catch {
    // Storage may be disabled/quota-exceeded; persistence is optional.
  }
}

function removePersisted(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // noop
  }
}
