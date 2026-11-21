/**
 * Mist & Mug — Import Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeHeader,
  mapHeaderToField,
  suggestColumnMapping,
  parseDateValue,
  parseTimeValue,
  parseNumber,
  processRows,
} from '@/lib/import'
import { db, saveImportResult, removeImportBatch, seedStarterCatalog, getImportLinesByBatch } from '@/db'
import type { ImportResult, ProcessedLine, Product, ProductId, UploadBatchId } from '@/types'
import { emitDataChanged, onDataChanged } from '@/lib/events'
import { getLatestTransactionDate } from '@/lib/analytics'

describe('normalizeHeader', () => {
  it('normalizes headers to lowercase with single spaces', () => {
    expect(normalizeHeader('Transaction ID')).toBe('transaction id')
    expect(normalizeHeader('Product Name')).toBe('product name')
    expect(normalizeHeader('Sales Amount')).toBe('sales amount')
    expect(normalizeHeader('Transaction_Date')).toBe('transaction date')
  })
})

describe('mapHeaderToField', () => {
  it('maps known aliases to canonical fields', () => {
    expect(mapHeaderToField('Product Name')).toBe('item_name')
    expect(mapHeaderToField('Sales Amount')).toBe('total_amount')
    expect(mapHeaderToField('Transaction Date')).toBe('date')
    expect(mapHeaderToField('Qty')).toBe('quantity')
    expect(mapHeaderToField('Unit Price')).toBe('unit_price')
  })

  it('returns null for unknown headers', () => {
    expect(mapHeaderToField('Random Column')).toBeNull()
  })
})

describe('suggestColumnMapping', () => {
  it('suggests mappings for known columns', () => {
    const mapping = suggestColumnMapping(['Transaction ID', 'Product Name', 'Qty', 'Date'])
    expect(mapping.transactionId).toBe('Transaction ID')
    expect(mapping.itemName).toBe('Product Name')
    expect(mapping.quantity).toBe('Qty')
    expect(mapping.date).toBe('Date')
  })

  it('matches exact headers from the requirements table', () => {
    const mapping = suggestColumnMapping([
      'transaction_id',
      'date',
      'Product Name',
      'quantity',
      'line_id',
      'time',
      'category',
      'unit_price',
      'total_amount',
    ])
    expect(mapping.transactionId).toBe('transaction_id')
    expect(mapping.date).toBe('date')
    expect(mapping.itemName).toBe('Product Name')
    expect(mapping.quantity).toBe('quantity')
    expect(mapping.lineId).toBe('line_id')
    expect(mapping.time).toBe('time')
    expect(mapping.category).toBe('category')
    expect(mapping.unitPrice).toBe('unit_price')
    expect(mapping.totalAmount).toBe('total_amount')
  })

  it('recognizes common aliases', () => {
    const mapping = suggestColumnMapping([
      'Order ID',
      'Sale Date',
      'Product',
      'Qty',
      'Line ID',
      'Transaction Time',
      'Product Category',
      'Price Per Unit',
      'Sales Amount',
    ])
    expect(mapping.transactionId).toBe('Order ID')
    expect(mapping.date).toBe('Sale Date')
    expect(mapping.itemName).toBe('Product')
    expect(mapping.quantity).toBe('Qty')
    expect(mapping.lineId).toBe('Line ID')
    expect(mapping.time).toBe('Transaction Time')
    expect(mapping.category).toBe('Product Category')
    expect(mapping.unitPrice).toBe('Price Per Unit')
    expect(mapping.totalAmount).toBe('Sales Amount')
  })

  it('is case-insensitive', () => {
    const mapping = suggestColumnMapping(['TRANSACTION ID', 'DATE', 'PRODUCT NAME', 'QUANTITY'])
    expect(mapping.transactionId).toBe('TRANSACTION ID')
    expect(mapping.date).toBe('DATE')
    expect(mapping.itemName).toBe('PRODUCT NAME')
    expect(mapping.quantity).toBe('QUANTITY')
  })

  it('handles whitespace variations', () => {
    const mapping = suggestColumnMapping(['  Transaction  ID  ', '  Date  ', '  Product  Name  '])
    expect(mapping.transactionId).toBe('  Transaction  ID  ')
    expect(mapping.date).toBe('  Date  ')
    expect(mapping.itemName).toBe('  Product  Name  ')
  })

  it('handles underscore and hyphen variations', () => {
    const mapping = suggestColumnMapping(['source_line_id', 'Price Per Unit', 'transaction-id'])
    expect(mapping.lineId).toBe('source_line_id')
    expect(mapping.unitPrice).toBe('Price Per Unit')
    expect(mapping.transactionId).toBe('transaction-id')
  })

  it('does not map two source columns to the same target field', () => {
    const mapping = suggestColumnMapping([
      'Transaction ID',
      'Order ID',
      'Date',
      'Product Name',
      'Qty',
    ])
    // Only the first column claiming a field wins; the second is skipped.
    expect(mapping.transactionId).toBe('Transaction ID')
    expect(mapping.date).toBe('Date')
    expect(mapping.itemName).toBe('Product Name')
    expect(mapping.quantity).toBe('Qty')
  })

  it('returns null for fields with no matching header', () => {
    const mapping = suggestColumnMapping(['Random Column', 'Another Column'])
    expect(mapping.transactionId).toBeNull()
    expect(mapping.date).toBeNull()
    expect(mapping.itemName).toBeNull()
    expect(mapping.quantity).toBeNull()
  })

  it('returns all null for empty headers', () => {
    const mapping = suggestColumnMapping([])
    expect(mapping.transactionId).toBeNull()
    expect(mapping.date).toBeNull()
    expect(mapping.itemName).toBeNull()
    expect(mapping.quantity).toBeNull()
    expect(mapping.unitPrice).toBeNull()
    expect(mapping.totalAmount).toBeNull()
  })
})

describe('parseDateValue', () => {
  it('parses ISO date strings', () => {
    const result = parseDateValue('2024-11-04')
    expect(result.date).toBe('2024-11-04')
    expect(result.error).toBeNull()
  })

  it('parses DD/MM/YYYY format', () => {
    const result = parseDateValue('04/11/2024')
    expect(result.date).toBe('2024-11-04')
    expect(result.error).toBeNull()
  })

  it('handles Excel date serials', () => {
    // 45600 is approximately 2024-11-04
    const result = parseDateValue(45636)
    expect(result.date).toBeTruthy()
    expect(result.error).toBeNull()
  })

  it('rejects invalid dates', () => {
    const result = parseDateValue('not-a-date')
    expect(result.date).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('handles empty values', () => {
    const result = parseDateValue('')
    expect(result.date).toBeNull()
    expect(result.error).toBe('Missing date')
  })

  it('parses JavaScript Date objects (SheetJS cellDates output)', () => {
    const date = new Date(Date.UTC(2026, 0, 15)) // 2026-01-15
    const result = parseDateValue(date)
    expect(result.date).toBe('2026-01-15')
    expect(result.error).toBeNull()
  })

  it('rejects invalid Date objects', () => {
    const result = parseDateValue(new Date('invalid'))
    expect(result.date).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('parseTimeValue', () => {
  it('parses JavaScript Date objects', () => {
    const date = new Date(Date.UTC(2026, 0, 15, 14, 30, 0))
    const result = parseTimeValue(date)
    expect(result.time).toBe('14:30')
    expect(result.error).toBeNull()
  })

  it('parses Excel time serials (fraction of day)', () => {
    // 0.5 = 12:00 PM (half of a day)
    const result = parseTimeValue(0.5)
    expect(result.time).toBe('12:00')
    expect(result.error).toBeNull()
  })

  it('parses Excel time serial 0.25 (6:00 AM)', () => {
    const result = parseTimeValue(0.25)
    expect(result.time).toBe('06:00')
    expect(result.error).toBeNull()
  })

  it('parses HH:mm strings', () => {
    const result = parseTimeValue('14:30')
    expect(result.time).toBe('14:30')
    expect(result.error).toBeNull()
  })

  it('parses HH:mm:ss strings', () => {
    const result = parseTimeValue('09:15:45')
    expect(result.time).toBe('09:15')
    expect(result.error).toBeNull()
  })

  it('rejects invalid times', () => {
    const result = parseTimeValue('not-a-time')
    expect(result.time).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('rejects empty values', () => {
    const result = parseTimeValue('')
    expect(result.time).toBeNull()
    expect(result.error).toBe('Missing time')
  })

  it('rejects out-of-range time serials', () => {
    const result = parseTimeValue(1.5)
    expect(result.time).toBeNull()
    expect(result.error).toBeTruthy()
  })
})

describe('processRows', () => {
  it('parses numbers', () => {
    const result = parseNumber(180)
    expect(result.number).toBe(180)
    expect(result.error).toBeNull()
  })

  it('parses currency strings', () => {
    const result = parseNumber('₹1,200.50')
    expect(result.number).toBe(1200.50)
    expect(result.error).toBeNull()
  })

  it('rejects invalid numbers', () => {
    const result = parseNumber('abc')
    expect(result.number).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('rejects negative numbers', () => {
    const result = parseNumber(-5)
    expect(result.number).toBeNull()
    expect(result.error).toBe('Negative value not allowed')
  })
})

describe('processRows', () => {
  const headers = ['Transaction ID', 'Date', 'Item Name', 'Qty', 'Unit Price', 'Total Amount']
  const rows = [
    { 'Transaction ID': 'txn1', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360 },
    { 'Transaction ID': 'txn1', Date: '2024-11-04', 'Item Name': 'Tea', Qty: 1, 'Unit Price': 90, 'Total Amount': 90 },
    { 'Transaction ID': 'txn2', Date: '2024-11-04', 'Item Name': 'Croissant', Qty: 3, 'Unit Price': 160, 'Total Amount': 480 },
  ]

  const mapping = {
    transactionId: 'Transaction ID',
    lineId: null,
    date: 'Date',
    time: null,
    itemName: 'Item Name',
    category: null,
    quantity: 'Qty',
    unitPrice: 'Unit Price',
    totalAmount: 'Total Amount',
  }

  it('processes valid rows correctly', () => {
    const preview = processRows(rows, headers, mapping)
    expect(preview.totalRows).toBe(3)
    expect(preview.acceptedCount).toBe(3)
    expect(preview.rejectedCount).toBe(0)
    expect(preview.canImport).toBe(true)
  })

  it('calculates missing totals', () => {
    const rowsWithoutTotal = [
      { 'Transaction ID': 'txn3', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': '' },
    ]
    const preview = processRows(rowsWithoutTotal, headers, mapping)
    expect(preview.acceptedCount).toBe(1)
    expect(preview.allLines[0].lineTotalInr).toBe(360)
  })

  it('detects duplicates within file', () => {
    const duplicateRows = [
      { 'Transaction ID': 'txn1', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360 },
      { 'Transaction ID': 'txn1', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360 },
    ]
    const preview = processRows(duplicateRows, headers, mapping)
    expect(preview.duplicateCount).toBe(1)
    expect(preview.acceptedCount).toBe(1)
  })

  it('rejects rows with missing required fields', () => {
    const invalidRows = [
      { 'Transaction ID': '', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360 },
    ]
    const preview = processRows(invalidRows, headers, mapping)
    expect(preview.rejectedCount).toBe(1)
    expect(preview.canImport).toBe(false)
  })

  it('processes rows with Date objects as date values (SheetJS cellDates output)', () => {
    const rowsWithDateObjects = [
      { 'Transaction ID': 'txn1', Date: new Date(Date.UTC(2024, 10, 4)), 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360 },
    ]
    const preview = processRows(rowsWithDateObjects, headers, mapping)
    expect(preview.acceptedCount).toBe(1)
    expect(preview.allLines[0].date).toBe('2024-11-04')
  })

  it('processes rows with time serials as time values', () => {
    const rowsWithTimeSerials = [
      { 'Transaction ID': 'txn1', Date: '2024-11-04', 'Item Name': 'Coffee', Qty: 2, 'Unit Price': 180, 'Total Amount': 360, Time: 0.5 }, // 12:00 PM
    ]
    // Add Time to headers
    const headersWithTime = [...headers, 'Time']
    const mappingWithTime = { ...mapping, time: 'Time' }
    const preview = processRows(rowsWithTimeSerials, headersWithTime, mappingWithTime)
    expect(preview.acceptedCount).toBe(1)
    expect(preview.allLines[0].time).toBe('12:00')
  })
})

describe('saveImportResult', () => {
  function makeLine(
    compositeKey: string,
    transactionId: string,
    isValid = true,
    isDuplicate = false,
  ): ProcessedLine {
    return {
      compositeKey,
      transactionId,
      lineId: undefined,
      date: '2024-11-04',
      time: undefined,
      itemName: 'Coffee',
      categoryResolved: 'Coffee',
      quantity: 2,
      unitPriceInr: 180,
      lineTotalInr: 360,
      productId: undefined,
      productName: 'Coffee',
      validationIssues: [],
      isValid,
      isDuplicate,
    }
  }

  function buildResult(lines: ProcessedLine[]): ImportResult & { fileName: string; fileSize: number } {
    const accepted = lines.filter((l) => l.isValid && !l.isDuplicate)
    const rejected = lines.filter((l) => !l.isValid)
    const duplicates = lines.filter((l) => l.isDuplicate)
    return {
      batchId: 'batch_1' as UploadBatchId,
      totalRows: lines.length,
      acceptedRows: accepted.length,
      rejectedRows: rejected.length,
      duplicateRows: duplicates.length,
      lines,
      validationIssues: lines.flatMap((l) => l.validationIssues),
      dateRange: { earliest: '2024-11-04', latest: '2024-11-04' },
      totalRevenueInr: accepted.reduce((sum, l) => sum + l.lineTotalInr, 0),
      status: 'imported',
      fileName: 'test.csv',
      fileSize: 1024,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTransaction = () =>
    vi
      .spyOn(db, 'transaction' as any)
      .mockImplementation(async (...args: any[]) => {
        const fn = args.pop()
        return fn()
      })

  it('stores only accepted (valid, non-duplicate) lines, not within-file duplicates', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    const bulkAddSpy = vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    const putSpy = vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    const lines = [
      makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
      makeLine('txn1|Tea|2024-11-04', 'txn1', true, false),
      makeLine('txn1|Coffee|2024-11-04', 'txn1', true, true), // within-file duplicate
    ]

    await saveImportResult(buildResult(lines))

    expect(putSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'batch_1' }))
    expect(bulkAddSpy).toHaveBeenCalledTimes(1)
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(2)
    expect(stored.map((l) => l.compositeKey)).toEqual([
      'txn1|Coffee|2024-11-04',
      'txn1|Tea|2024-11-04',
    ])
    // No line should have id: 0 (auto-increment PK must not be overridden)
    expect(stored.every((l) => l.id === undefined || l.id !== 0)).toBe(true)
  })

  it('rejects cross-batch duplicates already in the database, storing only new lines', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([
      makeLine('txn1|Coffee|2024-11-04', 'txn1'),
    ])
    const bulkAddSpy = vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    const putSpy = vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    // txn1|Coffee already exists; txn2|Tea is new
    const lines = [
      makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
      makeLine('txn2|Tea|2024-11-04', 'txn2', true, false),
    ]

    await saveImportResult(buildResult(lines))

    expect(putSpy).toHaveBeenCalledTimes(1)
    expect(bulkAddSpy).toHaveBeenCalledTimes(1)
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(1)
    expect(stored[0].compositeKey).toBe('txn2|Tea|2024-11-04')
  })

  it('throws a meaningful error when every accepted line is a cross-batch duplicate', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([
      makeLine('txn1|Coffee|2024-11-04', 'txn1'),
    ])
    vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    const lines = [makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false)]

    await expect(saveImportResult(buildResult(lines))).rejects.toThrow(
      /duplicate compositeKey/,
    )
  })

  it('does not call bulkAdd when there are no accepted lines', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    const bulkAddSpy = vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    const putSpy = vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    // All lines are invalid (rejected), so no accepted lines to store
    const lines = [makeLine('txn1|Coffee|2024-11-04', 'txn1', false, false)]
    lines[0].validationIssues.push({
      row: 2,
      field: 'transaction_id',
      message: 'Missing transaction ID',
      severity: 'error',
    })

    await saveImportResult(buildResult(lines))

    expect(bulkAddSpy).not.toHaveBeenCalled()
    expect(putSpy).toHaveBeenCalledTimes(1)
  })

  it('preserves the batch summary even when no new lines are stored', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    const putSpy = vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    const lines = [makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false)]
    const result = buildResult(lines)

    await saveImportResult(result)

    expect(putSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'batch_1',
        acceptedRows: 1,
        rejectedRows: 0,
        duplicateRows: 0,
        totalRevenueInr: 360,
      }),
    )
  })

  it('stores original filename and file size (not batch ID)', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    const putSpy = vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    const lines = [makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false)]
    const result = buildResult(lines)
    result.fileName = 'weekly-sales-nov.csv'
    result.fileSize = 4096

    await saveImportResult(result)

    expect(putSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'weekly-sales-nov.csv',
        fileSize: 4096,
      }),
    )
  })

  it('returns actual inserted and skipped counts', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([
      makeLine('txn1|Coffee|2024-11-04', 'txn1'), // already exists
    ])
    const bulkAddSpy = vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    // txn1 exists (should be skipped), txn2 is new (should be inserted)
    const lines = [
      makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
      makeLine('txn2|Tea|2024-11-04', 'txn2', true, false),
    ]

    const result = await saveImportResult(buildResult(lines))

    expect(result.insertedRows).toBe(1)
    expect(result.skippedDuplicates).toBe(1)
    expect(bulkAddSpy).toHaveBeenCalledTimes(1)
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(1)
    expect(stored[0].compositeKey).toBe('txn2|Tea|2024-11-04')
  })

  it('strips id from lines before bulkAdd (auto-increment PK)', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    const bulkAddSpy = vi.spyOn(db.importLines, 'bulkAdd').mockResolvedValue(1 as any)
    vi.spyOn(db.importBatches, 'put').mockResolvedValue(undefined as any)
    mockTransaction()

    const lines = [makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false)]
    // Simulate a line that somehow has an id property set
    ;(lines[0] as any).id = 999

    await saveImportResult(buildResult(lines))

    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored[0].id).toBeUndefined()
  })
})

// ============================================================================
// removeImportBatch tests (B-02: batch deletion)
// ============================================================================

describe('removeImportBatch', () => {
  function makeLine(
    compositeKey: string,
    transactionId: string,
    isValid = true,
    isDuplicate = false,
  ): ProcessedLine {
    return {
      compositeKey,
      transactionId,
      lineId: undefined,
      date: '2024-11-04',
      time: undefined,
      itemName: 'Coffee',
      categoryResolved: 'Coffee',
      quantity: 2,
      unitPriceInr: 180,
      lineTotalInr: 360,
      productId: undefined,
      productName: 'Coffee',
      validationIssues: [],
      isValid,
      isDuplicate,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockTransaction = () =>
    vi
      .spyOn(db, 'transaction' as any)
      .mockImplementation(async (...args: any[]) => {
        const fn = args.pop()
        await fn()
      })

  it('filters lines by batchId not transactionId', async () => {
    const linesInDb = [
      { ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false), batchId: 'batch_A' as UploadBatchId, id: 1 },
      { ...makeLine('txn2|Tea|2024-11-04', 'txn2', true, false), batchId: 'batch_B' as UploadBatchId, id: 2 },
      { ...makeLine('txn3|Tea|2024-11-04', 'txn3', true, false), batchId: 'batch_A' as UploadBatchId, id: 3 },
    ]
    const deleteLineSpy = vi.spyOn(db.importLines, 'delete').mockResolvedValue(undefined as any)
    const deleteBatchSpy = vi.spyOn(db.importBatches, 'delete').mockResolvedValue(undefined as any)
    const getBatchSpy = vi.spyOn(db.importBatches, 'get').mockResolvedValue(linesInDb[0] as any)
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue(linesInDb)
    vi.spyOn(db.importLines, 'where').mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(1),
      }),
    } as unknown as any)
    mockTransaction()

    await removeImportBatch('batch_A' as UploadBatchId)

    expect(getBatchSpy).toHaveBeenCalledWith('batch_A')
    expect(deleteBatchSpy).toHaveBeenCalledWith('batch_A')
    expect(deleteLineSpy).toHaveBeenCalledTimes(2)
    const deletedIds = deleteLineSpy.mock.calls.map((call) => call[0])
    expect(deletedIds).toContain(linesInDb[0].id)
    expect(deletedIds).toContain(linesInDb[2].id)
    expect(deletedIds).not.toContain(linesInDb[1].id)
  })

  it('preserves lines shared with other batches', async () => {
    const sharedLine = {
      ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
      batchId: 'batch_A' as UploadBatchId,
      id: 1,
    }
    const linesInDb = [sharedLine]
    const deleteLineSpy = vi.spyOn(db.importLines, 'delete').mockResolvedValue(undefined as any)
    const deleteBatchSpy = vi.spyOn(db.importBatches, 'delete').mockResolvedValue(undefined as any)
    const getBatchSpy = vi.spyOn(db.importBatches, 'get').mockResolvedValue(sharedLine as any)
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue(linesInDb)
    vi.spyOn(db.importLines, 'where').mockReturnValue({
      equals: vi.fn().mockReturnValue({
        count: vi.fn().mockResolvedValue(2),
      }),
    } as unknown as any)
    mockTransaction()

    await removeImportBatch('batch_A' as UploadBatchId)

    expect(getBatchSpy).toHaveBeenCalledWith('batch_A')
    expect(deleteBatchSpy).toHaveBeenCalledWith('batch_A')
    expect(deleteLineSpy).not.toHaveBeenCalled() // shared line is not deleted
  })
})

// ============================================================================
// Issue 1: Catalogue synchronisation tests
// ============================================================================

describe('seedStarterCatalog (catalogue sync)', () => {
  function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'prod_test_' + Math.random().toString(36).slice(2) as ProductId,
      name: 'Test Product',
      category: 'Coffee',
      currentPriceInr: 100,
      description: 'Test',
      imageUrl: undefined,
      isActive: true,
      source: 'user',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  const mockProductDb = (products: Product[]) => {
    vi.spyOn(db.products, 'toArray').mockResolvedValue(products)
    const updateSpy = vi.spyOn(db.products, 'update').mockResolvedValue(undefined as any)
    const bulkAddSpy = vi.spyOn(db.products, 'bulkAdd').mockResolvedValue(undefined as any)
    const countSpy = vi.spyOn(db.products, 'count').mockResolvedValue(products.length)
    return { updateSpy, bulkAddSpy, countSpy }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('seeds website products when database is empty', async () => {
    const { bulkAddSpy } = mockProductDb([])
    await seedStarterCatalog()
    expect(bulkAddSpy).toHaveBeenCalledTimes(1)
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(30) // 30 website products
    // All should be website source
    expect(stored.every((p) => p.source === 'website')).toBe(true)
    // All should use website IDs (m01-m30)
    expect(stored.every((p, i) => p.id === `m${String(i + 1).padStart(2, '0')}`)).toBe(true)
  })

  it('replaces old fictional starter products with website versions', async () => {
    const oldProducts: Product[] = [
      makeProduct({ name: 'Himalayan Cloud Coffee', source: 'starter', id: 'old1' as ProductId }),
      makeProduct({ name: 'Mist & Mug Masala Chai', source: 'starter', id: 'old2' as ProductId }),
      makeProduct({ name: 'Almond Croissant', source: 'starter', id: 'old3' as ProductId }),
    ]
    const { updateSpy, bulkAddSpy } = mockProductDb(oldProducts)
    await seedStarterCatalog()

    // Old fictional products should be updated/deactivated, not left as-is
    const updateCalls = updateSpy.mock.calls
    // Himalayan Cloud Coffee is not on website → should be deactivated
    const coffeeUpdate = updateCalls.find((c) => c[0] === 'old1')
    expect(coffeeUpdate).toBeDefined()
    expect((coffeeUpdate as any[])[1].isActive).toBe(false)

    // Mist & Mug Masala Chai is not on website (Pahadi Masala Chai is) → deactivated
    const chaiUpdate = updateCalls.find((c) => c[0] === 'old2')
    expect(chaiUpdate).toBeDefined()
    expect((chaiUpdate as any[])[1].isActive).toBe(false)

    // Almond Croissant is not on website (French Butter Croissant is) → deactivated
    const croissantUpdate = updateCalls.find((c) => c[0] === 'old3')
    expect(croissantUpdate).toBeDefined()
    expect((croissantUpdate as any[])[1].isActive).toBe(false)

    // All 30 website products should be added
    expect(bulkAddSpy).toHaveBeenCalledTimes(1)
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(30)
  })

  it('preserves user-created products', async () => {
    const userProduct = makeProduct({ name: "User's Special Blend", source: 'user', id: 'user1' as ProductId })
    const { updateSpy } = mockProductDb([userProduct])
    await seedStarterCatalog()
    // User product should NOT be touched
    expect(updateSpy).not.toHaveBeenCalledWith('user1', expect.anything())
  })

  it('does not create duplicate website products if already present', async () => {
    const existingWebsite = makeProduct({
      name: 'Landour Latte',
      source: 'website',
      id: 'm01' as ProductId,
      currentPriceInr: 220,
    })
    const { bulkAddSpy } = mockProductDb([existingWebsite])
    await seedStarterCatalog()
    // Should add 29 website products (m01 already exists), not 30
    const stored = bulkAddSpy.mock.calls[0][0]
    expect(stored).toHaveLength(29)
    expect(stored.some((p) => p.id === 'm01')).toBe(false)
  })

  it('maps website categories to dashboard categories correctly', async () => {
    const { bulkAddSpy } = mockProductDb([])
    await seedStarterCatalog()
    const stored = bulkAddSpy.mock.calls[0][0]

    // COFFEE hot items → Coffee
    const landourLatte = stored.find((p) => p.id === 'm01')
    expect(landourLatte?.category).toBe('Coffee')

    // Cold Brew → Cold Beverage (cold coffee item)
    const coldBrew = stored.find((p) => p.id === 'm06')
    expect(coldBrew?.category).toBe('Cold Beverage')

    // Orange Espresso Tonic → Cold Beverage
    const orangeEspresso = stored.find((p) => p.id === 'm07')
    expect(orangeEspresso?.category).toBe('Cold Beverage')

    // MOUNTAIN WARMERS → Tea
    const masalaChai = stored.find((p) => p.id === 'm09')
    expect(masalaChai?.category).toBe('Tea')

    // BREAKFAST → Bakery
    const croissant = stored.find((p) => p.id === 'm14')
    expect(croissant?.category).toBe('Bakery')

    // SMALL PLATES → Signature
    const cheeseToast = stored.find((p) => p.id === 'm20')
    expect(cheeseToast?.category).toBe('Signature')

    // SWEET → Signature
    const cheesecake = stored.find((p) => p.id === 'm25')
    expect(cheesecake?.category).toBe('Signature')
  })

  it('preserves website product names and prices', async () => {
    const { bulkAddSpy } = mockProductDb([])
    await seedStarterCatalog()
    const stored = bulkAddSpy.mock.calls[0][0]

    // Spot-check several products against website data
    expect(stored.find((p) => p.id === 'm01')?.name).toBe('Landour Latte')
    expect(stored.find((p) => p.id === 'm01')?.currentPriceInr).toBe(220)
    expect(stored.find((p) => p.id === 'm04')?.name).toBe('Espresso')
    expect(stored.find((p) => p.id === 'm04')?.currentPriceInr).toBe(140)
    expect(stored.find((p) => p.id === 'm09')?.name).toBe('Pahadi Masala Chai')
    expect(stored.find((p) => p.id === 'm09')?.currentPriceInr).toBe(130)
    expect(stored.find((p) => p.id === 'm14')?.name).toBe('French Butter Croissant')
    expect(stored.find((p) => p.id === 'm14')?.currentPriceInr).toBe(160)
    expect(stored.find((p) => p.id === 'm25')?.name).toBe('Burnt Basque Cheesecake')
    expect(stored.find((p) => p.id === 'm25')?.currentPriceInr).toBe(260)
    expect(stored.find((p) => p.id === 'm30')?.name).toBe('Walnut Banana Loaf')
    expect(stored.find((p) => p.id === 'm30')?.currentPriceInr).toBe(190)
  })

  it('is idempotent - running twice does not duplicate products', async () => {
    const { bulkAddSpy: bulkAddSpy1 } = mockProductDb([])
    await seedStarterCatalog()
    const firstRunStored = bulkAddSpy1.mock.calls[0][0]
    expect(firstRunStored).toHaveLength(30)

    // Second run: all 30 website products already exist, so no new products added
    mockProductDb(firstRunStored as Product[])
    await seedStarterCatalog()
    const bulkAddSpy2 = vi.spyOn(db.products, 'bulkAdd')
    // If no products need adding, bulkAdd is never called
    if (bulkAddSpy2.mock.calls.length > 0) {
      const secondRunStored = bulkAddSpy2.mock.calls[0][0]
      expect(secondRunStored).toHaveLength(0)
    } else {
      expect(bulkAddSpy2).not.toHaveBeenCalled()
    }
  })
})

// ============================================================================
// Issue 2: Sales upload deletion tests
// ============================================================================

describe('Issue 2: Upload deletion and analytics refresh', () => {
  function makeLine(
    compositeKey: string,
    transactionId: string,
    isValid = true,
    isDuplicate = false,
  ): ProcessedLine {
    return {
      compositeKey,
      transactionId,
      lineId: undefined,
      date: '2024-11-04',
      time: undefined,
      itemName: 'Coffee',
      categoryResolved: 'Coffee',
      quantity: 2,
      unitPriceInr: 180,
      lineTotalInr: 360,
      productId: undefined,
      productName: 'Coffee',
      validationIssues: [],
      isValid,
      isDuplicate,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getImportLinesByBatch', () => {
    it('filters by batchId not transactionId', async () => {
      const lines = [
        { ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false), batchId: 'batch_A' as UploadBatchId },
        { ...makeLine('txn2|Tea|2024-11-04', 'txn2', true, false), batchId: 'batch_B' as UploadBatchId },
      ]
      vi.spyOn(db.importLines, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          toArray: vi.fn().mockResolvedValue([lines[0]]),
        }),
      } as unknown as any)

      const result = await getImportLinesByBatch('batch_A' as UploadBatchId)

      expect(result).toHaveLength(1)
      expect(result[0].transactionId).toBe('txn1')
    })
  })

  describe('emitDataChanged', () => {
    it('dispatches a custom event on window', () => {
      const listener = vi.fn()
      window.addEventListener('mistmug:data-changed', listener)
      emitDataChanged()
      expect(listener).toHaveBeenCalledTimes(1)
      window.removeEventListener('mistmug:data-changed', listener)
    })

    it('onDataChanged subscribes and unsubscribes correctly', () => {
      const listener = vi.fn()
      const unsubscribe = onDataChanged(listener)
      window.dispatchEvent(new CustomEvent('mistmug:data-changed'))
      expect(listener).toHaveBeenCalledTimes(1)
      unsubscribe()
      window.dispatchEvent(new CustomEvent('mistmug:data-changed'))
      expect(listener).toHaveBeenCalledTimes(1) // still 1, unsubscribed
    })
  })

  describe('removeImportBatch with shared lines', () => {
    it('does not delete lines owned by another batch', async () => {
      // txn1 exists in both batch_A and batch_B (same compositeKey)
      const linesInDb = [
        {
          ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
          batchId: 'batch_A' as UploadBatchId,
          id: 1,
        },
        {
          ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false),
          batchId: 'batch_B' as UploadBatchId,
          id: 2,
        },
      ]
      const deleteLineSpy = vi.spyOn(db.importLines, 'delete').mockResolvedValue(undefined as any)
      const deleteBatchSpy = vi.spyOn(db.importBatches, 'delete').mockResolvedValue(undefined as any)
      vi.spyOn(db.importBatches, 'get').mockResolvedValue(linesInDb[0] as any)
      vi.spyOn(db.importLines, 'toArray').mockResolvedValue(linesInDb)
      // compositeKey count = 2 (shared across batches)
      vi.spyOn(db.importLines, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(2),
        }),
      } as unknown as any)
      const mockTransaction = () =>
        vi
          .spyOn(db, 'transaction' as any)
          .mockImplementation(async (...args: any[]) => {
            const fn = args.pop()
            await fn()
          })
      mockTransaction()

      await removeImportBatch('batch_A' as UploadBatchId)

      expect(deleteBatchSpy).toHaveBeenCalledWith('batch_A')
      // Line should NOT be deleted because it's shared with batch_B
      expect(deleteLineSpy).not.toHaveBeenCalled()
    })

    it('deletes lines exclusively owned by the batch', async () => {
      const linesInDb = [
        { ...makeLine('txn1|Coffee|2024-11-04', 'txn1', true, false), batchId: 'batch_A' as UploadBatchId, id: 1 },
        { ...makeLine('txn2|Tea|2024-11-04', 'txn2', true, false), batchId: 'batch_B' as UploadBatchId, id: 2 },
      ]
      const deleteLineSpy = vi.spyOn(db.importLines, 'delete').mockResolvedValue(undefined as any)
      const deleteBatchSpy = vi.spyOn(db.importBatches, 'delete').mockResolvedValue(undefined as any)
      vi.spyOn(db.importBatches, 'get').mockResolvedValue(linesInDb[0] as any)
      vi.spyOn(db.importLines, 'toArray').mockResolvedValue(linesInDb)
      // Each compositeKey count = 1 (exclusive)
      vi.spyOn(db.importLines, 'where').mockReturnValue({
        equals: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(1),
        }),
      } as unknown as any)
      const mockTransaction = () =>
        vi
          .spyOn(db, 'transaction' as any)
          .mockImplementation(async (...args: any[]) => {
            const fn = args.pop()
            await fn()
          })
      mockTransaction()

      await removeImportBatch('batch_A' as UploadBatchId)

      expect(deleteBatchSpy).toHaveBeenCalledWith('batch_A')
      expect(deleteLineSpy).toHaveBeenCalledTimes(1)
      expect(deleteLineSpy).toHaveBeenCalledWith(linesInDb[0].id)
      expect(deleteLineSpy).not.toHaveBeenCalledWith(linesInDb[1].id)
    })
  })
})

// ============================================================================
// Regression: Import → Delete → Reimport date range cycle
// ============================================================================

describe('Issue: Performance Tracker date range after import/delete', () => {
  function makeLine(
    compositeKey: string,
    transactionId: string,
    date: string,
    isValid = true,
    isDuplicate = false,
  ): ProcessedLine {
    return {
      compositeKey,
      transactionId,
      lineId: undefined,
      date,
      time: undefined,
      itemName: 'Coffee',
      categoryResolved: 'Coffee',
      quantity: 2,
      unitPriceInr: 180,
      lineTotalInr: 360,
      productId: undefined,
      productName: 'Coffee',
      validationIssues: [],
      isValid,
      isDuplicate,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getLatestTransactionDate returns latest valid line date', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([
      makeLine('txn1|Coffee|2024-11-01', 'txn1', '2024-11-01', true, false),
      makeLine('txn2|Tea|2024-11-15', 'txn2', '2024-11-15', true, false),
      makeLine('txn3|Tea|2024-11-10', 'txn3', '2024-11-10', true, false),
      makeLine('txn4|Invalid|2024-12-01', 'txn4', '2024-12-01', false, false), // invalid, should be ignored
    ])

    const latest = await getLatestTransactionDate()
    expect(latest).toBe('2024-11-15')
  })

  it('getLatestTransactionDate returns null when no valid lines', async () => {
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    const latest = await getLatestTransactionDate()
    expect(latest).toBeNull()
  })

  it('default dates use transaction dates, not system clock', async () => {
    // Fix system clock to a far-future date to prove we use transaction dates
    vi.spyOn(global.Date, 'now').mockImplementation(() => new Date('2026-11-22T00:00:00Z').getTime())

    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([
      makeLine('txn1|Coffee|2024-11-04', 'txn1', '2024-11-04', true, false),
      makeLine('txn2|Tea|2024-11-04', 'txn2', '2024-11-04', true, false),
    ])

    const latest = await getLatestTransactionDate()
    expect(latest).toBe('2024-11-04') // from data, NOT 2026-11-22

    vi.spyOn(global.Date, 'now').mockRestore()
  })

  it('import → delete → reimport cycle updates dates correctly', async () => {
    // Phase 1: Import Batch A with dates in Nov 2024
    const batchALines = [
      makeLine('txn-A-1|Coffee|2024-11-01', 'txn-A-1', '2024-11-01', true, false),
      makeLine('txn-A-2|Tea|2024-11-02', 'txn-A-2', '2024-11-02', true, false),
    ]
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue(batchALines)

    let latest = await getLatestTransactionDate()
    expect(latest).toBe('2024-11-02')

    // Phase 2: Delete Batch A
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue([])
    latest = await getLatestTransactionDate()
    expect(latest).toBeNull()

    // Phase 3: Reimport Batch A with same dates
    vi.spyOn(db.importLines, 'toArray').mockResolvedValue(batchALines)
    latest = await getLatestTransactionDate()
    expect(latest).toBe('2024-11-02')

    vi.restoreAllMocks()
  })
})


