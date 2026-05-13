import type { MarketplaceOrder } from '@/features/marketplace/types'
import { getConvexClient } from '@/lib/db/convex/client'
import {
  compactJsonPayload,
  compactProviderRequestTrace
} from '@/lib/utils/json-payload'

import { api } from '../../../convex/_generated/api'

export async function listMarketplaceOrders() {
  const rows = await getConvexClient().query(api.orders.listSnapshots, {})

  return Array.isArray(rows)
    ? rows
        .map(normalizeMarketplaceOrder)
        .filter((order): order is MarketplaceOrder => Boolean(order))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
}

export async function getMarketplaceOrderById(orderId: string) {
  const order = await getConvexClient().query(api.orders.getSnapshotByKey, {
    orderKey: orderId
  })

  return normalizeMarketplaceOrder(order)
}

export async function recordMarketplaceOrder(order: MarketplaceOrder) {
  const persistableOrder = createPersistableMarketplaceOrder(order)
  const saved = await getConvexClient().mutation(api.orders.upsertSnapshot, {
    orderKey: order.id,
    orderJson: JSON.stringify(persistableOrder)
  })

  return normalizeMarketplaceOrder(saved) ?? order
}

export async function updateMarketplaceOrder(
  orderId: string,
  updates: Partial<MarketplaceOrder>
) {
  const existing = await getMarketplaceOrderById(orderId)

  if (!existing) {
    return null
  }

  const nextOrder = {
    ...existing,
    ...updates,
    id: existing.id,
    updatedAt: new Date().toISOString()
  }

  return await recordMarketplaceOrder(nextOrder)
}

export async function deleteMarketplaceOrders(orderIds: string[]) {
  return await getConvexClient().mutation(api.orders.deleteSnapshots, {
    orderKeys: orderIds
  })
}

export async function getOrderMetrics() {
  const orders = await listMarketplaceOrders()
  const completed = orders.filter(order => order.status === 'completed')
  const processing = orders.filter(order => order.status === 'processing')
  const paymentRequired = orders.filter(
    order => order.status === 'payment_required'
  )

  return {
    total: orders.length,
    completed: completed.length,
    processing: processing.length,
    paymentRequired: paymentRequired.length
  }
}

function normalizeMarketplaceOrder(value: unknown): MarketplaceOrder | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const order = value as Partial<MarketplaceOrder>

  if (
    typeof order.id === 'string' &&
    typeof order.productSlug === 'string' &&
    typeof order.productName === 'string' &&
    typeof order.providerName === 'string' &&
    typeof order.buyerWallet === 'string' &&
    typeof order.status === 'string' &&
    typeof order.requestId === 'string' &&
    typeof order.createdAt === 'string'
  ) {
    return order as MarketplaceOrder
  }

  return null
}

function createPersistableMarketplaceOrder(
  order: MarketplaceOrder
): MarketplaceOrder {
  return {
    ...order,
    responsePayload: compactJsonPayload(order.responsePayload, 0),
    lockedResponsePayload: compactJsonPayload(order.lockedResponsePayload, 0),
    providerRequest: compactProviderRequestTrace(
      order.providerRequest
    ) as MarketplaceOrder['providerRequest']
  }
}
