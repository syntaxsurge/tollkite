import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'

import { NextRequest, NextResponse } from 'next/server'

import type { HTTPProcessResult } from '@x402/core/server'

import {
  getMarketplaceOrderById,
  updateMarketplaceOrder
} from '@/features/marketplace/orders'
import { getProductBySlug } from '@/features/marketplace/products'
import { resolveProviderFeeSplit } from '@/features/marketplace/provider-fees'
import {
  getMarketplaceReceiptById,
  recordMarketplaceReceipt
} from '@/features/marketplace/receipt-store'
import {
  buildExplorerUrl,
  buildReceiptAmounts
} from '@/features/marketplace/receipts'
import {
  paymentTokenSymbol,
  paymentTokenTransferMethod,
  x402Network
} from '@/lib/config/chains'
import { releaseEscrowPayment } from '@/lib/contracts/api-payment-escrow'
import { NextRequestAdapter } from '@/lib/x402/next-request-adapter'
import {
  getPaymentPaywallConfig,
  getPaymentX402Server
} from '@/lib/x402/payment-resource-server'

export const dynamic = 'force-dynamic'

type ClaimRouteProps = {
  params: Promise<{
    orderId: string
  }>
}

type VerifiedPaymentResult = Extract<
  HTTPProcessResult,
  { type: 'payment-verified' }
>

export async function POST(request: NextRequest, { params }: ClaimRouteProps) {
  const { orderId } = await params
  const order = await getMarketplaceOrderById(orderId)

  if (
    !order ||
    order.status !== 'delta_payment_required' ||
    order.resultReleaseStatus !== 'delta_payment_required'
  ) {
    return NextResponse.json(
      { error: 'Order does not require a result claim payment.' },
      { status: 400 }
    )
  }

  const product = await getProductBySlug(order.productSlug)

  if (!product) {
    return NextResponse.json(
      { error: 'API product was not found.' },
      { status: 404 }
    )
  }

  const adapter = new NextRequestAdapter(request, {})
  const context = {
    adapter,
    path: request.nextUrl.pathname,
    method: request.method,
    paymentHeader:
      adapter.getHeader('payment-signature') ?? adapter.getHeader('x-payment')
  }
  const server = await getPaymentX402Server()
  const processResult = await server.processHTTPRequest(
    context,
    getPaymentPaywallConfig(request.url)
  )

  if (processResult.type === 'payment-error') {
    return toPaymentErrorResponse(processResult)
  }

  if (processResult.type === 'no-payment-required') {
    return NextResponse.json(
      { error: 'Payment configuration was not available for this route.' },
      { status: 500 }
    )
  }

  const responsePreview = {
    order: {
      id: order.id,
      requestId: order.requestId,
      status: 'completed',
      productSlug: order.productSlug,
      productName: order.productName,
      deltaAmountUsdt: order.deltaAmountUsdt,
      resultReleaseStatus: 'released'
    },
    data: {
      status: 'completed',
      message: 'Metered delta was paid and the provider result is released.'
    }
  }
  const settlement = await settleClaim({
    server,
    processResult,
    context,
    responseBody: responsePreview
  })

  if (settlement instanceof NextResponse) {
    return settlement
  }

  const createdAt = new Date().toISOString()
  const deltaAmountUsd = parseUsdtAmount(order.deltaAmountUsdt)
  const feeSplit = await resolveProviderFeeSplit(product)
  const receiptId = `rcpt_claim_${createHash('sha256')
    .update(order.id)
    .update(settlement.transaction ?? createdAt)
    .digest('hex')
    .slice(0, 10)}`
  const receipt = {
    id: receiptId,
    orderId: order.id,
    requestId: order.requestId,
    productSlug: product.slug,
    productName: product.name,
    providerName: product.providerName,
    buyerWallet: settlement.payer ?? order.buyerWallet,
    providerWallet: product.providerWallet,
    amountUsdt: order.deltaAmountUsdt ?? '0.00 PYUSD',
    ...buildReceiptAmounts(deltaAmountUsd, feeSplit.platformFeeBps),
    providerPlan: feeSplit.planKey,
    platformFeeBps: feeSplit.platformFeeBps,
    providerShareBps: feeSplit.providerShareBps,
    network: x402Network as 'eip155:2368',
    txHash: settlement.transaction,
    explorerUrl: buildExplorerUrl(settlement.transaction),
    createdAt,
    resultUrl: order.lockedResultUrl ?? order.resultUrl
  }
  await recordMarketplaceReceipt(receipt)
  const escrowPaymentId = isHexBytes32(order.escrowPaymentId)
    ? order.escrowPaymentId
    : null
  const escrowRelease =
    order.escrowStatus === 'reserved' && escrowPaymentId
      ? await releaseEscrowPayment(escrowPaymentId).catch(error => ({
          error: describeUnknownError(error)
        }))
      : null
  const releasedEscrow = isEscrowWriteResult(escrowRelease)
    ? escrowRelease
    : null
  const originalReceipt = order.receiptId
    ? await getMarketplaceReceiptById(order.receiptId)
    : undefined

  if (originalReceipt && releasedEscrow) {
    await recordMarketplaceReceipt({
      ...originalReceipt,
      escrowStatus: 'released',
      escrowReleaseTxHash: releasedEscrow.txHash,
      escrowReleaseExplorerUrl: releasedEscrow.explorerUrl
    })
  }

  const releasedOrder = await updateMarketplaceOrder(order.id, {
    status: 'completed',
    paidAmountUsdt: order.actualAmountUsdt ?? order.paidAmountUsdt,
    resultReleaseStatus: 'released',
    responsePayload: order.lockedResponsePayload ?? order.responsePayload,
    lockedResponsePayload: undefined,
    resultUrl: order.lockedResultUrl ?? order.resultUrl,
    lockedResultUrl: undefined,
    receiptId,
    explorerUrl: receipt.explorerUrl,
    escrowStatus:
      order.escrowStatus === 'reserved'
        ? releasedEscrow
          ? 'released'
          : 'failed'
        : order.escrowStatus,
    escrowReleaseTxHash: releasedEscrow ? releasedEscrow.txHash : undefined,
    escrowReleaseExplorerUrl: releasedEscrow
      ? releasedEscrow.explorerUrl
      : undefined
  })

  return NextResponse.json(
    {
      order: releasedOrder ?? order,
      receipt,
      data: releasedOrder?.responsePayload ?? order.lockedResponsePayload,
      x402: {
        network: settlement.network,
        transaction: settlement.transaction
      },
      escrow: {
        release: releasedEscrow
          ? {
              txHash: releasedEscrow.txHash,
              explorerUrl: releasedEscrow.explorerUrl
            }
          : null
      }
    },
    {
      headers: {
        ...settlement.headers,
        'X-App-Receipt-Id': receiptId
      }
    }
  )
}

