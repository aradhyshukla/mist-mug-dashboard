import { type Product } from '@/types'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { PRODUCT_IMAGES, PRODUCT_IMAGES_BY_NAME } from '@/lib/product-images'

type ProductCardProps = {
  product: Product
  onEdit?: (id: string) => void
  onDeactivate?: (id: string) => void
  onActivate?: (id: string) => void
}

export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Coffee: { bg: 'bg-[#8B5A3B]/15', text: 'text-[#8B5A3B]', border: 'border-[#8B5A3B]/30', icon: '☕' },
  Tea: { bg: 'bg-[#8FAE9E]/15', text: 'text-[#8FAE9E]', border: 'border-[#8FAE9E]/30', icon: '🍃' },
  Bakery: { bg: 'bg-[#E8A54B]/15', text: 'text-[#E8A54B]', border: 'border-[#E8A54B]/30', icon: '🥐' },
  'Cold Beverage': { bg: 'bg-[#7A9EBD]/15', text: 'text-[#7A9EBD]', border: 'border-[#7A9EBD]/30', icon: '🧊' },
  Signature: { bg: 'bg-[#C27A5E]/15', text: 'text-[#C27A5E]', border: 'border-[#C27A5E]/30', icon: '✨' },
  Merchandise: { bg: 'bg-[#6E6E7E]/15', text: 'text-[#6E6E7E]', border: 'border-[#6E6E7E]/30', icon: '🛍️' },
}

export function ProductCard({ product, onEdit, onDeactivate, onActivate }: ProductCardProps) {
  const catStyle = CATEGORY_COLORS[product.category] || CATEGORY_COLORS.Coffee
  const [imgError, setImgError] = useState(false)

  // Resolve image for verified website products from the static manifest.
  // Prefer stable product ID (m01-m30); fall back to exact-name match for
  // existing databases where IDs may differ. User-supplied products keep
  // their custom imageUrl.
  const normalizedName = product.name.trim().toLowerCase()
  const imageByName = product.source === 'website'
    ? Object.entries(PRODUCT_IMAGES_BY_NAME).find(([name]) => name.trim().toLowerCase() === normalizedName)?.[1]
    : undefined

  const resolvedImageUrl =
    product.source === 'website'
      ? PRODUCT_IMAGES[product.id] ?? imageByName ?? product.imageUrl
      : product.imageUrl

  return (
    <article
      className={cn(
        'card-premium card-hover p-0 flex flex-col h-full group',
        !product.isActive && 'opacity-60 grayscale-[40%]',
      )}
    >
      {/* Image area */}
      <div className="relative h-48 overflow-hidden rounded-t-xl border-b border-border group-hover:border-gold/50 transition-colors">
        {resolvedImageUrl && !imgError ? (
          <img
            src={resolvedImageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center rounded-t-xl',
            catStyle.bg,
            catStyle.border,
          )}>
            <span className="text-2xl text-rain/40">{catStyle.icon}</span>
            {product.source === 'user' && (
              <button
                className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-6 rounded-full bg-paperSoft/95 border border-border flex items-center justify-center gap-1 text-[10px] text-ink font-medium opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 16c0-1.886 1.584-3.431 3.599-3.576a9 9 0 103.802 3.576C14.416 12.569 16 11.114 16 9.5 16 7.02 14.02 5 12 5S8 7.02 8 9.5zM12 14l7-3-3 4.755V13l-4 3zm0-6l4-4.755V7l-3 3z" />
                </svg>
                Add photo
              </button>
            )}
          </div>
        )}
        {/* Status badge */}
        <span className={cn(
          'absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-medium shadow-sm',
          product.isActive ? 'bg-sage/90 text-paper border border-sage/30' : 'bg-terracotta/90 text-paper border border-terracotta/30',
        )}>
          {product.isActive ? 'Available' : 'Inactive'}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-serif card-title text-ink leading-tight">{product.name}</h3>
          <span className="text-number-xs font-serif text-ink font-nums">₹{product.currentPriceInr}</span>
        </div>
        <p className="text-[12px] text-rain font-sans mb-4 mt-auto">{product.category}</p>

        {/* Footer actions */}
        <div className="border-t border-border pt-3 flex items-center gap-2">
          {product.isActive ? (
            <button
              onClick={() => onDeactivate?.(product.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] text-rain font-medium hover:bg-paperSoft hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20 12H4" />
              </svg>
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => onActivate?.(product.id)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-sage/10 border border-sage/30 text-sage text-[12px] font-medium hover:bg-sage/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Reactivate
            </button>
          )}
          <button
            onClick={() => onEdit?.(product.id)}
            className="w-9 h-9 rounded-md bg-paperSoft border border-border flex items-center justify-center text-rain hover:text-forest hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  )
}
