/**
 * Mist & Mug — File Import Utilities
 *
 * Parses CSV (Papa Parse) and XLSX (SheetJS), normalizes headers,
 * maps columns, validates records, and produces ProcessedLine entries.
 */

import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type {
  ProcessedLine,
  ColumnMapping,
  ImportPreview,
  ValidationIssue,
  ProductCategory,
} from '@/types'
import { db } from '@/db'

// ---------------------------------------------------------------
// Column alias map (reasonable aliases → canonical field names)
// ---------------------------------------------------------------

const ALIASES: Record<string, string> = {
  // transaction_id
  'transaction id': 'transaction_id',
  'transactionid': 'transaction_id',
  'txn id': 'transaction_id',
  'txnid': 'transaction_id',
  'order id': 'transaction_id',
  'orderid': 'transaction_id',
  'transaction': 'transaction_id',
  'transaction_id': 'transaction_id',

  // line_id
  'line id': 'line_id',
  'lineid': 'line_id',
  'line number': 'line_id',
  'linenumber': 'line_id',
  'item number': 'line_id',
  'source line id': 'line_id',
  'line_id': 'line_id',

  // date
  'transaction date': 'date',
  'order date': 'date',
  'sale date': 'date',
  'billing date': 'date',
  'invoice date': 'date',
  'date': 'date',

  // time
  'transaction time': 'time',
  'order time': 'time',
  'sale time': 'time',
  'time': 'time',

  // item_name
  'item name': 'item_name',
  'product name': 'item_name',
  'product': 'item_name',
  'item': 'item_name',
  'product_name': 'item_name',
  'menu item': 'item_name',
  'menuitem': 'item_name',
  'item_name': 'item_name',

  // category
  'item category': 'category',
  'product category': 'category',
  'category_name': 'category',
  'category': 'category',

  // quantity
  'qty': 'quantity',
  'qty.': 'quantity',
  'units': 'quantity',
  'quantity': 'quantity',

  // unit_price
  'unit price': 'unit_price',
  'price': 'unit_price',
  'unitprice': 'unit_price',
  'selling price': 'unit_price',
  'unit_price': 'unit_price',
  'price per unit': 'unit_price',
  'priceperunit': 'unit_price',

  // total_amount
  'total': 'total_amount',
  'sales amount': 'total_amount',
  'amount': 'total_amount',
  'line total': 'total_amount',
  'linetotal': 'total_amount',
  'grand total': 'total_amount',
  'total_amount': 'total_amount',
  'total amount': 'total_amount',
}

export function normalizeHeader(header: string): string {
  return header
    .toString()
    .trim()
    .toLowerCase()
    // Treat underscores, hyphens, and whitespace as word separators so
    // "Item-Name", "Item_Name", and "Item Name" all normalize to "item name".
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim()
}

export function mapHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header)
  return ALIASES[normalized] ?? null
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    transactionId: null,
    lineId: null,
    date: null,
    time: null,
    itemName: null,
    category: null,
    quantity: null,
    unitPrice: null,
    totalAmount: null,
  }

  // Track which target fields have already been claimed so two source columns
  // can never be mapped to the same target field (no ambiguous mappings).
  const claimedFields = new Set<keyof ColumnMapping>()

  for (const header of headers) {
    const field = mapHeaderToField(header)
    if (!field) continue

    const key =
      field === 'transaction_id'
        ? 'transactionId'
        : field === 'line_id'
          ? 'lineId'
          : field === 'item_name'
            ? 'itemName'
            : field === 'unit_price'
              ? 'unitPrice'
              : field === 'total_amount'
                ? 'totalAmount'
                : (field as keyof ColumnMapping)

    if (claimedFields.has(key)) continue

    mapping[key] = header
    claimedFields.add(key)
  }

  return mapping
}

// ---------------------------------------------------------------
// Excel serial date conversion
// ---------------------------------------------------------------

function excelSerialToDate(serial: number): string | null {
  // Excel serial date starts at 1899-12-30
  const excelEpoch = new Date(1899, 11, 30)
  const ms = excelEpoch.getTime() + serial * 86400000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0]
}