function toPaymentErrorResponse(
  processResult: Extract<HTTPProcessResult, { type: 'payment-error' }>
) {
  return new NextResponse(JSON.stringify(processResult.response.body ?? {}), {
    status: processResult.response.status,
    headers: {
      ...processResult.response.headers,
      'Content-Type': 'application/json'
    }
  })
}

async function settleClaim({
  server,
  processResult,
  context,
  responseBody
}: {
  server: Awaited<ReturnType<typeof getPaymentX402Server>>
  processResult: VerifiedPaymentResult
  context: {
    adapter: NextRequestAdapter
    path: string
    method: string
    paymentHeader?: string
  }
  responseBody: unknown
}) {
  const settlement = await server
    .processSettlement(
      processResult.paymentPayload,
      processResult.paymentRequirements,
      processResult.declaredExtensions,
      {
        request: context,
        responseBody: Buffer.from(JSON.stringify(responseBody)),
        responseHeaders: {
          'content-type': 'application/json'
        }
      }
    )
    .catch(error => ({
      success: false as const,
      errorReason: 'settlement_exception',
      errorMessage:
        error instanceof Error ? error.message : 'PYUSD settlement failed.',
      response: {
        status: 402,
        headers: {},
        body: null
      }
    }))

  if (!settlement.success) {
    return NextResponse.json(
      {
        error: 'PYUSD delta settlement failed.',
        reason: settlement.errorReason,
        message: settlement.errorMessage,
        guidance: buildClaimSettlementGuidance(
          settlement.errorReason,
          settlement.errorMessage,
          settlement.response.body
        )
      },
      {
        status: settlement.response.status,
        headers: {
          ...settlement.response.headers,
          'Content-Type': 'application/json'
        }
      }
    )
  }

  return settlement
}

function buildClaimSettlementGuidance(
  reason: string | undefined,
  message: string | undefined,
  details: unknown
) {
  const haystack = [
    reason,
    message,
    typeof details === 'string' ? details : JSON.stringify(details ?? '')
  ]
    .join(' ')
    .toLowerCase()

  if (
    haystack.includes('invalid_exact_evm_transaction_simulation_failed') ||
    haystack.includes('invalid_exact_evm_eip3009_not_supported')
  ) {
    return paymentTokenTransferMethod === 'eip3009'
      ? `The configured ${paymentTokenSymbol} token did not accept the EIP-3009 transferWithAuthorization settlement simulation. Use an EIP-3009-compatible payment token, or switch NEXT_PUBLIC_PAYMENT_TOKEN_TRANSFER_METHOD to a supported transfer method for this chain.`
      : `The configured ${paymentTokenSymbol} token transfer method did not pass x402 settlement simulation on the configured chain. Confirm the token, transfer method, and deployed x402 support contracts match.`
  }

  return `Confirm the buyer wallet has enough ${paymentTokenSymbol} and native gas on the configured network, then try again.`
}

function parseUsdtAmount(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
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
