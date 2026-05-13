import { listMarketplaceOrders } from '@/features/marketplace/orders'
import { listSettlementReceipts } from '@/features/marketplace/receipt-store'
import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../convex/_generated/api'

export type ApiProductCategory =
  | 'ai'
  | 'data'
  | 'media'
  | 'agent'
  | 'commerce'
  | 'developer'

export type ApiProductStatus = 'published' | 'draft' | 'paused'
export type ApiProductExecutionMode = 'synchronous' | 'asynchronous'
export type ApiProductSettlementModel =
  | 'pay_on_successful_response'
  | 'pay_on_job_acceptance'
  | 'pay_to_claim_result'
export type ApiProductResultDelivery =
  | 'direct_response'
  | 'poll_or_webhook'
  | 'claim_after_completion'
export type ApiProductAuthType =
  | 'none'
  | 'bearer'
  | 'api_key_header'
  | 'api_key_query'
  | 'basic'
export type ApiProductPricingModel = 'fixed' | 'credit_metered'

export type ApiProductProviderAuth = {
  type: ApiProductAuthType
  headerName?: string
  queryParam?: string
  secret?: string
  username?: string
  password?: string
}

export type ApiProductPollingConfig = {
  statusEndpointUrl?: string
  method: 'GET' | 'POST'
  externalJobIdPath?: string
  statusPath?: string
  resultUrlPath?: string
  errorMessagePath?: string
}

export type ApiProductPricingConfig = {
  model: ApiProductPricingModel
  quoteEndpointUrl?: string
  quoteMethod?: 'GET' | 'POST'
  creditUnitPath?: string
  usageCreditPath?: string
  creditToUsdtRate?: number
  multiplier?: number
  minimumChargeUsd?: number
  maximumChargeUsd?: number
}

export type ApiProduct = {
  slug: string
  name: string
  ownerWallet?: `0x${string}`
  providerName: string
  providerSlug: string
  providerWallet: `0x${string}`
  category: ApiProductCategory
  description: string
  priceUsd: number
  priceLabel: string
  pricing: ApiProductPricingConfig
  method: 'GET' | 'POST'
  endpointPath: string
  providerEndpointUrl?: string
  providerAuth?: ApiProductProviderAuth
  polling?: ApiProductPollingConfig
  timeoutSeconds?: number
  estimatedLatency: string
  executionMode: ApiProductExecutionMode
  settlementModel: ApiProductSettlementModel
  resultDelivery: ApiProductResultDelivery
  requestSchema: Record<string, string>
  responseSchema: Record<string, string>
  referencePayload: Record<string, unknown>
  isX402Protected: boolean
  isAgentReady: boolean
  status: ApiProductStatus
  featured?: boolean
  calls: number
  successRate: string
  revenueUsdt: string
}

export async function getPublishedProducts() {
  const products = await getAllProducts()

  return products.filter(product => product.status === 'published')
}

export async function getProviderOwnedProducts(ownerWallet?: string | null) {
  if (!ownerWallet) {
    return []
  }

  const normalizedOwner = ownerWallet.toLowerCase()
  const products = await getAllProducts()

  return products.filter(
    product => product.ownerWallet?.toLowerCase() === normalizedOwner
  )
}

export async function getProviderPublishedProducts(
  ownerWallet?: string | null
) {
  const products = await getProviderOwnedProducts(ownerWallet)

  return products.filter(product => product.status === 'published')
}

export async function getAllProducts() {
  const [providerProducts, orders, receipts] = await Promise.all([
    readProviderProducts(),
    listMarketplaceOrders(),
    listSettlementReceipts()
  ])

  return providerProducts
    .map(withDisplayPriceLabel)
    .map(product => withUsageMetrics(product, orders, receipts))
}

export async function getFeaturedProduct() {
  const publishedProducts = await getPublishedProducts()

  return (
    publishedProducts.find(product => product.featured) ?? publishedProducts[0]
  )
}

