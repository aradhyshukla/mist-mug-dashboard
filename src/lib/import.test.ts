/**
 * Mist & Mug — Import Utility Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeHeader,
  mapHeaderToField,
  suggestColumnMapping,
  parseDateValue,
  parseNumber,
  processRows,
} from '@/lib/import'
import { db, saveImportResult } from '@/db'
import type { ImportResult, ProcessedLine, UploadBatchId } from '@/types'

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
})

describe('parseNumber', () => {
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

  function buildResult(lines: ProcessedLine[]): ImportResult {
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
})
