/**
 * Mist & Mug — Top-Selling Products
 *
 * Product table ranked by total sales revenue.
 * Default: top five products. More Products / Show Less toggles the full list.
 * The section always displays the table (no chart view).
 *
 * All values derive from actual imported transaction data. No hardcoded totals.
 * Category labels come from the saved product catalogue via the analytics
 * projection (stable product ID, then verified normalized product name,
 * otherwise 'Unclassified').
 */

import * as React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { ProductPerformance } from '@/types'

const TOP_N = 5

interface TopSellingProductsProps {
  products: ProductPerformance[]
}

export function TopSellingProducts({ products }: TopSellingProductsProps) {
  const [expanded, setExpanded] = React.useState(false)

  const displayProducts = expanded ? products : products.slice(0, TOP_N)
  const hasMore = products.length > TOP_N

  return (
    <section className="card-premium p-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h3 className="font-serif text-lg text-ink">Top-Selling Products</h3>
      </div>

      {displayProducts.length === 0 ? (
        <p className="text-sm text-rain/60">No product data available for this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Avg Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayProducts.map((p, i) => (
                  <TableRow key={p.productName ?? i}>
                    <TableCell className="text-sm font-medium text-ink">
                      {p.productName}
                    </TableCell>
                    <TableCell className="text-sm text-rain/60">{p.category}</TableCell>
                    <TableCell className="text-sm font-serif text-ink">
                      ₹{p.revenueInr}
                    </TableCell>
                    <TableCell className="text-sm text-right text-ink">{p.quantitySold}</TableCell>
                    <TableCell className="text-sm text-right text-ink">
                      ₹{Math.round(p.averageSellingPrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMore && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setExpanded((prev) => !prev)}>
                {expanded ? 'Show Less' : 'More Products'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