export async function getProductBySlug(slug: string) {
  const products = await getAllProducts()

  return products.find(product => product.slug === slug)
}

export async function recordProviderProduct({
  product,
  userId
}: {
  product: ApiProduct
  userId: string
}) {
  const created = await getConvexClient().mutation(
    api.apiProducts.createProviderCatalogProduct,
    {
      userId: userId as any,
      providerSlug: product.providerSlug,
      slug: product.slug,
      name: product.name,
      description: product.description,
      category: product.category,
      priceUsd: product.priceUsd,
      priceLabel: product.priceLabel,
      endpointUrl: product.providerEndpointUrl ?? product.endpointPath,
      method: product.method,
      estimatedLatency: product.estimatedLatency,
      executionMode: product.executionMode,
      settlementModel: product.settlementModel,
      resultDelivery: product.resultDelivery,
      authType: product.providerAuth?.type ?? 'none',
      authHeaderName: product.providerAuth?.headerName,
      authQueryParam: product.providerAuth?.queryParam,
      timeoutSeconds: product.timeoutSeconds,
      requestSchemaJson: JSON.stringify(product.requestSchema),
      responseSchemaJson: JSON.stringify(product.responseSchema),
      demoPayloadJson: JSON.stringify(product.referencePayload),
      productJson: JSON.stringify(product),
      isX402Protected: product.isX402Protected,
      isAgentReady: product.isAgentReady,
      status: product.status
    }
  )

  return normalizeConvexProduct(created) ?? product
}

export async function updateProviderProductStatus(
  slug: string,
  status: ApiProductStatus,
  ownerWallet?: string | null
) {
  if (!ownerWallet) {
    return null
  }

  const product = await getConvexClient().mutation(
    api.apiProducts.updateProviderCatalogStatus,
    { slug, status, ownerWallet }
  )

  return normalizeConvexProduct(product)
}

export async function deleteProviderProduct(
  slug: string,
  ownerWallet?: string | null
) {
  if (!ownerWallet) {
    return null
  }

  const product = await getConvexClient().mutation(
    api.apiProducts.deleteProviderCatalogProduct,
    { slug, ownerWallet }
  )

  return normalizeConvexProduct(product)
}

export async function deleteAdminProviderProducts(slugs: string[]) {
  return await getConvexClient().mutation(
    api.apiProducts.deleteProviderCatalogProducts,
    { slugs }
  )
}

export async function deleteProviderProducts(
  slugs: string[],
  ownerWallet?: string | null
) {
  if (!ownerWallet) {
    return 0
  }

  return await getConvexClient().mutation(
    api.apiProducts.deleteProviderCatalogProducts,
    { slugs, ownerWallet }
  )
}

export async function getMarketplaceMetrics() {
  const products = await getPublishedProducts()
  const totalCalls = products.reduce((sum, product) => sum + product.calls, 0)
  const totalRevenue = products.reduce(
    (sum, product) => sum + Number(product.revenueUsdt),
    0
  )

  return {
    productCount: products.length,
    totalCalls,
    totalRevenueUsdt: totalRevenue.toFixed(2),
    platformFeeBps: 500,
    providerShareBps: 9500,
    platformFeeRangeLabel: '1-5%',
    providerShareRangeLabel: '95-99%'
  }
}

