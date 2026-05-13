import { NextResponse } from 'next/server'

import {
  getMarketplaceOrderById,
  updateMarketplaceOrder
} from '@/features/marketplace/orders'
import { resolveFinalUsageDelta } from '@/features/marketplace/pricing'
import { getProductBySlug } from '@/features/marketplace/products'
import {
  getMarketplaceReceiptById,
  recordMarketplaceReceipt
} from '@/features/marketplace/receipt-store'
import { getProviderAdapter } from '@/features/provider-adapters/registry'
import { classifyProviderFailure } from '@/features/provider-adapters/retry-policy'
import {
  getEscrowPaymentState,
  refundEscrowPayment,
  releaseEscrowPayment
} from '@/lib/contracts/api-payment-escrow'
import { omitIndexedCharacterMaps } from '@/lib/utils/json-payload'

type OrderProviderStatusRouteProps = {
  params: Promise<{
    orderId: string
  }>
}

export async function GET(
  request: Request,
  props: OrderProviderStatusRouteProps
) {
  return handleProviderStatus(request, props, { forceProviderCall: false })
}

export async function POST(
  request: Request,
  props: OrderProviderStatusRouteProps
) {
  return handleProviderStatus(request, props, { forceProviderCall: true })
}

async function handleProviderStatus(
  _request: Request,
  { params }: OrderProviderStatusRouteProps,
  { forceProviderCall }: { forceProviderCall: boolean }
) {
  const { orderId } = await params
  const order = await getMarketplaceOrderById(orderId)

  if (!order) {
    return NextResponse.json({ error: 'Order was not found.' }, { status: 404 })
  }

  const isRetryingProviderCall =
    order.resultReleaseStatus === 'provider_retrying'
  const isManualProviderRetry =
    forceProviderCall && canRetryPaidProviderCall(order)

  const adapter = await getProviderAdapter(order.productSlug)

  if (
    !order.externalJobId &&
    !isRetryingProviderCall &&
    !isManualProviderRetry
  ) {
    return NextResponse.json(
      {
        error: forceProviderCall
          ? 'This paid order is not eligible for a provider retry.'
          : 'This order does not have an async provider job.'
      },
      { status: 400 }
    )
  }

  if (!adapter) {
    return NextResponse.json(
      { error: 'This provider adapter is not configured.' },
      { status: 400 }
    )
  }

  const product = await getProductBySlug(order.productSlug)
  const paidAmountUsd = parseUsdtLabel(order.paidAmountUsdt ?? order.amountUsdt)
  const requestPayload = parseJsonOrEmpty(order.requestPayloadJson)
  const providerResult =
    order.externalJobId && adapter.getStatus && !isManualProviderRetry
      ? await adapter.getStatus(order.externalJobId, order.productSlug)
      : (isRetryingProviderCall || isManualProviderRetry) && order.receiptId
        ? await adapter.call({
            productSlug: order.productSlug,
            orderId: order.id,
            requestId: order.requestId,
            providerIdempotencyKey:
              order.providerIdempotencyKey ??
              createProviderIdempotencyKey({
                orderId: order.id,
                requestId: order.requestId
              }),
            requestPayload,
            buyerWallet: order.buyerWallet,
            receiptId: order.receiptId
          })
        : null

  if (!providerResult) {
    return NextResponse.json(
      { error: 'This provider does not expose a retryable status adapter.' },
      { status: 400 }
    )
  }
  const usageDelta =
    product && providerResult.status === 'completed'
      ? await resolveFinalUsageDelta({
          product,
          requestPayload,
          providerResponse: providerResult.responsePayload,
          paidAmountUsd
        }).catch(() => null)
      : null
  const failurePolicy =
    providerResult.status === 'failed'
      ? classifyProviderFailure({ providerResult, order })
      : null
  const shouldHoldRetryableFailure =
    failurePolicy?.retryable === true && !failurePolicy.expired
  const resultReleaseStatus = shouldHoldRetryableFailure
    ? 'provider_retrying'
    : providerResult.status === 'failed'
      ? order.escrowStatus === 'reserved'
        ? 'refunded'
        : 'refundable'
      : usageDelta?.releaseStatus === 'delta_payment_required'
        ? 'delta_payment_required'
        : usageDelta?.releaseStatus === 'credit_due'
          ? 'credit_due'
          : providerResult.status === 'completed'
            ? 'released'
            : providerResult.status === 'processing'
              ? 'reserved'
              : order.resultReleaseStatus
  const nextStatus =
    resultReleaseStatus === 'delta_payment_required'
      ? ('delta_payment_required' as const)
      : shouldHoldRetryableFailure
        ? ('processing' as const)
        : providerResult.status
  const responsePayload =
    resultReleaseStatus === 'delta_payment_required'
      ? {
          status: 'ready',
          message:
            'Final usage exceeded the prepaid quote. Pay the delta before the gateway reveals the provider result.',
          externalJobId: providerResult.externalJobId ?? order.externalJobId
        }
      : omitIndexedCharacterMaps(
          providerResult.responsePayload ?? order.responsePayload
        )
  const shouldRefundEscrow =
    providerResult.status === 'failed' &&
    !shouldHoldRetryableFailure &&
    order.escrowStatus === 'reserved' &&
    isHexBytes32(order.escrowPaymentId)
  const shouldReleaseEscrow =
    providerResult.status === 'completed' &&
    order.escrowStatus === 'reserved' &&
    resultReleaseStatus !== 'delta_payment_required' &&
    isHexBytes32(order.escrowPaymentId)
  const escrowPaymentId = isHexBytes32(order.escrowPaymentId)
    ? order.escrowPaymentId
    : null
  const escrowRefund = shouldRefundEscrow
    ? await refundReservedEscrowPayment(escrowPaymentId!)
    : null
  const escrowRelease = shouldReleaseEscrow
    ? await releaseEscrowPayment(escrowPaymentId!).catch(error => ({
        error: describeUnknownError(error)
      }))
    : null
  const refundedEscrow = isEscrowWriteResult(escrowRefund) ? escrowRefund : null
  const releasedEscrow = isEscrowWriteResult(escrowRelease)
    ? escrowRelease
    : null
  const receipt = order.receiptId
    ? await getMarketplaceReceiptById(order.receiptId)
    : undefined

  if (receipt && (refundedEscrow || releasedEscrow || shouldRefundEscrow)) {
    await recordMarketplaceReceipt({
      ...receipt,
      escrowStatus: shouldRefundEscrow
        ? refundedEscrow
          ? 'refunded'
          : 'failed'
        : releasedEscrow
          ? 'released'
          : receipt.escrowStatus,
      escrowRefundTxHash: refundedEscrow?.txHash,
      escrowRefundExplorerUrl: refundedEscrow?.explorerUrl,
      escrowReleaseTxHash: releasedEscrow?.txHash,
      escrowReleaseExplorerUrl: releasedEscrow?.explorerUrl
    })
  }

  const nextOrder = await updateMarketplaceOrder(order.id, {
    status: nextStatus,
    externalJobId: providerResult.externalJobId ?? order.externalJobId,
    responsePayload,
    providerRequest: providerResult.providerRequest ?? order.providerRequest,
    lockedResponsePayload:
      resultReleaseStatus === 'delta_payment_required'
        ? omitIndexedCharacterMaps(providerResult.responsePayload)
        : order.lockedResponsePayload,
    resultUrl:
      resultReleaseStatus === 'delta_payment_required'
        ? undefined
        : (providerResult.resultUrl ?? order.resultUrl),
    lockedResultUrl:
      resultReleaseStatus === 'delta_payment_required'
        ? providerResult.resultUrl
        : order.lockedResultUrl,
    actualCredits: usageDelta?.actualPrice?.creditValue ?? order.actualCredits,
    actualAmountUsdt:
      usageDelta?.actualPrice?.amountLabel ?? order.actualAmountUsdt,
    deltaAmountUsdt:
      usageDelta && usageDelta.deltaUsd !== 0
        ? usageDelta.deltaLabel
        : order.deltaAmountUsdt,
    resultReleaseStatus,
    providerRetry:
      failurePolicy?.retryable === true
        ? {
            retryable: true,
            reason: failurePolicy.reason,
            firstFailureAt:
              order.providerRetry?.firstFailureAt ?? new Date().toISOString(),
            lastFailureAt: new Date().toISOString(),
            retryAfterSeconds: failurePolicy.retryAfterSeconds,
            retryUntil: failurePolicy.retryUntil,
            attempts: failurePolicy.attempts
          }
        : providerResult.status === 'completed'
          ? undefined
          : providerResult.status === 'processing'
            ? undefined
            : order.providerRetry,
    escrowStatus: shouldRefundEscrow
      ? refundedEscrow
        ? 'refunded'
        : 'failed'
      : shouldReleaseEscrow
        ? releasedEscrow
          ? 'released'
          : 'failed'
        : order.escrowStatus,
    escrowRefundTxHash: refundedEscrow ? refundedEscrow.txHash : undefined,
    escrowRefundExplorerUrl: refundedEscrow
      ? refundedEscrow.explorerUrl
      : undefined,
    escrowReleaseTxHash: releasedEscrow ? releasedEscrow.txHash : undefined,
    escrowReleaseExplorerUrl: releasedEscrow
      ? releasedEscrow.explorerUrl
      : undefined,
    refundAmountUsdt: refundedEscrow
      ? order.paidAmountUsdt
      : order.refundAmountUsdt
  })

  return NextResponse.json({
    order: nextOrder ?? order,
    provider:
      resultReleaseStatus === 'delta_payment_required'
        ? {
            status: 'ready',
            externalJobId: providerResult.externalJobId ?? order.externalJobId,
            errorMessage:
              'Final usage exceeded the prepaid quote. The result is locked until the delta is paid.'
          }
        : shouldHoldRetryableFailure
          ? {
              ...providerResult,
              status: 'processing',
              retryable: true,
              retryUntil:
                failurePolicy?.retryable === true
                  ? failurePolicy.retryUntil
                  : undefined,
              retryAfterSeconds:
                failurePolicy?.retryable === true
                  ? failurePolicy.retryAfterSeconds
                  : undefined,
              errorMessage:
                failurePolicy?.retryable === true
                  ? failurePolicy.reason
                  : providerResult.errorMessage
            }
          : providerResult,
    pricing: {
      actual: usageDelta?.actualPrice ?? null,
      deltaAmountUsdt:
        usageDelta && usageDelta.deltaUsd !== 0
          ? usageDelta.deltaLabel
          : '0.00 USDT',
      resultReleaseStatus
    },
    escrow: {
      refund: refundedEscrow
        ? {
            txHash: refundedEscrow.txHash,
            explorerUrl: refundedEscrow.explorerUrl
          }
        : null,
      release: releasedEscrow
        ? {
            txHash: releasedEscrow.txHash,
            explorerUrl: releasedEscrow.explorerUrl
          }
        : null
    }
  })
}

