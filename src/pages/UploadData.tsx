/**
 * Mist & Mug — Upload Data Page (Phase 2)
 *
 * File upload with CSV/XLSX parsing, column mapping, validation preview,
 * atomic import, and past uploads history.
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
import { Upload, FileText, Clock, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ImportPreviewStep } from '@/components/common/ImportPreview'
import { parseCsvFile, parseXlsxFile } from '@/lib/import'
import { saveImportResult, getAllImportBatches, removeImportBatch } from '@/db'
import { emitDataChanged } from '@/lib/events'
import { formatDate } from '@/lib/utils'
import type { ProcessedLine, UploadBatchId } from '@/types'

export function UploadData() {
  const [file, setFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [step, setStep] = React.useState<'idle' | 'mapping' | 'imported'>('idle')
  const [loading, setLoading] = React.useState(false)
  const [batches, setBatches] = React.useState<Array<{
    id: string
    fileName: string
    fileSize: number
    uploadedAt: string
    status: string
    acceptedRows: number
    rejectedRows: number
    duplicateRows: number
    totalRevenueInr: number
    earliestTransactionDate: string | null
    latestTransactionDate: string | null
  }>>([])
  const [headers, setHeaders] = React.useState<string[]>([])
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([])
  const [importMessage, setImportMessage] = React.useState<string | null>(null)

  const [batchesLoading, setBatchesLoading] = React.useState(true)
  const [batchesError, setBatchesError] = React.useState<string | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) await handleFileSelected(droppedFile)
  }
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null
    if (selectedFile) handleFileSelected(selectedFile)
  }

  async function handleFileSelected(selectedFile: File) {
    const ext = selectedFile.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      alert('Please upload a CSV or Excel file.')
      return
    }
    setFile(selectedFile)
    setStep('idle')
    setImportMessage(null)

    try {
      if (ext === 'csv') {
        const { headers: h, rows: r } = await parseCsvFile(selectedFile)
        setHeaders(h)
        setRows(r)
      } else {
        const { headers: h, rows: r } = await parseXlsxFile(selectedFile)
        setHeaders(h)
        setRows(r)
      }
      setStep('mapping')
    } catch (err) {
      alert(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRemoveFile = () => {
    setFile(null)
    setHeaders([])
    setRows([])
    setStep('idle')
    setImportMessage(null)
    // Reset the file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImport = async (_mapping: any, lines: ProcessedLine[]) => {
    setLoading(true)
    setImportMessage(null)
    try {
      if (!file) throw new Error('No file selected')
      const batchId = `batch_${Date.now()}`
      const accepted = lines.filter((l) => l.isValid && !l.isDuplicate)
      const rejected = lines.filter((l) => !l.isValid)
      const duplicates = lines.filter((l) => l.isDuplicate)
      const totalRevenue = accepted.reduce((sum, l) => sum + l.lineTotalInr, 0)
      const dates = accepted.map((l) => l.date).filter(Boolean)
      const earliest = dates.length > 0 ? dates.sort()[0] : null
      const latest = dates.length > 0 ? dates.sort().reverse()[0] : null

      // Tag each line with its originating batch ID before saving
      const taggedLines = lines.map((line) => ({
        ...line,
        batchId: batchId as UploadBatchId,
      }))

      const result = {
        batchId: batchId as any,
        totalRows: lines.length,
        acceptedRows: accepted.length,
        rejectedRows: rejected.length,
        duplicateRows: duplicates.length,
        lines: taggedLines,
        validationIssues: lines.flatMap((l) => l.validationIssues),
        dateRange: { earliest, latest },
        totalRevenueInr: totalRevenue,
        status: 'imported' as const,
        fileName: file.name,
        fileSize: file.size,
      }

      const { insertedRows, skippedDuplicates } = await saveImportResult(result)
      setStep('imported')
      setImportMessage(
        `Imported ${insertedRows} record(s) successfully.${skippedDuplicates > 0 ? ` ${skippedDuplicates} duplicate(s) skipped.` : ''}`,
      )
      await loadBatches()
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadBatches() {
    setBatchesLoading(true)
    setBatchesError(null)
    try {
      const all = await getAllImportBatches()
      setBatches(all)
    } catch (err) {
      setBatchesError(err instanceof Error ? err.message : 'Failed to load upload history')
      setBatches([])
    } finally {
      setBatchesLoading(false)
    }
  }

  const handleRemoveBatch = async (id: string) => {
    if (
      !window.confirm(
        'Remove this upload batch? Transaction lines unique to this batch will be deleted. Lines shared with other batches will be preserved.',
      )
    )
      return
    try {
      await removeImportBatch(id as any)
      await loadBatches()
      // Notify all pages that data has changed so analytics refresh
      emitDataChanged()
    } catch (err) {
      alert(`Failed to remove batch: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  React.useEffect(() => {
    loadBatches()
  }, [])

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Upload Data"
        description="Upload your weekly sales export (CSV or Excel). Map columns, validate, and confirm before importing."
      />

      {step === 'idle' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Zone */}
          <section className="card-premium p-8">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                transition-all duration-200 rounded-xl border-2 border-dashed p-10 text-center
                ${dragActive
                  ? 'bg-[#F0B35A]/10 border-gold text-gold'
                  : 'bg-paper border-line text-rain/60 hover:bg-paper/50 hover:border-rain/40'
                }
              `}
            >
              <Upload className="mx-auto mb-3 w-10 h-10" />
              <p className={dragActive ? 'text-gold font-medium' : 'text-rain/60'}>
                {dragActive ? 'Drop file here' : 'Drag & drop or click to browse'}
              </p>
              <p className="text-xs text-rain/40 mt-1">CSV or Excel (.csv, .xlsx, .xls)</p>
              <Button
                variant="brand"
                size="sm"
                className="w-full"
                type="button"
                onClick={handleBrowseClick}
              >
                Browse files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </section>

          {/* File Preview */}
          {file && (
            <section className="card-premium p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg text-ink">File Preview</h3>
                <Button variant="outline" size="sm" onClick={handleRemoveFile}>
                  Remove
                </Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-paper/50 border border-line">
                  <FileText className="w-5 h-5 text-rain/50" />
                  <div>
                    <div className="text-sm font-medium text-ink truncate max-w-xs">{file.name}</div>
                    <div className="text-xs text-rain/50">
                      {(file.size / 1024).toFixed(1)} KB · {file.type || 'application/octet-stream'}
                    </div>
                  </div>
                </div>
                <div className="bg-[#f5f5f5]/30 border border-line rounded p-3 text-xs font-mono text-rain/60 overflow-x-auto">
                  {`Parsed ${rows.length} row(s) with ${headers.length} column(s).