export function parseDateValue(value: unknown): { date: string | null; error: string | null } {
  if (value === null || value === undefined || value === '') {
    return { date: null, error: 'Missing date' }
  }

  // Handle JavaScript Date objects (produced by SheetJS cellDates: true)
  // Use local date components to preserve the calendar date as displayed
  if (value instanceof Date) {
    const d = value
    if (isNaN(d.getTime())) return { date: null, error: 'Invalid date' }
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return { date: `${y}-${m}-${day}`, error: null }
  }

  if (typeof value === 'number') {
    const serialDate = excelSerialToDate(value)
    if (serialDate) return { date: serialDate, error: null }
    return { date: null, error: 'Invalid date serial' }
  }

  const str = String(value).trim()
  // Try ISO date - return directly to avoid timezone issues
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    return { date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, error: null }
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmyMatch) {
    const d = new Date(Date.UTC(parseInt(dmyMatch[3], 10), parseInt(dmyMatch[2], 10) - 1, parseInt(dmyMatch[1], 10)))
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return { date: `${y}-${m}-${day}`, error: null }
    }
  }

  // Try MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (mdyMatch) {
    const d = new Date(Date.UTC(parseInt(mdyMatch[3], 10), parseInt(mdyMatch[1], 10) - 1, parseInt(mdyMatch[2], 10)))
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return { date: `${y}-${m}-${day}`, error: null }
    }
  }

  const parsed = new Date(str)
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear()
    const m = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return { date: `${y}-${m}-${day}`, error: null }
  }

  // Try extracting date from full date-time strings like
  // "Thu Jan 01 2026 00:00:00 GMT+0530 (India Standard Time)"
  const fullDateMatch = str.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/)
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10)
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(fullDateMatch[2]) + 1
    const year = parseInt(fullDateMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, error: null }
    }
  }

  return { date: null, error: 'Unrecognized date format' }
}

// ---------------------------------------------------------------
// Time parsing
// ---------------------------------------------------------------

export function parseTimeValue(value: unknown): { time: string | null; error: string | null } {
  if (value === null || value === undefined || value === '') {
    return { time: null, error: 'Missing time' }
  }

  // Handle JavaScript Date objects (produced by SheetJS cellDates: true)
  if (value instanceof Date) {
    const d = value
    if (isNaN(d.getTime())) return { time: null, error: 'Invalid time' }
    const h = String(d.getUTCHours()).padStart(2, '0')
    const min = String(d.getUTCMinutes()).padStart(2, '0')
    return { time: `${h}:${min}`, error: null }
  }

  if (typeof value === 'number') {
    // Excel time serial: fraction of a day (e.g., 0.5 = 12:00 PM)
    const serial = value
    if (isNaN(serial) || !isFinite(serial) || serial < 0 || serial >= 1) {
      return { time: null, error: 'Invalid time serial' }
    }
    const totalMinutes = Math.round(serial * 24 * 60)
    const h = Math.floor(totalMinutes / 60)
    const min = totalMinutes % 60
    return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, error: null }
  }

  const str = String(value).trim()
  // Try HH:mm:ss
  const hmsMatch = str.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (hmsMatch) {
    const h = parseInt(hmsMatch[1], 10)
    const m = parseInt(hmsMatch[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, error: null }
    }
    return { time: null, error: 'Invalid time format' }
  }

  // Try HH:mm
  const hmMatch = str.match(/^(\d{1,2}):(\d{2})$/)
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10)
    const m = parseInt(hmMatch[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, error: null }
    }
    return { time: null, error: 'Invalid time format' }
  }

  // Try extracting time from full date-time strings like
  // "Sat Dec 30 1899 15:36:00 GMT+0521 (India Standard Time)"
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10)
    const m = parseInt(timeMatch[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, error: null }
    }
  }

  return { time: null, error: 'Unrecognized time format' }
}

// ---------------------------------------------------------------
// Category resolution
// ---------------------------------------------------------------

const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  coffee: 'Coffee',
  tea: 'Tea',
  bakery: 'Bakery',
  'cold beverage': 'Cold Beverage',
  'cold drink': 'Cold Beverage',
  signature: 'Signature',
  merchandise: 'Merchandise',
}

export function resolveCategory(value: string | undefined): ProductCategory {
  if (!value) return 'Unclassified'
  const normalized = normalizeHeader(value)
  return CATEGORY_ALIASES[normalized] ?? 'Unclassified'
}

// ---------------------------------------------------------------
// Numeric parsing
// ---------------------------------------------------------------

export function parseNumber(value: unknown): { number: number | null; error: string | null } {
  if (value === null || value === undefined || value === '') {
    return { number: null, error: 'Missing value' }
  }

  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) return { number: null, error: 'Not a valid number' }
    if (value < 0) return { number: null, error: 'Negative value not allowed' }
    return { number: value, error: null }
  }

  const str = String(value).trim()
  if (str === '') return { number: null, error: 'Missing value' }

  // Remove currency symbols and commas
  const cleaned = str.replace(/[₹$,\s]/g, '')
  const num = parseFloat(cleaned)

  if (isNaN(num) || !isFinite(num)) return { number: null, error: 'Not a valid number' }
  if (num < 0) return { number: null, error: 'Negative value not allowed' }

  return { number: num, error: null }
}

