/**
 * Mist & Mug — ReportingPeriodNavigator
 *
 * Reusable hierarchical reporting-period navigator used by Sales Analytics
 * and Performance Tracker.
 *
 * Hierarchy:
 *   Select Reporting Period
 *   → All Time  OR  Year by Year
 *   → Year
 *   → Month
 *   → Calendar Week
 *   → Apply
 *
 * Selection and application are separate states. Clicking a year/month/week
 * updates only the pending selection; the displayed analytics stay unchanged
 * until Apply is clicked.
 *
 * All available periods are derived from actual imported transaction dates —
 * never from the system clock.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ProcessedLine } from '@/types'
import {
  type ReportingPeriodSelection,
  type PeriodYear,
  type PeriodMonth,
  type PeriodWeek,
  resolveSelection,
  getAvailableYears,
  getAvailableMonths,
  generateCalendarWeeks,
  monthLabel,
} from '@/lib/reporting-periods'

interface ReportingPeriodNavigatorProps {
  /** Valid transaction lines used to derive available periods. */
  lines: ProcessedLine[]
  /** The currently applied selection (what analytics renders). */
  applied: ReportingPeriodSelection | null
  /** Called when the user clicks Apply with a valid pending selection. */
  onApply: (selection: ReportingPeriodSelection) => void
  /** Label shown on the select trigger button when nothing is applied. */
  selectLabel?: string
  /** Whether the navigator panel is initially open. */
  defaultOpen?: boolean
}

type Mode = 'root' | 'years' | 'months' | 'weeks'

function isValidSelection(
  selection: ReportingPeriodSelection | null,
  lines: ProcessedLine[]
): selection is ReportingPeriodSelection {
  if (!selection) return false
  return resolveSelection(selection, lines) !== null
}

function isYear(s: ReportingPeriodSelection): s is PeriodYear {
  return s.kind === 'year'
}
function isMonth(s: ReportingPeriodSelection): s is PeriodMonth {
  return s.kind === 'month'
}
function isWeek(s: ReportingPeriodSelection): s is PeriodWeek {
  return s.kind === 'week'
}

function yearLabel(year: number): string {
  return String(year)
}

