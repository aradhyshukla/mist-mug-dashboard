/**
 * Mist & Mug — IndexedDB (Dexie) setup
 *
 * Stores: products, transactions, uploadBatches, settings
 * Version 1: initial schema. Phase 2 can add versions/migrations safely.
 */

import Dexie, { Table } from 'dexie'
import type {
  Product,
  ProductId,
  ProductSource,
  TransactionLine,
  UploadBatch,
  UploadBatchId,
  ReportingPeriod,
  ReportingPeriodId,
  Settings,
  ProductInput,
  ProcessedLine,
  ImportResult,
  UploadBatchSummary,
} from './types'
import { VERIFIED_PRODUCTS, websiteProductToInput } from './types'

export class MistMugDB extends Dexie {
  products!: Table<Product, ProductId>
  transactions!: Table<TransactionLine & { id: number }, number>
  uploadBatches!: Table<UploadBatch, UploadBatchId>
  reportingPeriods!: Table<ReportingPeriod, ReportingPeriodId>
  settings!: Table<Settings & { id: string }, string>
  importLines!: Table<ProcessedLine & { id: number }, number>
  importBatches!: Table<UploadBatchSummary & { id: UploadBatchId }, UploadBatchId>

  constructor() {
    super('MistMugDashboard')
    this.version(1).stores({
      products: '++id, name, category, isActive, updatedAt',
      transactions: '++id, productId, category',
      uploadBatches: '++id, fileName, uploadedAt, status, reportingPeriod',
      reportingPeriods: '++id, type, startDate, endDate, createdAt',
      settings: 'id',
    })
    this.version(2).stores({
      products: '++id, name, category, isActive, updatedAt',
      transactions: '++id, productId, category',
      uploadBatches: '++id, fileName, uploadedAt, status, reportingPeriod',
      reportingPeriods: '++id, type, startDate, endDate, createdAt',
      settings: 'id',
      importLines: '++id, compositeKey, transactionId, date, itemName, categoryResolved',
      importBatches: 'id, fileName, uploadedAt, status',
    })
    this.version(3).stores({
      products: '++id, name, category, isActive, updatedAt',
      transactions: '++id, productId, category',
      uploadBatches: '++id, fileName, uploadedAt, status, reportingPeriod',
      reportingPeriods: '++id, type, startDate, endDate, createdAt',
      settings: 'id',
      importLines: '++id, compositeKey, transactionId, date, itemName, categoryResolved, batchId',
      importBatches: 'id, fileName, uploadedAt, status',
    })
    this.version(4).stores({
      products: '++id, name, category, isActive, updatedAt, source',
      transactions: '++id, productId, category',
      uploadBatches: '++id, fileName, uploadedAt, status, reportingPeriod',
      reportingPeriods: '++id, type, startDate, endDate, createdAt',
      settings: 'id',
      importLines: '++id, compositeKey, transactionId, date, itemName, categoryResolved, batchId',
      importBatches: 'id, fileName, uploadedAt, status',
    })
  }
}

export const db = new MistMugDB()

function generateId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// ---------------------------------------------------------------
// Product helpers
// ---------------------------------------------------------------

export async function getAllProducts(): Promise<Product[]> {
  return db.products.toArray()
}

export async function getActiveProducts(): Promise<Product[]> {
  return db.products.filter((p) => p.isActive === true).toArray()
}

export async function getProductById(id: ProductId): Promise<Product | undefined> {
  return db.products.get(id)
}

export async function createProduct(input: ProductInput): Promise<ProductId> {
  const now = new Date().toISOString()
  const product: Product = {
    id: generateId() as ProductId,
    name: input.name,
    category: input.category,
    description: input.description,
    currentPriceInr: input.currentPriceInr,
    imageUrl: input.imageUrl,
    isActive: input.isActive ?? true,
    source: input.source ?? 'user',
    createdAt: now,
    updatedAt: now,
  }
  await db.products.add(product as Product)
  return product.id as ProductId
}

