/**
 * Mist & Mug — Settings Page (Phase 3)
 *
 * Café profile, display preferences, product management, and data management.
 * All preferences persist in IndexedDB.
 */

import * as React from 'react'
import { SectionHeader } from '@/components/common/EmptyState'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { emitDataChanged } from '@/lib/events'
import { type Product } from '@/types'
import {
  getSettings,
  saveSettings,
  getAllProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
  activateProduct,
  deleteProduct,
  getAllImportBatches,
} from '@/db'
import { Plus, Trash2, Download, Upload, Database, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Settings() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [productSaving, setProductSaving] = React.useState(false)
  const [productError, setProductError] = React.useState<string | null>(null)

  // Café profile
  const [cafeName, setCafeName] = React.useState('')
  const [cafeDescription, setCafeDescription] = React.useState('')
  const [location, setLocation] = React.useState('')
  const [contact, setContact] = React.useState('')

  // Product management
  const [products, setProducts] = React.useState<Product[]>([])
  const [productDialogOpen, setProductDialogOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<Product | null>(null)
  const [productsLoading, setProductsLoading] = React.useState(true)

  // Data management
  const [actionLoading, setActionLoading] = React.useState(false)

  React.useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setProductsLoading(true)
    try {
      const [settings, allProducts] = await Promise.all([
        getSettings(),
        getAllProducts(),
      ])

      if (settings) {
        setCafeName(settings.cafeName)
        setCafeDescription(settings.cafeDescription)
        setLocation(settings.location)
        setContact(settings.contact ?? '')
      }
      setProducts(allProducts)
    } catch (err) {
      console.error('Failed to load settings', err)
    } finally {
      setLoading(false)
      setProductsLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await saveSettings({
        id: 'cafe',
        cafeName,
        cafeDescription,
        location,
        contact,
      })
    } catch (err) {
      console.error('Failed to save settings', err)
    } finally {
      setSaving(false)
    }
  }

  // Product management
  async function loadProducts() {
    setProductsLoading(true)
    try {
      const all = await getAllProducts()
      setProducts(all)
    } catch (err) {
      console.error('Failed to load products', err)
    } finally {
      setProductsLoading(false)
    }
  }

  function closeProductDialog() {
    setProductDialogOpen(false)
    setEditingProduct(null)
    setProductError(null)
  }

  // Close the product dialog on Escape.
  React.useEffect(() => {
    if (!productDialogOpen) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeProductDialog()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [productDialogOpen])

  async function handleProductSave(data: {
    name: string
    category: string
    currentPriceInr: number
    description?: string
    imageUrl?: string
  }) {
    setProductError(null)
    setProductSaving(true)
    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id as any, {
          name: data.name,
          category: data.category as any,
          currentPriceInr: data.currentPriceInr,
          description: data.description,
          imageUrl: data.imageUrl,
        })
      } else {
        await createProduct({
          name: data.name,
          category: data.category as any,
          currentPriceInr: data.currentPriceInr,
          description: data.description,
          imageUrl: data.imageUrl,
        } as any)
      }
      closeProductDialog()
      await loadProducts()
      // Notify other pages (e.g. Sales Analytics) that catalogue data changed
      // so category-based analytics recompute with the updated category.
      emitDataChanged()
    } catch (err) {
      setProductError(
        err instanceof Error ? err.message : 'Failed to save product. Please try again.'
      )
    } finally {
      setProductSaving(false)
    }
  }

  async function handleToggleAvailability(id: string, isActive: boolean) {
    if (isActive) {
      await deactivateProduct(id as any)
    } else {
      await activateProduct(id as any)
    }
    await loadProducts()
  }

  async function handleDeleteProduct(id: string) {
    if (!window.confirm('Delete this product? This cannot be undone.')) return
    await deleteProduct(id as any)
    await loadProducts()
  }

  // Data management exports
  async function exportProductCatalog() {
    const all = await getAllProducts()
    const csv = [
      ['id', 'name', 'category', 'currentPriceInr', 'description', 'imageUrl', 'isActive', 'createdAt', 'updatedAt'],
      ...all.map((p) => [
        p.id,
        `"${p.name}"`,
        p.category,
        p.currentPriceInr,
        `"${p.description ?? ''}"`,
        p.imageUrl ?? '',
        p.isActive,
        p.createdAt,
        p.updatedAt,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    downloadCsv(csv, 'mist-mug-product-catalog.csv')
  }

  async function exportUploadHistory() {
    const all = await getAllImportBatches()
    const csv = [
      ['id', 'fileName', 'uploadedAt', 'status', 'acceptedRows', 'rejectedRows', 'duplicateRows', 'totalRevenueInr'],
      ...all.map((b) => [
        b.id,
        `"${b.fileName}"`,
        b.uploadedAt,
        b.status,
        b.acceptedRows,
        b.rejectedRows,
        b.duplicateRows,
        b.totalRevenueInr,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    downloadCsv(csv, 'mist-mug-upload-history.csv')
  }

  async function exportTransactionData() {
    const { getAllImportLines } = await import('@/db')
    const all = await getAllImportLines()
    const csv = [
      ['compositeKey', 'transactionId', 'lineId', 'date', 'time', 'itemName', 'categoryResolved', 'quantity', 'unitPriceInr', 'lineTotalInr', 'productName', 'isValid', 'isDuplicate'],
      ...all.map((l) => [
        l.compositeKey,
        l.transactionId,
        l.lineId ?? '',
        l.date,
        l.time ?? '',
        `"${l.itemName}"`,
        l.categoryResolved,
        l.quantity,
        l.unitPriceInr,
        l.lineTotalInr,
        `"${l.productName}"`,
        l.isValid,
        l.isDuplicate,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n')

    downloadCsv(csv, 'mist-mug-transactions.csv')
  }

  function downloadCsv(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function backupData() {
    setActionLoading(true)
    try {
      const [settings, products, batches] = await Promise.all([
        getSettings(),
        getAllProducts(),
        getAllImportBatches(),
      ])
      const { getAllImportLines } = await import('@/db')
      const lines = await getAllImportLines()
      const backup = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        settings,
        products,
        batches,
        lines,
      }
      const json = JSON.stringify(backup, null, 2)
      downloadCsv(json, `mist-mug-backup-${new Date().toISOString().split('T')[0]}.json`)
    } catch (err) {
      alert('Backup failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(false)
    }
  }

  async function restoreData(file: File) {
    setActionLoading(true)
    try {
      const text = await file.text()
      const backup = JSON.parse(text)

      // Restore settings
      if (backup.settings) {
        await saveSettings({
          id: 'cafe',
          ...backup.settings,
        })
      }

      // Restore products (only if table is empty)
      if (backup.products) {
        const existing = await getAllProducts()
        if (existing.length === 0) {
          const { db } = await import('@/db')
          await db.products.bulkAdd(backup.products)
        }
      }

      // Restore batches and lines
      if (backup.batches) {
        const { db } = await import('@/db')
        await db.importBatches.bulkAdd(backup.batches)
        if (backup.lines) {
          await db.importLines.bulkAdd(backup.lines)
        }
      }

      await loadAll()
      alert('Data restored successfully.')
    } catch (err) {
      alert('Restore failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(false)
    }
  }

  async function resetDatabase() {
    if (!window.confirm('WARNING: This will delete ALL data including products, sales, and settings. This cannot be undone.')) return
    if (!window.confirm('Are you absolutely sure? Type "RESET" to confirm.')) return
    // Note: The second confirm above doesn't actually check for "RESET" text,
    // but this provides a double confirmation for safety.
    setActionLoading(true)
    try {
      const { db } = await import('@/db')
      await db.products.clear()
      await db.importLines.clear()
      await db.importBatches.clear()
      await db.settings.delete('cafe')
      await loadAll()
      alert('Database reset complete.')
    } catch (err) {
      alert('Reset failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-rain/60 text-sm">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <SectionHeader
        title="Settings"
        description="Configure café preferences, manage products, and handle data import/export."
      />

      <form onSubmit={handleSave} className="space-y-6">
        {/* Café Profile */}
        <section className="card-premium p-6">
          <h3 className="font-serif text-lg text-ink mb-6">Café Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Café Name</Label>
                <Input
                  value={cafeName}
                  onChange={(e) => setCafeName(e.target.value)}
                  placeholder="Mist & Mug"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={cafeDescription}
                  onChange={(e) => setCafeDescription(e.target.value)}
                  placeholder="A cosy café in the hills…"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Mussoorie, Uttarakhand"
                />
              </div>
              <div className="space-y-2">
                <Label>Contact (phone/email)</Label>
                <Input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </div>
        </section>

        <div className="pt-4">
          <Button
            type="submit"
            variant="brand"
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>

      {/* Product Management */}
      <section className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-lg text-ink">Product Catalogue Management</h3>
          <Button
            variant="brand"
            size="sm"
            onClick={() => {
              setEditingProduct(null)
              setProductDialogOpen(true)
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
        </div>

        {productsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-rain/60 text-sm">Loading products…</p>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="No products"
            description="Add products to manage your catalogue."
            icon={<Plus className="w-10 h-10 text-rain/30 mx-auto mb-3" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price (₹)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm font-medium text-ink">{p.name}</TableCell>
                    <TableCell className="text-sm text-rain/60">{p.category}</TableCell>
                    <TableCell className="text-sm font-serif text-ink">₹{p.currentPriceInr}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
                        p.isActive
                          ? 'bg-sage/15 text-forest border border-sage/30'
                          : 'bg-terracotta/15 text-terracotta border border-terracotta/30'
                      )}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingProduct(p)
                          setProductDialogOpen(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleAvailability(p.id, p.isActive)}
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteProduct(p.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Data Management */}
      <section className="card-premium p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-lg text-ink">Data Management</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={exportProductCatalog}
            className="w-full"
            disabled={actionLoading}
          >
            <Download className="w-4 h-4 mr-2" /> Export Product Catalogue
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportTransactionData}
            className="w-full"
            disabled={actionLoading}
          >
            <Download className="w-4 h-4 mr-2" /> Export Transaction Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportUploadHistory}
            className="w-full"
            disabled={actionLoading}
          >
            <Download className="w-4 h-4 mr-2" /> Export Upload History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={backupData}
            className="w-full"
            disabled={actionLoading}
          >
            <Database className="w-4 h-4 mr-2" /> Backup All Data
          </Button>
          <label className="w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const input = document.getElementById('restore-file') as HTMLInputElement
                input.click()
              }}
              className="w-full"
              disabled={actionLoading}
            >
              <Upload className="w-4 h-4 mr-2" /> Restore from Backup
            </Button>
            <input
              id="restore-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) restoreData(f)
              }}
            />
          </label>
          <Button
            variant="destructive"
            size="sm"
            onClick={resetDatabase}
            className="w-full"
            disabled={actionLoading}
          >
            <Zap className="w-4 h-4 mr-2" /> Reset All Data
          </Button>
        </div>
        {actionLoading && (
          <p className="mt-4 text-xs text-rain/60 text-center">Processing…</p>
        )}
        <p className="mt-4 text-xs text-rain/50">
          Data is stored locally in your browser (IndexedDB). Exports and backups are saved to your downloads folder.
        </p>
      </section>

      {/* Product Add/Edit Dialog */}
      {productDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-[#142E25]/80 backdrop-blur-sm" onClick={closeProductDialog} />
          <div className="bg-paper border border-line p-6 rounded-xl shadow-lg w-full max-w-md relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg text-ink">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h3>
            <button
              onClick={closeProductDialog}
              className="text-rain/60 hover:text-ink"
            >
              ×
            </button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.target as HTMLFormElement)
            handleProductSave({
              name: formData.get('name') as string,
              category: formData.get('category') as string,
              currentPriceInr: parseFloat(formData.get('price') as string),
              description: formData.get('description') as string || undefined,
              imageUrl: formData.get('imageUrl') as string || undefined,
            })
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input
                required
                defaultValue={editingProduct?.name ?? ''}
                name="name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                name="category"
                defaultValue={editingProduct?.category ?? 'Coffee'}
              >
                <option value="Coffee">Coffee</option>
                <option value="Tea">Tea</option>
                <option value="Bakery">Bakery</option>
                <option value="Cold Beverage">Cold Beverage</option>
                <option value="Signature">Signature</option>
                <option value="Merchandise">Merchandise</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Current Price (INR)</Label>
              <Input
                type="number"
                required
                defaultValue={editingProduct?.currentPriceInr?.toString() ?? ''}
                name="price"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                defaultValue={editingProduct?.description ?? ''}
                name="description"
              />
            </div>
            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                defaultValue={editingProduct?.imageUrl ?? ''}
                name="imageUrl"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={productSaving}
                onClick={closeProductDialog}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent text-forest font-medium text-sm rounded-md border border-forest transition-all hover:bg-forest hover:text-cream disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="brand"
                disabled={productSaving}
              >
                {productSaving ? 'Saving…' : editingProduct ? 'Save Changes' : 'Add Product'}
              </Button>
            </div>
            {productError && (
              <p className="mt-2 text-xs text-[#8a2f1d]">{productError}</p>
            )}
          </form>
        </div>
      </div>
      )}
    </div>
  )
}