// ---------------------------------------------------------------
// File reading
// ---------------------------------------------------------------

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(file)
  })
}

// ---------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------

export async function parseCsvFile(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const text = await readFileAsText(file)
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          reject(new Error(results.errors[0].message))
          return
        }
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data as Record<string, unknown>[],
        })
      },
      error: reject,
    })
  })
}

// ---------------------------------------------------------------
// XLSX parsing
// ---------------------------------------------------------------

export async function parseXlsxFile(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const buffer = await readFileAsArrayBuffer(file)
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: '' }) as unknown[][]

  if (json.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = json[0].map((h) => String(h ?? '').trim())
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < json.length; i++) {
    const row = json[i]
    const obj: Record<string, unknown> = {}
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] ?? ''
    }
    rows.push(obj)
  }

  return { headers, rows }
}

// ---------------------------------------------------------------
// Main processing
// ---------------------------------------------------------------

export function processRows(
  rows: Record<string, unknown>[],
  headers: string[],
  mapping: ColumnMapping,
): ImportPreview {
  const lines: ProcessedLine[] = []
  const issues: ValidationIssue[] = []
  const seenCompositeKeys = new Set<string>()

  let acceptedCount = 0
  let rejectedCount = 0
  let duplicateCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNumber = i + 2 // +1 for header, +1 for 0-based index

    const transactionId = mapping.transactionId ? String(row[mapping.transactionId] ?? '').trim() : ''
    const lineId = mapping.lineId ? String(row[mapping.lineId] ?? '').trim() : undefined
    const itemName = mapping.itemName ? String(row[mapping.itemName] ?? '').trim() : ''
    const quantityRaw = mapping.quantity ? row[mapping.quantity] : null
    const unitPriceRaw = mapping.unitPrice ? row[mapping.unitPrice] : null
    const totalAmountRaw = mapping.totalAmount ? row[mapping.totalAmount] : null
    const dateRaw = mapping.date ? row[mapping.date] : null
    const timeRaw = mapping.time ? row[mapping.time] : undefined

    const lineIssues: ValidationIssue[] = []

    // Validate required fields
    if (!transactionId) {
      lineIssues.push({ row: rowNumber, field: 'transaction_id', message: 'Missing transaction ID', severity: 'error' })
    }
    if (!itemName) {
      lineIssues.push({ row: rowNumber, field: 'item_name', message: 'Missing item name', severity: 'error' })
    }

    // Parse date
    const dateResult = parseDateValue(dateRaw)
    if (dateResult.error) {
      lineIssues.push({ row: rowNumber, field: 'date', message: dateResult.error, severity: 'error' })
    }

    // Parse time
    const timeResult = parseTimeValue(timeRaw)
    if (timeResult.error && mapping.time) {
      lineIssues.push({ row: rowNumber, field: 'time', message: timeResult.error, severity: 'error' })
    }

    // Parse quantity
    const quantityResult = parseNumber(quantityRaw)
    if (quantityResult.error) {
      lineIssues.push({ row: rowNumber, field: 'quantity', message: quantityResult.error, severity: 'error' })
    }

    // Parse unit price
    const unitPriceResult = parseNumber(unitPriceRaw)
    if (unitPriceResult.error && mapping.unitPrice) {
      lineIssues.push({ row: rowNumber, field: 'unit_price', message: unitPriceResult.error, severity: 'error' })
    }

    // Parse total amount
    const totalAmountResult = parseNumber(totalAmountRaw)
    const totalMissing = mapping.totalAmount && totalAmountResult.error && totalAmountRaw !== null && totalAmountRaw !== undefined && totalAmountRaw !== ''
    if (totalMissing) {
      lineIssues.push({ row: rowNumber, field: 'total_amount', message: totalAmountResult.error ?? 'Invalid total amount', severity: 'error' })
    }

    // Calculate missing line total if sufficient inputs exist
    let quantity = quantityResult.number ?? 0
    let unitPrice = unitPriceResult.number ?? 0
    let lineTotal = totalAmountResult.number

    if (lineTotal === null && quantityResult.number !== null && unitPriceResult.number !== null) {
      lineTotal = Math.round((quantity * unitPrice) * 100) / 100
    }

    // Validate consistency when all three present
    if (lineTotal !== null && quantityResult.number !== null && unitPriceResult.number !== null) {
      const expected = Math.round((quantity * unitPrice) * 100) / 100
      if (Math.abs(lineTotal - expected) > 0.01) {
        lineIssues.push({
          row: rowNumber,
          field: 'total_amount',
          message: `Total amount (${lineTotal}) does not match quantity × unit price (${expected})`,
          severity: 'warning',
        })
      }
    }

    // Composite key uses parsed date (ISO string) for consistency
    const compositeKey = lineId
      ? `${transactionId}|${lineId}`
      : `${transactionId}|${itemName}|${dateResult.date ?? dateRaw}`

    const isDuplicate = seenCompositeKeys.has(compositeKey)
    if (isDuplicate) {
      duplicateCount++
      lineIssues.push({ row: rowNumber, field: 'composite_key', message: 'Duplicate transaction line within this file', severity: 'warning' })
    } else {
      seenCompositeKeys.add(compositeKey)
    }

    const isValid = lineIssues.filter((i) => i.severity === 'error').length === 0

    if (isValid && !isDuplicate) acceptedCount++
    else if (!isValid) rejectedCount++

    const line: ProcessedLine = {
      compositeKey,
      transactionId,
      lineId: lineId ?? undefined,
      date: dateResult.date ?? '',
      time: timeResult.time ?? undefined,
      itemName,
      categoryResolved: resolveCategory(row[mapping.category ?? ''] as string | undefined),
      quantity: quantityResult.number ?? 0,
      unitPriceInr: unitPriceResult.number ?? 0,
      lineTotalInr: lineTotal ?? 0,
      productName: itemName,
      validationIssues: lineIssues,
      isValid,
      isDuplicate,
    }

    lines.push(line)
    issues.push(...lineIssues)
  }

  return {
    totalRows: rows.length,
    acceptedCount,
    rejectedCount,
    duplicateCount,
    columns: headers,
    mappedColumns: mapping,
    sampleRecords: lines.slice(0, 10),
    allLines: lines,
    validationIssues: issues,
    canImport: acceptedCount > 0 && rejectedCount === 0,
  }
}

