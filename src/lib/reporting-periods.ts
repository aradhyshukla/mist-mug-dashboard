/**
 * Mist & Mug — Reporting Period Utilities
 *
 * Centralized, deterministic helpers for the hierarchical reporting-period
 * navigator. All date arithmetic uses normalized YYYY-MM-DD transaction dates
 * and UTC calendar math so timezone shifts never move a day into the wrong
 * period.
 *
 * Everything here is read-only: it never writes to IndexedDB.
 */

import type { ProcessedLine } from '@/types'

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export interface CalendarWeek {
  index: number // 1-based within the selected month
  startDate: string // YYYY-MM-DD (inclusive)
  endDate: string // YYYY-MM-DD (inclusive)
  label: string // e.g. "Jan 1–3"
  hasData: boolean
}

export type ReportingPeriodKind = 'all-time' | 'year' | 'month' | 'week'

export interface PeriodAllTime {
  kind: 'all-time'
}
export interface PeriodYear {
  kind: 'year'
  year: number
}
export interface PeriodMonth {
  kind: 'month'
  year: number
  month: number // 1-12
}
export interface PeriodWeek {
  kind: 'week'
  year: number
  month: number // 1-12
  weekIndex: number // 1-based within the month
}

export type ReportingPeriodSelection =
  | PeriodAllTime
  | PeriodYear
  | PeriodMonth
  | PeriodWeek

export interface ResolvedPeriod {
  selection: ReportingPeriodSelection
  startDate: string // YYYY-MM-DD (inclusive)
  endDate: string // YYYY-MM-DD (inclusive)
  label: string // human readable, e.g. "All Time", "January 2026", "Week 2 · Jan 5–11, 2026"
}

// ---------------------------------------------------------------
// Date helpers (UTC, normalized YYYY-MM-DD)
// ---------------------------------------------------------------

function toISODate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function getDayOfWeekUtc(dateStr: string): number {
  // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return toISODate(date)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function lastDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth(year, month)).padStart(2, '0')}`
}

export function monthLabel(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1))
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------
// Available periods derived from actual transaction data
// ---------------------------------------------------------------

/**
 * Distinct years that contain at least one valid transaction line.
 */
export function getAvailableYears(lines: ProcessedLine[]): number[] {
  const years = new Set<number>()
  for (const line of lines) {
    if (!line.date) continue
    years.add(getYear(line.date))
  }
  return Array.from(years).sort((a, b) => a - b)
}

/**
 * Distinct months (1-12) within a year that contain at least one valid
 * transaction line.
 */
export function getAvailableMonths(lines: ProcessedLine[], year: number): number[] {
  const months = new Set<number>()
  for (const line of lines) {
    if (!line.date) continue
    if (getYear(line.date) !== year) continue
    months.add(getMonth(line.date))
  }
  return Array.from(months).sort((a, b) => a - b)
}

/**
 * Calendar weeks (Monday–Sunday, clipped to month boundaries) for a given
 * month, annotated with whether each week contains transaction data.
 *
 * Rules:
 *  - Monday is the first day of the week; Sunday is the last.
 *  - Week 1 starts on the first day of the month and ends on the first Sunday.
 *  - Subsequent weeks begin on Monday and end on Sunday.
 *  - The final week ends on the last day of the month.
 *  - Partial weeks are valid; some months have six calendar-week segments.
 */
export function generateCalendarWeeks(
  lines: ProcessedLine[],
  year: number,
  month: number
): CalendarWeek[] {
  const firstDay = firstDayOfMonth(year, month)
  const lastDay = lastDayOfMonth(year, month)

  // Build a set of dates present in the data for this month for O(1) lookup.
  const datesInMonth = new Set<string>()
  for (const line of lines) {
    if (!line.date) continue
    if (getYear(line.date) !== year || getMonth(line.date) !== month) continue
    datesInMonth.add(line.date)
  }

  const weeks: CalendarWeek[] = []
  let cursor = firstDay
  let index = 1

  while (cursor <= lastDay) {
    // Week 1 ends on the first Sunday. Subsequent weeks start on Monday.
    const firstDayDow = getDayOfWeekUtc(cursor) // 0=Sun ... 6=Sat
    let end: string

    if (index === 1) {
      // Days until the first Sunday (inclusive of cursor when cursor is Sunday).
      const daysUntilSunday = (7 - firstDayDow) % 7
      end = addDays(cursor, daysUntilSunday)
    } else {
      // cursor is a Monday; week runs Monday–Sunday.
      end = addDays(cursor, 6)
    }

    // Clip to the last day of the month.
    if (end > lastDay) end = lastDay

    const weekHasData = hasAnyDateInRange(datesInMonth, cursor, end)

    weeks.push({
      index,
      startDate: cursor,
      endDate: end,
      label: formatWeekRangeLabel(cursor, end),
      hasData: weekHasData,
    })

    cursor = addDays(end, 1)
    index += 1
  }

  return weeks
}

function hasAnyDateInRange(dates: Set<string>, start: string, end: string): boolean {
  for (const d of dates) {
    if (d >= start && d <= end) return true
  }
  return false
}

function getYear(dateStr: string): number {
  return parseInt(dateStr.slice(0, 4), 10)
}

function getMonth(dateStr: string): number {
  return parseInt(dateStr.slice(5, 7), 10)
}

