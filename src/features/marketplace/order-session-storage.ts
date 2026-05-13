'use client'

import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import type { ProviderRequestTrace } from '@/features/provider-adapters/types'
import { omitIndexedCharacterMaps } from '@/lib/utils/json-payload'

const maxOrderSnapshotBytes = 500_000

export function storeMarketplaceOrderSnapshot(order: MarketplaceOrder) {
  safeSetSessionItem(`app:order:${order.id}`, order, () =>
    createCompactOrderSnapshot(order)
  )
}

export function storeMarketplaceReceiptSnapshot(receipt: MarketplaceReceipt) {
  safeSetSessionItem(`app:receipt:${receipt.id}`, receipt)
}

function safeSetSessionItem(
  key: string,
  value: unknown,
  compactValue?: () => unknown
) {
  try {
    const serialized = JSON.stringify(value)

    if (serialized.length <= maxOrderSnapshotBytes) {
      window.sessionStorage.setItem(key, serialized)
      return
    }
  } catch {
    // Fall through to the compact snapshot.
  }

  if (!compactValue) {
    return
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(compactValue()))
  } catch {
    window.sessionStorage.removeItem(key)
  }
}

function createCompactOrderSnapshot(order: MarketplaceOrder): MarketplaceOrder {
  return {
    ...order,
    providerRequest: createCompactProviderRequest(order.providerRequest),
    responsePayload: createCompactPayload(order.responsePayload),
    lockedResponsePayload: createCompactPayload(order.lockedResponsePayload)
  }
}

function createCompactProviderRequest(
  value: ProviderRequestTrace | undefined
): ProviderRequestTrace | undefined {
  return createCompactPayload(value) as ProviderRequestTrace | undefined
}

function createCompactPayload(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  const normalized = omitIndexedCharacterMaps(value)
  const serialized = JSON.stringify(normalized)

  if (serialized && serialized.length <= 80_000) {
    return normalized
  }

  return {
    status: readStringPath(normalized, 'status'),
    jobId: readStringPath(normalized, 'jobId'),
    publicProjectUrl:
      readStringPath(normalized, 'result.publicProjectUrl') ??
      readStringPath(normalized, 'publicProjectUrl') ??
      readStringPath(normalized, 'previewUrl'),
    cloneUrl:
      readStringPath(normalized, 'result.cloneUrl') ??
      readStringPath(normalized, 'cloneUrl'),
    omittedLargePayload: true
  }
}

function readStringPath(value: unknown, path: string) {
  const result = path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[part]
  }, value)

  return typeof result === 'string' ? result : undefined
}
