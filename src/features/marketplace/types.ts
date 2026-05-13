import { orderStatuses } from '@/features/marketplace/schemas'
import type { ProviderRequestTrace } from '@/features/provider-adapters/types'

export type OrderStatus = (typeof orderStatuses)[number]

export type MarketplaceOrder = {
  id: string
  productSlug: string
  productName: string
  providerName: string
  providerWallet?: string
  buyerWallet: string
  status: OrderStatus
  amountUsdt: string
  quotedCredits?: number
  quotedAmountUsdt?: string
  paidAmountUsdt?: string
  reservedAmountUsdt?: string
  actualCredits?: number
  actualAmountUsdt?: string
  deltaAmountUsdt?: string
  pricingSource?:
    | 'fixed'
    | 'request_payload'
    | 'quote_endpoint'
    | 'provider_response'
  resultReleaseStatus?:
    | 'not_applicable'
    | 'reserved'
    | 'released'
    | 'provider_retrying'
    | 'delta_payment_required'
    | 'credit_due'
    | 'refundable'
    | 'refunded'
  escrowStatus?:
    | 'not_applicable'
    | 'reserved'
    | 'released'
    | 'refunded'
    | 'failed'
  escrowAddress?: string
  escrowPaymentId?: string
  escrowReserveTxHash?: string
  escrowReserveExplorerUrl?: string | null
  escrowReleaseTxHash?: string
  escrowReleaseExplorerUrl?: string | null
  escrowRefundTxHash?: string
  escrowRefundExplorerUrl?: string | null
  refundAmountUsdt?: string
  requestId: string
  providerIdempotencyKey?: string
  requestPayloadJson?: string
  receiptId?: string
  explorerUrl?: string | null
  externalJobId?: string
  responsePayload?: unknown
  providerRequest?: ProviderRequestTrace
  lockedResponsePayload?: unknown
  providerRetry?: {
    retryable: boolean
    reason: string
    firstFailureAt: string
    lastFailureAt: string
    retryAfterSeconds?: number
    retryUntil: string
    attempts: number
  }
  createdAt: string
  updatedAt: string
  resultUrl?: string
  lockedResultUrl?: string
  agentRunId?: string
  isProviderTest?: boolean
}