function formatWeekRangeLabel(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)

  const startDate = new Date(Date.UTC(sy, sm - 1, sd))
  const endDate = new Date(Date.UTC(ey, em - 1, ed))

  const startDay = startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const endDay = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  if (sy === ey && sm === em) {
    return `${startDay}–${endDay}` // e.g. "Jan 1–3"
  }
  return `${startDay}–${endDay}` // cross-month shouldn't happen here, but stay safe
}

// ---------------------------------------------------------------
// Selection -> date range resolution
// ---------------------------------------------------------------

export function resolveSelection(
  selection: ReportingPeriodSelection,
  allLines: ProcessedLine[]
): ResolvedPeriod | null {
  const validLines = allLines.filter((l) => l.isValid && !l.isDuplicate && l.date)

  if (validLines.length === 0) return null

  const allTimeRange = getAllTimeRange(validLines)

  switch (selection.kind) {
    case 'all-time': {
      if (!allTimeRange) return null
      return {
        selection,
        startDate: allTimeRange.start,
        endDate: allTimeRange.end,
        label: 'All Time',
      }
    }

    case 'year': {
      const hasData = validLines.some((l) => getYear(l.date) === selection.year)
      if (!hasData) return null
      const start = `${selection.year}-01-01`
      const end = `${selection.year}-12-31`
      return {
        selection,
        startDate: start,
        endDate: end,
        label: String(selection.year),
      }
    }

    case 'month': {
      const hasData = validLines.some(
        (l) => getYear(l.date) === selection.year && getMonth(l.date) === selection.month
      )
      if (!hasData) return null
      const start = firstDayOfMonth(selection.year, selection.month)
      const end = lastDayOfMonth(selection.year, selection.month)
      return {
        selection,
        startDate: start,
        endDate: end,
        label: monthLabel(selection.year, selection.month),
      }
    }

    case 'week': {
      const weeks = generateCalendarWeeks(validLines, selection.year, selection.month)
      const week = weeks.find((w) => w.index === selection.weekIndex)
      if (!week) return null
      return {
        selection,
        startDate: week.startDate,
        endDate: week.endDate,
        label: `Week ${week.index} · ${monthLabel(selection.year, selection.month)}`,
      }
    }
  }
}

/**
 * All-time range: earliest to latest valid transaction date.
 */
function getAllTimeRange(lines: ProcessedLine[]): { start: string; end: string } | null {
  if (lines.length === 0) return null
  let start = lines[0].date!
  let end = lines[0].date!
  for (const line of lines) {
    if (!line.date) continue
    if (line.date < start) start = line.date
    if (line.date > end) end = line.date
  }
  return { start, end }
}

// ---------------------------------------------------------------
// Previous period for comparison (Performance Tracker)
// ---------------------------------------------------------------

/**
 * Returns the comparable previous period for a given selection, or null when
 * no meaningful previous period exists (e.g. All Time).
 */
export function getPreviousPeriod(selection: ReportingPeriodSelection): ReportingPeriodSelection | null {
  switch (selection.kind) {
    case 'year':
      return { kind: 'year', year: selection.year - 1 }
    case 'month': {
      if (selection.month === 1) {
        return { kind: 'month', year: selection.year - 1, month: 12 }
      }
      return { kind: 'month', year: selection.year, month: selection.month - 1 }
    }
    case 'week': {
      // Previous comparable calendar-week segment: same week index in the
      // previous month (or December of the previous year for January).
      if (selection.month === 1) {
        return { kind: 'week', year: selection.year - 1, month: 12, weekIndex: selection.weekIndex }
      }
      return { kind: 'week', year: selection.year, month: selection.month - 1, weekIndex: selection.weekIndex }
    }
    case 'all-time':
      return null
  }
}

/**
 * Human-readable label for a previous period.
 */
export function previousPeriodLabel(selection: ReportingPeriodSelection): string | null {
  const prev = getPreviousPeriod(selection)
  if (!prev) return null
  switch (prev.kind) {
    case 'year':
      return String(prev.year)
    case 'month':
      return monthLabel(prev.year, prev.month)
    case 'week': {
      // We can't know the exact dates without the line data; give a generic label.
      return `Week ${prev.weekIndex} · ${monthLabel(prev.year, prev.month)}`
    }
    case 'all-time':
      return 'All Time'
  }
}

// ---------------------------------------------------------------
// Selection transitions (parent/child clearing)
// ---------------------------------------------------------------

/**
 * When a parent selection changes, clear any stale child selections so the UI
 * never applies an outdated child period to a newly selected parent.
 */
export function clearChildren(selection: ReportingPeriodSelection): ReportingPeriodSelection {
  switch (selection.kind) {
    case 'all-time':
      return { kind: 'all-time' }
    case 'year':
      return { kind: 'year', year: selection.year }
    case 'month':
      return { kind: 'month', year: selection.year, month: selection.month }
    case 'week':
      return selection
  }
}

/**
 * Validate that a selection still has data in the current dataset (used after
 * upload deletion). Returns null when the selection is stale.
 */
export function validateSelection(
  selection: ReportingPeriodSelection,
  allLines: ProcessedLine[]
): ReportingPeriodSelection | null {
  return resolveSelection(selection, allLines) ? selection : null
}