${headers.join(', ')}`}
                </div>
                <div className="pt-3 border-t border-line">
                  <Button variant="brand-gold" size="sm" onClick={() => setStep('mapping')}>
                    Review & Map Columns
                  </Button>
                  <p className="mt-2 text-xs text-rain/50">Column mapping and validation preview will be shown next.</p>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {step === 'mapping' && headers.length > 0 && (
        <ImportPreviewStep
          headers={headers}
          rows={rows}
          onImport={handleImport}
          onCancel={() => setStep('idle')}
          loading={loading}
        />
      )}

      {step === 'imported' && importMessage && (
        <div className="card-premium p-6 border-[#1e5e3a]/30 bg-[#d8e8dc]/20">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#1e5e3a]" />
            <span className="text-[#1e5e3a] font-medium">{importMessage}</span>
          </div>
          <p className="text-sm text-rain/60 mt-2">Analytics and KPIs have been updated automatically.</p>
          <Button variant="outline" size="sm" onClick={() => {
            setStep('idle')
            setFile(null)
            setImportMessage(null)
            setHeaders([])
            setRows([])
            if (fileInputRef.current) {
              fileInputRef.current.value = ''
            }
          }}>
            Upload Another File
          </Button>
        </div>
      )}

      {/* Past Uploads */}
      <section className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-lg text-ink">Past Uploads</h3>
        </div>

        {batchesLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-rain/60 text-sm">Loading upload history…</p>
          </div>
        ) : batchesError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[#8a2f1d] text-sm mb-4">{batchesError}</p>
            <Button variant="brand" size="sm" onClick={loadBatches}>
              Retry
            </Button>
          </div>
        ) : batches.length === 0 ? (
          <EmptyState
            title="No uploads yet"
            description="Your upload history will appear here once you import sales files."
            icon={<Clock className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Date Range</TableHead>
                  <TableHead>Accepted</TableHead>
                  <TableHead>Rejected</TableHead>
                  <TableHead>Duplicates</TableHead>
                  <TableHead>Revenue (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="text-sm font-medium text-ink truncate max-w-xs">{batch.fileName}</TableCell>
                    <TableCell className="text-sm text-rain/60">
                      {(batch.fileSize / 1024).toFixed(1)} KB
                    </TableCell>
                    <TableCell className="text-sm text-rain/60">{formatDate(batch.uploadedAt)}</TableCell>
                    <TableCell className="text-sm text-rain/60">
                      {batch.earliestTransactionDate && batch.latestTransactionDate
                        ? `${formatDate(batch.earliestTransactionDate)} → ${formatDate(batch.latestTransactionDate)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-ink">{batch.acceptedRows}</TableCell>
                    <TableCell className="text-sm text-[#8a2f1d]">{batch.rejectedRows}</TableCell>
                    <TableCell className="text-sm text-[#a6533f]">{batch.duplicateRows}</TableCell>
                    <TableCell className="text-sm font-serif text-ink">₹{batch.totalRevenueInr}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        batch.status === 'imported'
                          ? 'bg-[#d8e8dc]/60 text-[#1e5e3a] border border-[#1e5e3a]/30'
                          : 'bg-[#f5dede]/60 text-[#8a2f1d] border border-[#8a2f1d]/30'
                      }`}>
                        {batch.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveBatch(batch.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
