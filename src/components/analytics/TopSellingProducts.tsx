/**
 * Mist & Mug — Top-Selling Products
 *
 * Expandable product table with a category-revenue donut-chart view.
 * Default: top five products ranked by total sales revenue.
 * More Products / Show Less toggles the full list. View Pie Chart / View Table
 * switches between the table and the category revenue donut. Expanded/collapsed
 * state is preserved across view switches.
 *
 * All values derive from actual imported transaction data. No hardcoded totals.
 * The donut always represents REVENUE (no Revenue/Quantity toggle).
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
import { CategoryRevenueDonut } from '@/components/analytics/CategoryRevenueDonut'
import type { ProductPerformance } from '@/types'
import type { CategoryRevenue } from '@/lib/analytics'

interface TopSellingProductsProps {
  products: ProductPerformance[]
  categoryRevenue: CategoryRevenue[]
}

const TOP_N = 5

export function TopSellingProducts({ products, categoryRevenue }: TopSellingProductsProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [view, setView] = React.useState<'table' | 'donut'>('table')

  const displayProducts = expanded ? products : products.slice(0, TOP_N)
  const hasMore = products.length > TOP_N

  return (
    <section className="card-premium p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <h3 className="font-serif text-lg text-ink">Top-Selling Products</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setView('donut')}
        >
          View Pie Chart
        </Button>
      </div>

      {view === 'table' ? (
        <>
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
        </>
      ) : (
        <>
          <CategoryRevenueDonut data={categoryRevenue} title="Category Revenue" />
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setView('table')}
            >
              View Table
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
