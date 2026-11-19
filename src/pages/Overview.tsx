import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionHeader } from '@/components/common/EmptyState'
import { ProductCard } from '@/components/common/ProductCard'
import { ProductFormDialog } from '@/components/common/ProductFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { type Product } from '@/types'
import { getAllProducts, createProduct, updateProduct, deactivateProduct, activateProduct, seedStarterCatalog } from '@/db'

export const CATEGORIES = ['All', 'Coffee', 'Tea', 'Bakery', 'Cold Beverage', 'Signature', 'Merchandise'] as const

export function Overview() {
  const navigate = useNavigate()
  const [products, setProducts] = React.useState<Product[]>([])
  const [search, setSearch] = React.useState('')
  const [categoryFilter, setCategoryFilter] = React.useState<'All' | string>('All')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingProduct, setEditingProduct] = React.useState<{
    id: string
    name: string
    category: string
    currentPriceInr: number
    description?: string
    imageUrl?: string
  } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    loadProducts()
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError(null)
    try {
      await seedStarterCatalog()
      const all = await getAllProducts()
      setProducts(all)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalogue')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'All' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  async function handleSaveProduct(data: {
    name: string
    category: string
    currentPriceInr: number
    description?: string
    imageUrl?: string
  }) {
    if (editingProduct?.id) {
      await updateProduct(editingProduct.id as any, {
        name: data.name,
        category: data.category as any,
        currentPriceInr: data.currentPriceInr,
        description: data.description,
        imageUrl: data.imageUrl,
      })
      setEditingProduct(null)
    } else {
      await createProduct({
        name: data.name,
        category: data.category as any,
        currentPriceInr: data.currentPriceInr,
        description: data.description,
        imageUrl: data.imageUrl,
      } as any)
    }
    setDialogOpen(false)
    const all = await getAllProducts()
    setProducts(all)
  }

  async function handleDeactivate(id: string) {
    await deactivateProduct(id as any)
    const all = await getAllProducts()
    setProducts(all)
  }

  async function handleActivate(id: string) {
    await activateProduct(id as any)
    const all = await getAllProducts()
    setProducts(all)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="h-8 w-8 rounded-full border-2 border-gold border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-rain/60 text-sm">Loading catalogue…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-10 h-10 rounded-full border-2 border-brick flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-brick" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-rain/60 text-sm mb-4">{error}</p>
        <Button variant="brand" onClick={loadProducts}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <section className="card-premium p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-gold flex items-center justify-center">
              <svg className="w-6 h-6 text-coffee" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 19a2 2 0 012-2h7a2 2 0 012 2v3a2 2 0 01-2 2H7a2 2 0 01-2-2v-3z" />
                <path d="M12 17a2 2 0 012-2h7a2 2 0 012 2v3a2 2 0 01-2 2h-7a2 2 0 01-2-2v-3z" />
                <path d="M3 3l9 9M7 7l9 9" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif text-2xl text-ink">Mist & Mug</h1>
              <p className="text-sm text-rain/60 uppercase tracking-wider font-medium">Café Sales Dashboard</p>
            </div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-sm text-ink mb-1">Mussoorie, Uttarakhand · 2,005 m above sea level</p>
            <p className="text-xs text-rain/50">Owner dashboard · Product management · Sales analytics</p>
          </div>
        </div>

        <p className="text-rain/70 text-sm max-w-2xl">
          Welcome back. Manage your café’s product catalogue below. Changes are saved automatically and
          persist across sessions. Use the Quick Upload button to import your weekly sales file when ready.
        </p>
      </section>

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1">
          <SectionHeader
            title="Product Catalogue"
            description={`Manage ${products.length} product${products.length !== 1 ? 's' : ''}. Prices shown are current catalogue prices in INR (₹).`}
            action={
              <Button variant="brand" size="sm" onClick={() => {
                setEditingProduct(null)
                setDialogOpen(true)
              }}>
                <Plus className="w-4 h-4 mr-2" /> Add Product
              </Button>
            }
          />
        </div>
        <div className="flex-shrink-0">
          <Button variant="brand-gold" size="sm" onClick={() => navigate('/upload')} className="px-6">
            Upload Weekly Sales →
          </Button>
        </div>
      </div>

      <div className="bg-paper rounded-xl border border-line p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-rain/40" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <Input
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as any)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="empty-state py-8">
            <p className="text-rain/60 text-sm">No products match your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(id) => {
                  const p = products.find((x) => x.id === id)
                  if (p) {
                    setEditingProduct({
                      id: p.id,
                      name: p.name,
                      category: p.category,
                      currentPriceInr: p.currentPriceInr,
                      description: p.description,
                      imageUrl: p.imageUrl,
                    })
                    setDialogOpen(true)
                  }
                }}
                onDeactivate={handleDeactivate}
                onActivate={handleActivate}
              />
            ))}
          </div>
        )}
      </div>

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
      />
    </div>
  )
}
