import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { SectionHeader } from '@/components/common/EmptyState'
import { ProductCard } from '@/components/common/ProductCard'
import { HeroStrip } from '@/components/layout/HeroStrip'
import { ProductFormDialog } from '@/components/common/ProductFormDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, List, Grid } from 'lucide-react'
import { type Product } from '@/types'
import { cn } from '@/lib/utils'
import { CATEGORY_COLORS } from '@/components/common/ProductCard'
import { getAllProducts, createProduct, updateProduct, deactivateProduct, activateProduct, seedStarterCatalog } from '@/db'
import { onDataChanged, emitDataChanged } from '@/lib/events'

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
  const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid')

  React.useEffect(() => {
    loadProducts()
  }, [])

  React.useEffect(() => {
    const unsubscribe = onDataChanged(() => {
      loadProducts()
    })
    return unsubscribe
  }, [])

  async function loadProducts() {
    setLoading(true)
    setError(null)
    try {
      const existing = await getAllProducts()
      if (existing.length === 0) {
        try {
          await seedStarterCatalog()
        } catch (seedErr) {
          console.error('Catalogue seeding failed', seedErr)
        }
      }
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
    emitDataChanged()
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
        <div className="w-10 h-10 rounded-full border-2 border-terracotta flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-terracotta" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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

  const activeCount = products.filter((p) => p.isActive).length

  return (
    <div className="space-y-8">
      <HeroStrip />
      <SectionHeader
        title="Product Catalogue"
        description={`Manage ${products.length} product${products.length !== 1 ? 's' : ''}. Prices shown are current catalogue prices in INR (₹).`}
        action={
          <div className="flex gap-3 flex-shrink-0">
            <Button variant="brand" size="sm" onClick={() => {
              setEditingProduct(null)
              setDialogOpen(true)
            }}>
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
            <Button variant="brand-gold" size="sm" onClick={() => navigate('/upload')} className="px-6">
              Upload Weekly Sales →
            </Button>
          </div>
        }
      />

      {/* Filters toolbar */}
      <div className="bg-paperSoft border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
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

          {/* Category chips */}
          <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  'chip px-4 py-2 whitespace-nowrap',
                  categoryFilter === cat && 'chip.active',
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* View toggle + Sort */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="flex bg-paperSoft border border-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'w-9 h-9 rounded-md flex items-center justify-center transition-colors',
                  viewMode === 'grid'
                    ? 'bg-forest text-paper shadow-sm'
                    : 'text-rain hover:text-forest',
                )}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'w-9 h-9 rounded-md flex items-center justify-center transition-colors',
                  viewMode === 'list'
                    ? 'bg-forest text-paper shadow-sm'
                    : 'text-rain hover:text-forest',
                )}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="w-40"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Active count pill */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-sage" />
        <span className="text-body text-rain font-medium">{activeCount} of {products.length} products active</span>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.length === 0 ? (
            <div className="lg:col-span-4 empty-state py-8">
              <p className="text-rain/60 text-sm">No products match your filters.</p>
            </div>
          ) : (
            filteredProducts.map((product) => (
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
            ))
          )}
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl">
          <table className="w-full text-sm text-ink">
            <thead>
              <tr className="border-b border-border bg-paperSoft/50">
                <th className="text-left py-4 px-5 text-label text-rain">Image</th>
                <th className="text-left py-4 px-5 text-label text-rain">Product</th>
                <th className="text-left py-4 px-5 text-label text-rain">Category</th>
                <th className="text-right py-4 px-5 text-label text-rain">Price</th>
                <th className="text-center py-4 px-5 text-label text-rain">Status</th>
                <th className="text-right py-4 px-5 text-label text-rain">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-rain/60 text-sm" colSpan={6}>
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const catStyle = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.Coffee
                  return (
                    <tr key={product.id} className="hover:bg-paperSoft/50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center {catStyle.bg} {catStyle.border}">
                          <span className="text-sm">{catStyle.icon}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-medium text-ink">{product.name}</div>
                        <div className="text-[11px] text-rain">{product.category}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          product.isActive
                            ? 'bg-sage/15 text-forest border border-sage/30'
                            : 'bg-terracotta/15 text-terracotta border border-terracotta/30',
                        )}>
                          {product.isActive ? 'Available' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-nums text-ink">
                        ₹{product.currentPriceInr}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {product.isActive ? (
                          <button
                            onClick={() => handleDeactivate(product.id)}
                            className="px-3 py-1.5 rounded-md text-[11px] text-terracotta font-medium border border-terracotta/30 hover:bg-terracotta/10 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(product.id)}
                            className="px-3 py-1.5 rounded-md text-[11px] text-sage font-medium border border-sage/30 hover:bg-sage/10 transition-colors"
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => {
                            setEditingProduct({
                              id: product.id,
                              name: product.name,
                              category: product.category,
                              currentPriceInr: product.currentPriceInr,
                              description: product.description,
                              imageUrl: product.imageUrl,
                            })
                            setDialogOpen(true)
                          }}
                          className="w-8 h-8 rounded-md bg-paperSoft border border-border flex items-center justify-center text-rain hover:text-forest hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSaveProduct}
        editingProduct={editingProduct}
      />
    </div>
  )
}