// ---------------------------------------------------------------
// Data Repair: Fix malformed date/time strings in stored records
// ---------------------------------------------------------------

const CANONICAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CANONICAL_TIME_RE = /^\d{2}:\d{2}$/

export interface RepairResult {
  repaired: number
  unrepaired: number
  unrepairedLines: Array<{
    id: number
    compositeKey: string
    date: string
    time: string | undefined
    reason: string
  }>
}

/**
 * Scans all stored import lines and repairs malformed date/time fields.
 *
 * Idempotent: running multiple times produces no additional changes after
 * the first successful run, because already-canonical values are skipped.
 *
 * Does not modify composite keys (they were computed at import time from
 * raw cell values and must remain stable for deduplication).
 *
 * Uses a single Dexie transaction for all updates.
 */
export async function repairStoredDatesAndTimes(): Promise<RepairResult> {
  const allLines = await db.importLines.toArray()

  let repaired = 0
  let unrepaired = 0
  const unrepairedLines: RepairResult['unrepairedLines'] = []
  const linesToUpdate: Array<ProcessedLine & { id: number }> = []

  for (const line of allLines) {
    let needsRepair = false
    let newDate = line.date
    let newTime = line.time

    // Check date: canonical format is YYYY-MM-DD
    if (line.date && !CANONICAL_DATE_RE.test(line.date)) {
      const parsed = parseDateValue(line.date)
      if (parsed.date && !parsed.error) {
        newDate = parsed.date
        needsRepair = true
      } else {
        unrepaired++
        unrepairedLines.push({
          id: line.id as number,
          compositeKey: line.compositeKey,
          date: line.date,
          time: line.time,
          reason: `Date: ${parsed.error || 'unparseable'}`,
        })
        continue // Skip this line entirely; don't update partial repairs
      }
    }

    // Check time: canonical format is HH:mm
    if (line.time && !CANONICAL_TIME_RE.test(line.time)) {
      const parsed = parseTimeValue(line.time)
      if (parsed.time && !parsed.error) {
        newTime = parsed.time
        needsRepair = true
      } else {
        unrepaired++
        unrepairedLines.push({
          id: line.id as number,
          compositeKey: line.compositeKey,
          date: line.date,
          time: line.time,
          reason: `Time: ${parsed.error || 'unparseable'}`,
        })
        continue
      }
    }

    if (needsRepair) {
      repaired++
      linesToUpdate.push({
        ...line,
        date: newDate,
        time: newTime,
      } as ProcessedLine & { id: number })
    }
  }

  if (linesToUpdate.length > 0) {
    await db.transaction('rw', db.importLines, async () => {
      for (const line of linesToUpdate) {
        await db.importLines.put(line as ProcessedLine & { id: number })
      }
    })
  }

  return { repaired, unrepaired, unrepairedLines }
}