export async function updateProduct(id: ProductId, input: Partial<ProductInput>): Promise<void> {
  const now = new Date().toISOString()
  await db.products.update(id, {
    ...input,
    updatedAt: now,
  } as Partial<Product>)
}

export async function deactivateProduct(id: ProductId): Promise<void> {
  const now = new Date().toISOString()
  await db.products.update(id, { isActive: false, updatedAt: now })
}

export async function activateProduct(id: ProductId): Promise<void> {
  const now = new Date().toISOString()
  await db.products.update(id, { isActive: true, updatedAt: now })
}

export async function deleteProduct(id: ProductId): Promise<void> {
  await db.products.delete(id)
}

// ---------------------------------------------------------------
// Upload batch helpers
// ---------------------------------------------------------------

export async function getAllUploadBatches(): Promise<UploadBatch[]> {
  return db.uploadBatches.orderBy('uploadedAt').reverse().toArray()
}

export async function createUploadBatch(batch: Omit<UploadBatch, 'id'>): Promise<UploadBatchId> {
  const id: UploadBatchId = generateId() as UploadBatchId
  await db.uploadBatches.add({ ...batch, id } as UploadBatch)
  return id
}

export async function getLatestUploadBatch(): Promise<UploadBatch | undefined> {
  return db.uploadBatches.orderBy('uploadedAt').reverse().first()
}

// ---------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.get('cafe')
}

export async function saveSettings(settingsInput: Partial<Settings> & { id: string }): Promise<void> {
  const existing = await db.settings.get('cafe')
  const settings: Settings & { id: string } = {
    id: 'cafe',
    cafeName: settingsInput.cafeName ?? existing?.cafeName ?? 'Mist & Mug',
    cafeDescription: settingsInput.cafeDescription ?? existing?.cafeDescription ?? '',
    location: settingsInput.location ?? existing?.location ?? '',
    currency: settingsInput.currency ?? existing?.currency ?? 'INR',
    theme: settingsInput.theme ?? existing?.theme ?? 'light',
    lowStockThreshold: settingsInput.lowStockThreshold ?? existing?.lowStockThreshold ?? 5,
  } as Settings & { id: string }
  await db.settings.put(settings)
}

// ---------------------------------------------------------------
// Seed starter catalog (only if products table is empty)
// ---------------------------------------------------------------

export const STARTER_PRODUCTS: Array<Omit<ProductInput, 'isActive'>> = [
  {
    name: 'Himalayan Cloud Coffee',
    category: 'Coffee',
    currentPriceInr: 180,
    description: 'Single-origin pour-over brewed with beans from the hills above Mussoorie.',
    source: 'starter',
  },
  {
    name: 'Mist & Mug Masala Chai',
    category: 'Tea',
    currentPriceInr: 90,
    description: 'Traditional spiced tea simmered with cardamom, ginger and clove.',
    source: 'starter',
  },
  {
    name: 'Almond Croissant',
    category: 'Bakery',
    currentPriceInr: 160,
    description: 'Buttery croissant filled with almond frangipane, baked fresh each morning.',
    source: 'starter',
  },
  {
    name: 'Cold Brew with Honey Foam',
    category: 'Cold Beverage',
    currentPriceInr: 190,
    description: 'Slow-steeped cold coffee topped with whipped honey foam.',
    source: 'starter',
  },
  {
    name: 'Signature Mist Latte',
    category: 'Signature',
    currentPriceInr: 210,
    description: 'Espresso, steamed milk and a hint of lavender syrup — our house favourite.',
    source: 'starter',
  },
  {
    name: 'Blueberry Muffin',
    category: 'Bakery',
    currentPriceInr: 140,
    description: 'Moist muffin bursting with plump blueberries and a crumble top.',
    source: 'starter',
  },
  {
    name: 'Iced Matcha',
    category: 'Cold Beverage',
    currentPriceInr: 170,
    description: 'Ceremonial-grade matcha whisked with chilled oat milk.',
    source: 'starter',
  },
  {
    name: 'Mist & Mug Tote',
    category: 'Merchandise',
    currentPriceInr: 450,
    description: 'Organic cotton tote bag with the café logo.',
    source: 'starter',
  },
]