export function ReportingPeriodNavigator({
  lines,
  applied,
  onApply,
  selectLabel = 'Select Period',
  defaultOpen = false,
}: ReportingPeriodNavigatorProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const [mode, setMode] = React.useState<Mode>('root')
  const [pending, setPending] = React.useState<ReportingPeriodSelection | null>(
    applied ?? null
  )

  const validLines = React.useMemo(
    () => lines.filter((l) => l.isValid && !l.isDuplicate && l.date),
    [lines]
  )

  const availableYears = React.useMemo(() => getAvailableYears(validLines), [validLines])

  const yearPending = React.useMemo(
    () => (pending && isYear(pending) ? pending : null),
    [pending]
  )
  const availableMonths = React.useMemo(() => {
    if (yearPending) return getAvailableMonths(validLines, yearPending.year)
    return []
  }, [yearPending, validLines])

  const monthPending = React.useMemo(
    () => (pending && isMonth(pending) ? pending : null),
    [pending]
  )
  const calendarWeeks = React.useMemo(() => {
    if (monthPending) {
      return generateCalendarWeeks(validLines, monthPending.year, monthPending.month)
    }
    return []
  }, [monthPending, validLines])

  const pendingValid = isValidSelection(pending, lines)

  const selectionKey = (s: ReportingPeriodSelection | null): string | null => {
    if (!s) return null
    switch (s.kind) {
      case 'all-time':
        return 'all-time'
      case 'year':
        return `year:${s.year}`
      case 'month':
        return `month:${s.year}-${s.month}`
      case 'week':
        return `week:${s.year}-${s.month}-${s.weekIndex}`
    }
  }

  const hasChange = React.useMemo(
    () => selectionKey(pending) !== selectionKey(applied),
    [pending, applied]
  )

  // Keep pending in sync with externally supplied applied value (e.g. restore).
  React.useEffect(() => {
    setPending(applied ?? null)
    setMode('root')
  }, [applied])

  const selectAllTime = () => {
    setPending({ kind: 'all-time' })
    setMode('root')
  }

  const selectYearByYear = () => {
    setMode('years')
  }

  const selectYear = (year: number) => {
    setPending({ kind: 'year', year })
    setMode('months')
  }

  const selectMonth = (year: number, month: number) => {
    setPending({ kind: 'month', year, month })
    setMode('weeks')
  }

  const selectWeek = (year: number, month: number, weekIndex: number) => {
    setPending({ kind: 'week', year, month, weekIndex })
  }

  const goBack = () => {
    if (mode === 'weeks') {
      setMode('months')
      if (pending && isWeek(pending)) {
        setPending({ kind: 'month', year: pending.year, month: pending.month })
      }
    } else if (mode === 'months') {
      setMode('years')
      if (pending && isMonth(pending)) {
        setPending({ kind: 'year', year: pending.year })
      }
    } else if (mode === 'years') {
      setMode('root')
      setPending(null)
    }
  }

  const handleApply = () => {
    if (!pendingValid) return
    onApply(pending)
    setOpen(false)
  }

  const appliedLabel = React.useMemo(() => {
    if (!applied) return null
    const resolved = resolveSelection(applied, lines)
    return resolved?.label ?? null
  }, [applied, lines])

  const triggerLabel = applied ? `Change Period (${appliedLabel})` : selectLabel

  const isYearSelected = (year: number) => {
    if (!pending || pending.kind !== 'year') return false
    return pending.year === year
  }
  const isMonthSelected = (month: number) => {
    if (!pending || pending.kind !== 'month') return false
    return pending.month === month
  }
  const isWeekSelected = (weekIndex: number) => {
    if (!pending || pending.kind !== 'week') return false
    return pending.weekIndex === weekIndex
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Select trigger (placed in the header action slot, top-right) */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen((prev) => {
            if (!prev) {
              setPending(applied ?? null)
              setMode('root')
            }
            return !prev
          })
        }}
        aria-expanded={open}
        aria-controls="reporting-period-navigator-panel"
      >
        {open ? 'Close' : triggerLabel}
      </Button>

      {/* Apply control + hierarchical panel (rendered inline when open) */}
      {open && (
        <div
          id="reporting-period-navigator-panel"
          role="region"
          aria-label="Reporting period selection"
          className="card-premium p-6 rounded-xl border border-line bg-cream shadow-md w-full max-w-xs"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-serif text-base text-ink">Select Reporting Period</h3>
            <Button
              variant="brand"
              size="sm"
              disabled={!pendingValid || !hasChange}
              onClick={handleApply}
              aria-label="Apply reporting period"
            >
              Apply
            </Button>
          </div>

          {mode === 'root' && (
            <div className="space-y-3">
              <p className="text-xs text-rain/60 text-center">
                Choose how far back you want to analyze.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={
                    pending && pending.kind === 'all-time' ? 'brand' : 'outline'
                  }
                  size="sm"
                  onClick={selectAllTime}
                  className="text-forest hover:bg-forest hover:text-cream"
                >
                  All Time
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectYearByYear}
                  className="text-forest hover:bg-forest hover:text-cream"
                  disabled={availableYears.length === 0}
                >
                  Year by Year
                </Button>
              </div>
              {availableYears.length === 0 && (
                <p className="text-xs text-rain/50 text-center">
                  No imported sales data available.
                </p>
              )}
            </div>
          )}

          {mode === 'years' && (
            <div className="space-y-3">
              <p className="text-xs text-rain/60 text-center">
                Select a year containing sales data.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {availableYears.map((year) => {
                  const selected = isYearSelected(year)
                  return (
                    <Button
                      key={year}
                      variant={selected ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() => selectYear(year)}
                      className={cn(
                        'text-forest hover:bg-forest hover:text-cream',
                        selected && 'bg-forest text-cream border-forest',
                      )}
                    >
                      {yearLabel(year)}
                    </Button>
                  )
                })}
              </div>
              <Button variant="outline" size="sm" onClick={goBack}>
                ← Back
              </Button>
            </div>
          )}

          {mode === 'months' && yearPending && (
            <div className="space-y-3">
              <p className="text-xs text-rain/60 text-center">
                {yearLabel(yearPending.year)} — select a month.
              </p>
              <div className="grid grid-cols-4 gap-2">
                {availableMonths.map((month) => {
                  const selected = isMonthSelected(month)
                  return (
                    <Button
                      key={month}
                      variant={selected ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() => selectMonth(yearPending.year, month)}
                      className={cn(
                        'text-forest hover:bg-forest hover:text-cream',
                        selected && 'bg-forest text-cream border-forest',
                      )}
                    >
                      {monthLabel(yearPending.year, month)}
                    </Button>
                  )
                })}
              </div>
              <Button variant="outline" size="sm" onClick={goBack}>
                ← Back
              </Button>
            </div>
          )}

          {mode === 'weeks' && monthPending && (
            <div className="space-y-3">
              <p className="text-xs text-rain/60 text-center">
                {monthLabel(monthPending.year, monthPending.month)} {monthPending.year} — select a calendar week.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {calendarWeeks.map((week) => {
                  const selected = isWeekSelected(week.index)
                  return (
                    <Button
                      key={week.index}
                      variant={selected ? 'brand' : 'outline'}
                      size="sm"
                      onClick={() =>
                        selectWeek(monthPending.year, monthPending.month, week.index)
                      }
                      className={cn(
                        'text-forest hover:bg-forest hover:text-cream text-xs',
                        selected && 'bg-forest text-cream border-forest',
                        !week.hasData && 'opacity-50',
                      )}
                      disabled={!week.hasData}
                    >
                      Week {week.index}
                    </Button>
                  )
                })}
              </div>
              {calendarWeeks.length === 0 && (
                <p className="text-xs text-rain/50 text-center">
                  No calendar weeks with recorded sales.
                </p>
              )}
              <Button variant="outline" size="sm" onClick={goBack}>
                ← Back
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type { ReportingPeriodSelection }
