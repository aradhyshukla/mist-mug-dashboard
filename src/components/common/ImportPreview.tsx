/**
 * Mist & Mug — Import Preview Component
 *
 * Column mapping interface, validation summary, and import confirmation.
 * Used by the Upload Data page before records are saved to IndexedDB.
 */

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { suggestColumnMapping } from '@/lib/import'
import type {
  ColumnMapping as ColumnMappingType,
  ProcessedLine as ProcessedLineType,
  ValidationIssue as ValidationIssueType,
} from '@/types'

const REQUIRED_FIELDS: Array<{ key: keyof ColumnMappingType; label: string }> = [
  { key: 'transactionId', label: 'Transaction ID' },
  { key: 'date', label: 'Date' },
  { key: 'itemName', label: 'Item Name' },
  { key: 'quantity', label: 'Quantity' },
]

const OPTIONAL_FIELDS: Array<{ key: keyof ColumnMappingType; label: string }> = [
  { key: 'lineId', label: 'Line ID' },
  { key: 'time', label: 'Time' },
  { key: 'category', label: 'Category' },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'totalAmount', label: 'Total Amount' },
]

export interface ImportPreviewProps {
  headers: string[]
  rows: Record<string, unknown>[]
  onImport: (mapping: ColumnMappingType, lines: ProcessedLineType[]) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function ImportPreviewStep({
  headers,
  rows,
  onImport,
  onCancel,
  loading = false,
}: ImportPreviewProps) {
  const [mapping, setMapping] = React.useState<ColumnMappingType>({
    transactionId: null,
    lineId: null,
    date: null,
    time: null,
    itemName: null,
    category: null,
    quantity: null,
    unitPrice: null,
    totalAmount: null,
  })
  const [processed, setProcessed] = React.useState<{
    totalRows: number
    acceptedCount: number
    rejectedCount: number
    duplicateCount: number
    columns: string[]
    mappedColumns: ColumnMappingType
    sampleRecords: ProcessedLineType[]
    allLines: ProcessedLineType[]
    validationIssues: ValidationIssueType[]
    canImport: boolean
  } | null>(null)
  const [step, setStep] = React.useState<'mapping' | 'preview' | 'confirming'>('mapping')

  const isRequired = (key: keyof ColumnMappingType) =>
    REQUIRED_FIELDS.some((f) => f.key === key)

  const handleProcess = () => {
    const lines: ProcessedLineType[] = []
    const issues: ValidationIssueType[] = []
    const seenKeys = new Set<string>()
    let accepted = 0
    let rejected = 0
    let duplicates = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2

      const transactionId = mapping.transactionId ? String(row[mapping.transactionId] ?? '').trim() : ''
      const lineId = mapping.lineId ? String(row[mapping.lineId] ?? '').trim() : undefined
      const itemName = mapping.itemName ? String(row[mapping.itemName] ?? '').trim() : ''
      const dateRaw = mapping.date ? row[mapping.date] : null
      const timeRaw = mapping.time ? String(row[mapping.time] ?? '').trim() : undefined

      const lineIssues: ValidationIssueType[] = []

      if (!transactionId) lineIssues.push({ row: rowNumber, field: 'transaction_id', message: 'Missing transaction ID', severity: 'error' })
      if (!itemName) lineIssues.push({ row: rowNumber, field: 'item_name', message: 'Missing item name', severity: 'error' })
      if (mapping.date) {
        const d = String(dateRaw ?? '')
        if (!d || d === 'null' || d === 'undefined') lineIssues.push({ row: rowNumber, field: 'date', message: 'Missing date', severity: 'error' })
      }

      const quantity = mapping.quantity ? Number(row[mapping.quantity]) : NaN
      if (mapping.quantity && (isNaN(quantity) || quantity < 0)) {
        lineIssues.push({ row: rowNumber, field: 'quantity', message: 'Invalid quantity', severity: 'error' })
      }

      const unitPrice = mapping.unitPrice ? Number(row[mapping.unitPrice]) : NaN
      if (mapping.unitPrice && isNaN(unitPrice)) lineIssues.push({ row: rowNumber, field: 'unit_price', message: 'Invalid unit price', severity: 'error' })

      const totalAmount = mapping.totalAmount ? Number(row[mapping.totalAmount]) : NaN
      if (mapping.totalAmount && isNaN(totalAmount)) lineIssues.push({ row: rowNumber, field: 'total_amount', message: 'Invalid total amount', severity: 'error' })

      let lineTotal = totalAmount
      if ((!mapping.totalAmount || isNaN(totalAmount)) && !isNaN(quantity) && !isNaN(unitPrice)) {
        lineTotal = Math.round((quantity * unitPrice) * 100) / 100
      }

      const compositeKey = lineId ? `${transactionId}|${lineId}` : `${transactionId}|${itemName}|${dateRaw}`
      const isDuplicate = seenKeys.has(compositeKey)
      if (isDuplicate) {
        duplicates++
        lineIssues.push({ row: rowNumber, field: 'composite_key', message: 'Duplicate within file', severity: 'warning' })
      } else {
        seenKeys.add(compositeKey)
      }

      const isValid = lineIssues.filter((i) => i.severity === 'error').length === 0
      if (isValid) {
        accepted++
      } else {
        rejected++
      }

      issues.push(...lineIssues)

      lines.push({
        compositeKey,
        transactionId,
        lineId,
        date: mapping.date ? String(dateRaw ?? '') : '',
        time: timeRaw,
        itemName,
        categoryResolved: 'Coffee',
        quantity: isNaN(quantity) ? 0 : quantity,
        unitPriceInr: isNaN(unitPrice) ? 0 : unitPrice,
        lineTotalInr: isNaN(lineTotal) ? 0 : lineTotal,
        productName: itemName,
        validationIssues: lineIssues,
        isValid,
        isDuplicate,
      })
    }

    setProcessed({
      totalRows: rows.length,
      acceptedCount: accepted,
      rejectedCount: rejected,
      duplicateCount: duplicates,
      columns: headers,
      mappedColumns: mapping,
      sampleRecords: lines.slice(0, 10),
      allLines: lines,
      validationIssues: issues,
      canImport: accepted > 0 && rejected === 0,
    })
    setStep('preview')
  }