export async function seedStarterCatalog(): Promise<void> {
  const existing = await db.products.toArray()
  const now = new Date().toISOString()

  // Old fictional starter product names (used to identify legacy seeded products
  // that lack a source field)
  const oldStarterNames = new Set(STARTER_PRODUCTS.map((p) => p.name))

  // Website product names (for deduplication)
  // Separate existing products into groups
  const starterProducts: Product[] = []
  const legacyStarterProducts: Product[] = [] // products with old fictional names but no source field
  const otherProducts: Product[] = []

  for (const p of existing) {
    if (p.source === 'starter') {
      starterProducts.push(p)
    } else if (oldStarterNames.has(p.name) && (p.source === 'legacy' || !p.source)) {
      legacyStarterProducts.push(p)
    } else {
      otherProducts.push(p)
    }
  }

  // 1. Replace old fictional starter products with verified website versions
  for (const old of starterProducts) {
    const websiteMatch = VERIFIED_PRODUCTS.find((wp) => wp.name === old.name)
    if (websiteMatch) {
      const input = websiteProductToInput(websiteMatch)
      await db.products.update(old.id as ProductId, {
        name: input.name,
        category: input.category,
        currentPriceInr: input.currentPriceInr,
        description: input.description,
        imageUrl: input.imageUrl,
        source: 'website' as ProductSource,
        updatedAt: now,
      } as Partial<Product>)
    } else {
      // No website match — deactivate, don't delete (preserve history)
      await db.products.update(old.id as ProductId, {
        isActive: false,
        updatedAt: now,
      } as Partial<Product>)
    }
  }

  // 2. Deactivate legacy fictional products (old names, no source field)
  for (const old of legacyStarterProducts) {
    const websiteMatch = VERIFIED_PRODUCTS.find((wp) => wp.name === old.name)
    if (websiteMatch) {
      const input = websiteProductToInput(websiteMatch)
      await db.products.update(old.id as ProductId, {
        name: input.name,
        category: input.category,
        currentPriceInr: input.currentPriceInr,
        description: input.description,
        imageUrl: input.imageUrl,
        source: 'website' as ProductSource,
        updatedAt: now,
      } as Partial<Product>)
    } else {
      await db.products.update(old.id as ProductId, {
        isActive: false,
        updatedAt: now,
      } as Partial<Product>)
    }
  }

  // 3. Add website products not already in the database (by name AND id).
  // Dedup by id as well as name: a product whose id already exists (even under
  // a renamed name) must never be re-inserted via bulkAdd, which would throw a
  // ConstraintError on the primary key.
  const existingNames = new Set(existing.map((p) => p.name.toLowerCase()))
  const existingIds = new Set(existing.map((p) => p.id as unknown as string))
  const newWebsiteProducts = VERIFIED_PRODUCTS.filter(
    (wp) => !existingNames.has(wp.name.toLowerCase()) && !existingIds.has(wp.id)
  )

  if (newWebsiteProducts.length > 0) {
    await db.products.bulkAdd(
      newWebsiteProducts.map((wp) => ({
        ...websiteProductToInput(wp),
        id: wp.id as ProductId, // use website ID as stable identifier
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })) as Product[]
    )
  }
}

// ============================================================================
// Phase 2: Import helpers
// ============================================================================

export async function getAllImportLines(): Promise<ProcessedLine[]> {
  return db.importLines.toArray()
}

export async function getImportLinesByDateRange(startDate: string, endDate: string): Promise<ProcessedLine[]> {
  return db.importLines
    .where('date')
    .between(startDate, endDate)
    .toArray()
}

export async function getImportLinesByBatch(batchId: UploadBatchId): Promise<ProcessedLine[]> {
  return db.importLines.where('batchId').equals(batchId).toArray()
}