export async function getProviderDashboardMetrics(ownerWallet?: string | null) {
  const products = await getProviderOwnedProducts(ownerWallet)
  const [allOrders, allReceipts] = await Promise.all([
    listMarketplaceOrders(),
    listSettlementReceipts()
  ])
  const productSlugs = new Set(products.map(product => product.slug))
  const orders = allOrders.filter(order => productSlugs.has(order.productSlug))
  const receipts = allReceipts.filter(receipt =>
    productSlugs.has(receipt.productSlug)
  )
  const completedOrders = orders.filter(isCompletedProviderOrder)
  const failedOrders = orders.filter(order => order.status === 'failed')
  const processingOrders = orders.filter(order =>
    ['paid', 'processing', 'ready', 'delta_payment_required'].includes(
      order.status
    )
  )
  const providerRevenue = receipts
    .filter(receipt => isProviderEarningReceipt(receipt.orderId, allOrders))
    .reduce((sum, receipt) => sum + parseUsdt(receipt.providerAmountUsdt), 0)
  const grossVolume = receipts.reduce(
    (sum, receipt) => sum + parseUsdt(receipt.amountUsdt),
    0
  )

  return {
    productCount: products.length,
    orderCount: orders.length,
    completedCalls: completedOrders.length,
    failedCalls: failedOrders.length,
    processingCalls: processingOrders.length,
    grossVolumeUsdt: grossVolume.toFixed(2),
    providerRevenueUsdt: providerRevenue.toFixed(2),
    platformFeeUsdt: Math.max(0, grossVolume - providerRevenue).toFixed(2),
    successRate:
      orders.length > 0
        ? `${Math.round((completedOrders.length / orders.length) * 100)}%`
        : 'No calls yet'
  }
}

export async function getProviderOrders(ownerWallet?: string | null) {
  const products = await getProviderOwnedProducts(ownerWallet)
  const orders = await listMarketplaceOrders()
  const productSlugs = new Set(products.map(product => product.slug))

  return orders.filter(order => productSlugs.has(order.productSlug))
}

async function readProviderProducts() {
  try {
    const rows = await getConvexClient().query(
      api.apiProducts.listProviderCatalog,
      {}
    )

    return Array.isArray(rows)
      ? rows
          .map(normalizeConvexProduct)
          .filter((product): product is ApiProduct => Boolean(product))
      : []
  } catch {
    return []
  }
}

function withDisplayPriceLabel(product: ApiProduct): ApiProduct {
  if (product.pricing.model !== 'credit_metered') {
    return product
  }

  if (product.priceLabel === 'Metered quote') {
    return product
  }

  return {
    ...product,
    priceLabel: 'Metered quote'
  }
}

function withUsageMetrics(
  product: ApiProduct,
  orders: MarketplaceOrder[],
  receipts: MarketplaceReceipt[]
): ApiProduct {
  const productOrders = orders.filter(
    order => order.productSlug === product.slug
  )
  const completedOrders = productOrders.filter(isCompletedProviderOrder)
  const productReceipts = receipts.filter(
    receipt => receipt.productSlug === product.slug
  )
  const revenue = productReceipts
    .filter(receipt => isProviderEarningReceipt(receipt.orderId, orders))
    .reduce((sum, receipt) => sum + parseUsdt(receipt.providerAmountUsdt), 0)

  return {
    ...product,
    calls: productOrders.length,
    successRate:
      productOrders.length > 0
        ? `${Math.round((completedOrders.length / productOrders.length) * 100)}%`
        : product.successRate,
    revenueUsdt: revenue.toFixed(2)
  }
}

function isCompletedProviderOrder(order: MarketplaceOrder) {
  return (
    order.status === 'completed' ||
    order.resultReleaseStatus === 'released' ||
    order.escrowStatus === 'released'
  )
}

function isProviderEarningReceipt(orderId: string, orders: MarketplaceOrder[]) {
  const order = orders.find(item => item.id === orderId)

  if (!order) {
    return false
  }

  return isCompletedProviderOrder(order)
}

function parseUsdt(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function normalizeConvexProduct(value: unknown): ApiProduct | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const product = value as Partial<ApiProduct>

  if (
    typeof product.slug === 'string' &&
    typeof product.name === 'string' &&
    typeof product.providerName === 'string' &&
    typeof product.endpointPath === 'string' &&
    ['draft', 'published', 'paused'].includes(String(product.status))
  ) {
    return product as ApiProduct
  }

  return null
}
