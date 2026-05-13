import 'server-only'

import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../convex/_generated/api'

export async function listSettlementReceipts() {
  const rows = await getConvexClient().query(api.receipts.listSnapshots, {})

  return Array.isArray(rows)
    ? rows
        .map(normalizeMarketplaceReceipt)
        .filter((receipt): receipt is MarketplaceReceipt => Boolean(receipt))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
}

export async function getMarketplaceReceiptById(receiptId: string) {
  const receipt = await getConvexClient().query(api.receipts.getSnapshotByKey, {
    receiptKey: receiptId
  })

  return normalizeMarketplaceReceipt(receipt)
}

export async function recordMarketplaceReceipt(receipt: MarketplaceReceipt) {
  const saved = await getConvexClient().mutation(api.receipts.upsertSnapshot, {
    receiptKey: receipt.id,
    receiptJson: JSON.stringify(receipt)
  })

  return normalizeMarketplaceReceipt(saved) ?? receipt
}

function normalizeMarketplaceReceipt(
  value: unknown
): MarketplaceReceipt | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const receipt = value as Partial<MarketplaceReceipt>

  if (
    typeof receipt.id === 'string' &&
    typeof receipt.orderId === 'string' &&
    typeof receipt.requestId === 'string' &&
    typeof receipt.productSlug === 'string' &&
    typeof receipt.productName === 'string' &&
    typeof receipt.providerName === 'string' &&
    typeof receipt.amountUsdt === 'string' &&
    typeof receipt.createdAt === 'string'
  ) {
    return receipt as MarketplaceReceipt
  }

  return null
}