export async function getDistinctCompositeKeys(): Promise<string[]> {
  const lines = await db.importLines.toArray()
  return [...new Set(lines.map((l) => l.compositeKey))]
}

export async function compositeKeyExists(compositeKey: string): Promise<boolean> {
  const count = await db.importLines.where('compositeKey').equals(compositeKey).count()
  return count > 0
}

export async function saveImportResult(result: ImportResult & { fileName: string; fileSize: number }): Promise<{ insertedRows: number; skippedDuplicates: number }> {
  const batchId = result.batchId
  const batchSummary: UploadBatchSummary & { id: UploadBatchId } = {
    id: batchId,
    fileName: result.fileName,
    fileSize: result.fileSize,
    uploadedAt: new Date().toISOString(),
    status: result.status,
    acceptedRows: result.acceptedRows,
    rejectedRows: result.rejectedRows,
    duplicateRows: result.duplicateRows,
    totalRevenueInr: result.totalRevenueInr,
    earliestTransactionDate: result.dateRange.earliest,
    latestTransactionDate: result.dateRange.latest,
  }

  // Only persist accepted (valid, non-duplicate) lines. Within-file duplicate
  // lines share the same compositeKey and must not be stored.
  const acceptedLines = result.lines.filter((l) => l.isValid && !l.isDuplicate)

  // Tag each line with its originating batch ID so batch deletion can
  // accurately identify which lines belong to which upload.
  const taggedLines = acceptedLines.map((line) => ({ ...line, batchId }))

  let insertedRows = 0
  let skippedDuplicates = 0

  await db.transaction('rw', db.importBatches, db.importLines, async () => {
    // Reject cross-batch duplicates: any line whose compositeKey already
    // exists in the database must not be re-inserted (would double-count revenue).
    const existingLines = await db.importLines.toArray()
    const existingKeySet = new Set(existingLines.map((l) => l.compositeKey))
    const newLines = taggedLines.filter((l) => !existingKeySet.has(l.compositeKey))
    skippedDuplicates = taggedLines.length - newLines.length

    if (newLines.length === 0 && taggedLines.length > 0) {
      throw new Error(
        'Import aborted: every accepted transaction line already exists in the database (duplicate compositeKey). ' +
          'No records were saved.',
      )
    }

    await db.importBatches.put(batchSummary)
    if (newLines.length > 0) {
      // Dexie's ++id primary key is auto-incremented. Do not pass an explicit id;
      // pass only the ProcessedLine fields and let Dexie assign the id at runtime.
      const linesToStore = newLines.map((line) => {
        const { id, ...rest } = line as ProcessedLine & { id?: number }
        return rest as ProcessedLine
      })
      await db.importLines.bulkAdd(
        linesToStore as unknown as (ProcessedLine & { id: number })[],
      )
      insertedRows = newLines.length
    }
  })

  return { insertedRows, skippedDuplicates }
}

export async function getAllImportBatches(): Promise<UploadBatchSummary[]> {
  return db.importBatches.orderBy('uploadedAt').reverse().toArray()
}

export async function getImportBatch(id: UploadBatchId): Promise<UploadBatchSummary | undefined> {
  return db.importBatches.get(id)
}

export async function removeImportBatch(id: UploadBatchId): Promise<void> {
  const batch = await db.importBatches.get(id)
  if (!batch) return

  const lines = await db.importLines.toArray()
  // Lines are tagged with their originating batchId at import time.
  // Only remove lines that belong exclusively to this batch.
  const linesToDelete = lines.filter((l) => l.batchId === id)

  await db.transaction('rw', db.importLines, db.importBatches, async () => {
    await db.importBatches.delete(id)
    for (const line of linesToDelete) {
      const otherBatches = await db.importLines.where('compositeKey').equals(line.compositeKey).count()
      if (otherBatches <= 1) {
        await db.importLines.delete(line.id as number)
      }
    }
  })
}