  // Automatically detect and map spreadsheet columns when headers change.
  React.useEffect(() => {
    const suggested = suggestColumnMapping(headers)
    setMapping(suggested)
  }, [headers])

  // If every required field is confidently mapped, proceed to the validation
  // preview automatically without requiring manual mapping.
  React.useEffect(() => {
    if (step !== 'mapping' || headers.length === 0) return
    const requiredFields: Array<keyof ColumnMappingType> = [
      'transactionId',
      'date',
      'itemName',
      'quantity',
    ]
    const allRequiredMapped = requiredFields.every((f) => mapping[f] != null)
    if (allRequiredMapped) {
      handleProcess()
      setStep('preview')
    }
  }, [mapping, headers, step, handleProcess])

  const handleConfirm = async () => {
    if (!processed) return
    setStep('confirming')
    await onImport(mapping, processed.allLines)
  }

  const renderMappingRow = (field: { key: keyof ColumnMappingType; label: string }) => {
    const current = mapping[field.key]
    return (
      <TableRow key={field.key}>
        <TableCell className="font-medium text-ink">{field.label}</TableCell>
        <TableCell>
          {isRequired(field.key) && <span className="text-brick text-xs">required</span>}
        </TableCell>
        <TableCell>
          <Select
            value={current ?? ''}
            onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value || null })}
            className="w-full"
          >
            <option value="">— Not mapped —</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </Select>
        </TableCell>
      </TableRow>
    )
  }

  const missingRequired = REQUIRED_FIELDS.some((f) => !mapping[f.key])

  return (
    <div className="space-y-6 max-w-4xl">
      {step === 'mapping' && (
        <>
          <div className="card-premium p-6">
            <h2 className="font-serif text-xl text-ink mb-2">Column Mapping</h2>
            <p className="text-rain/60 text-sm mb-4">
              Match your file's columns to the required fields. Select from the dropdowns below.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Required?</TableHead>
                  <TableHead>Map to column</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map(renderMappingRow)}
              </TableBody>
            </Table>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="brand" onClick={handleProcess} disabled={missingRequired}>
              Continue to Preview
            </Button>
          </div>
        </>
      )}

      {step === 'preview' && processed && (
        <>
          <div className="card-premium p-6">
            <h2 className="font-serif text-xl text-ink mb-2">Import Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-paper rounded-lg border border-line">
                <div className="text-xs text-rain/50 uppercase tracking-wider">Total rows</div>
                <div className="text-xl font-serif text-ink">{processed.totalRows}</div>
              </div>
              <div className="p-4 bg-[#d8e8dc]/30 rounded-lg border border-[#1e5e3a]/30">
                <div className="text-xs text-[#1e5e3a] uppercase tracking-wider">Accepted</div>
                <div className="text-xl font-serif text-[#1e5e3a]">{processed.acceptedCount}</div>
              </div>
              <div className="p-4 bg-[#f5dede]/30 rounded-lg border border-[#8a2f1d]/30">
                <div className="text-xs text-[#8a2f1d] uppercase tracking-wider">Rejected</div>
                <div className="text-xl font-serif text-[#8a2f1d]">{processed.rejectedCount}</div>
              </div>
              <div className="p-4 bg-[#f3e8d3]/30 rounded-lg border border-[#a6533f]/30">
                <div className="text-xs text-[#a6533f] uppercase tracking-wider">Duplicates</div>
                <div className="text-xl font-serif text-[#a6533f]">{processed.duplicateCount}</div>
              </div>
            </div>

            {!processed.canImport && (
              <div className="p-3 rounded bg-[#f5dede]/30 border border-[#8a2f1d]/30 mb-4 text-sm text-[#8a2f1d]">
                Cannot import: {processed.rejectedCount} row(s) have errors. Please fix the source file or adjust mapping.
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.sampleRecords.map((line: ProcessedLineType) => (
                    <TableRow key={line.compositeKey}>
                      <TableCell className="text-xs font-mono text-rain/60">{String(line.compositeKey.split('|')[0])}</TableCell>
                      <TableCell className="text-sm font-medium text-ink">{line.transactionId}</TableCell>
                      <TableCell className="text-sm text-ink">{line.itemName}</TableCell>
                      <TableCell className="text-sm text-ink">{line.quantity}</TableCell>
                      <TableCell className="text-sm text-ink">₹{line.unitPriceInr}</TableCell>
                      <TableCell className="text-sm font-serif text-ink">₹{line.lineTotalInr}</TableCell>
                      <TableCell>
                        {line.isDuplicate ? (
                          <span className="text-xs text-[#a6533f]">Duplicate</span>
                        ) : line.isValid ? (
                          <span className="text-xs text-[#1e5e3a]">Valid</span>
                        ) : (
                          <span className="text-xs text-[#8a2f1d]">Rejected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {processed.sampleRecords.length < processed.allLines.length && (
              <p className="text-xs text-rain/50 mt-2 text-right">
                Showing {processed.sampleRecords.length} of {processed.allLines.length} rows
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-between">
            <Button variant="outline" onClick={() => setStep('mapping')}>
              Back to Mapping
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel Import
            </Button>
            {processed.canImport && (
              <Button variant="brand-gold" onClick={handleConfirm} disabled={loading}>
                Confirm Import ({processed.acceptedCount} rows)
              </Button>
            )}
          </div>
        </>
      )}

      {step === 'confirming' && (
        <div className="card-premium p-12 text-center">
          <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-rain/60 text-sm">Importing records…</p>
        </div>
      )}
    </div>
  )
}