function parseUsdtLabel(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function createProviderIdempotencyKey({
  orderId,
  requestId
}: {
  orderId: string
  requestId: string
}) {
  return `app_${orderId}_${requestId}`
}

function parseJsonOrEmpty(value: string | undefined) {
  if (!value) {
    return {}
  }

  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}

function canRetryPaidProviderCall(order: {
  status: string
  receiptId?: string
  requestPayloadJson?: string
  resultReleaseStatus?: string
}) {
  return (
    order.status === 'failed' &&
    Boolean(order.receiptId) &&
    Boolean(order.requestPayloadJson) &&
    order.resultReleaseStatus !== 'refunded'
  )
}

function isHexBytes32(
  value: string | null | undefined
): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value ?? '')
}

function describeUnknownError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isEscrowWriteResult(
  value: unknown
): value is { txHash: `0x${string}`; explorerUrl: string | null } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'txHash' in value &&
      typeof value.txHash === 'string'
  )
}

async function refundReservedEscrowPayment(paymentId: `0x${string}`) {
  const state = await getEscrowPaymentState(paymentId).catch(() => 'none')

  if (state !== 'reserved') {
    return {
      error:
        state === 'none'
          ? 'Escrow payment is not reserved on-chain, so no refund transaction was submitted.'
          : `Escrow payment is already ${state}, so no refund transaction was submitted.`
    }
  }

  return await refundEscrowPayment(paymentId).catch(error => ({
    error: describeUnknownError(error)
  }))
}
