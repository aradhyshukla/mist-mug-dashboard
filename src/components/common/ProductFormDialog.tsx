import * as React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { type ProductInput } from '@/types'

export interface ProductFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: ProductInput) => void
  editingProduct?: { id: string; name: string; category: string; currentPriceInr: number; description?: string; imageUrl?: string } | null
}

export function ProductFormDialog({ open, onOpenChange, onSave, editingProduct }: ProductFormDialogProps) {
  const [name, setName] = React.useState(editingProduct?.name ?? '')
  const [category, setCategory] = React.useState((editingProduct?.category as any) ?? 'Coffee')
  const [currentPriceInr, setCurrentPriceInr] = React.useState(editingProduct?.currentPriceInr?.toString() ?? '')
  const [description, setDescription] = React.useState(editingProduct?.description ?? '')
  const [imageUrl, setImageUrl] = React.useState(editingProduct?.imageUrl ?? '')
  const [submitting, setSubmitting] = React.useState(false)

  const categories: string[] = ['Coffee', 'Tea', 'Bakery', 'Cold Beverage', 'Signature', 'Merchandise']

  const resetForm = () => {
    setName(editingProduct?.name ?? '')
    setCategory((editingProduct?.category as any) ?? 'Coffee')
    setCurrentPriceInr(editingProduct?.currentPriceInr?.toString() ?? '')
    setDescription(editingProduct?.description ?? '')
    setImageUrl(editingProduct?.imageUrl ?? '')
  }

  // Close the modal on Escape while it is open.
  React.useEffect(() => {
    if (!open) return
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [open, onOpenChange])

  const handleCancel = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const price = parseFloat(currentPriceInr)
    if (!name.trim()) return
    if (isNaN(price) || price < 0) return
    setSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        category: category as any,
        currentPriceInr: price,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
      })
      // Close only after a successful save.
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  // Modal visibility is controlled by React state: nothing is rendered when closed.
  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            Fill in the product details. Prices are in INR (₹).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Product Name</Label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Himalayan Cloud Coffee"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Current Price (INR)</Label>
            <Input
              type="number"
              value={currentPriceInr}
              onChange={(e) => setCurrentPriceInr(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Single-origin pour-over..."
            />
          </div>
          <div className="space-y-2">
            <Label>Image URL (optional)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent text-forest font-medium text-sm rounded-md border border-forest transition-all hover:bg-forest hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              Cancel
            </button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
