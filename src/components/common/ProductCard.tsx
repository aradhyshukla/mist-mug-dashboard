import { type Product } from '@/types'

type ProductCardProps = {
  product: Product
  onEdit?: (id: string) => void
  onDeactivate?: (id: string) => void
  onActivate?: (id: string) => void
}

export function ProductCard({ product, onEdit, onDeactivate, onActivate }: ProductCardProps) {
  return (
    <div className="card-premium p-5 flex flex-col gap-4 h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={product.isActive ? 'badge-available' : 'badge-deactivated'}>
              {product.isActive ? 'Available' : 'Deactivated'}
            </span>
          </div>
          <h3 className="font-serif text-lg text-ink leading-tight">{product.name}</h3>
          <p className="text-sm text-rain/60">{product.category}</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-serif text-ink">₹{product.currentPriceInr}</span>
        </div>
      </div>

      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-32 w-full object-cover rounded-lg border border-line"
        />
      ) : (
        <div className="h-32 w-full flex items-center justify-center rounded-lg border border-line border-dashed bg-paper/50 text-rain/40">
          <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-xs">No image</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-auto">
        {product.isActive ? (
          <button
            onClick={() => onDeactivate?.(product.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rain/60 hover:bg-paper/50 hover:text-ink transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M20 12H4" />
            </svg>
            Deactivate
          </button>
        ) : (
          <button
            onClick={() => onActivate?.(product.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#d8e8dc]/60 text-[#1e5e3a] border border-[#1e5e3a]/30 hover:bg-[#d8e8dc] transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            Activate
          </button>
        )}
        <button
          onClick={() => onEdit?.(product.id)}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-rain/60 hover:bg-paper/50 transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  )
}
