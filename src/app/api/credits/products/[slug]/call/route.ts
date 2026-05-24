import { randomBytes } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  debitManagedCredits,
  getManagedCreditAccountByApiKey,
  refundManagedCreditDebit,
  settleManagedCreditDebit,
  toPublicManagedCreditAccount
} from '@/features/billing/managed-credits'
import { recordMarketplaceOrder } from '@/features/marketplace/orders'
import {
  resolveFinalUsageDelta,
  resolveProductPrice
} from '@/features/marketplace/pricing'
import { getProductBySlug } from '@/features/marketplace/products'
import { resolveProviderFeeSplit } from '@/features/marketplace/provider-fees'
import { recordMarketplaceReceipt } from '@/features/marketplace/receipt-store'
import {
  buildExplorerUrl,
  buildReceiptAmounts
} from '@/features/marketplace/receipts'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import { getProviderAdapter } from '@/features/provider-adapters/registry'
import { x402Network } from '@/lib/config/chains'

type CreditProductCallRouteProps = {
  params: Promise<{
    slug: string
  }>
}

export async function POST(
  request: Request,
  { params }: CreditProductCallRouteProps
) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  const apiKey = getBearerToken(request.headers.get('authorization'))

  if (!product || product.status !== 'published') {
    return NextResponse.json(
      { error: 'API product was not found.' },
      { status: 404 }
    )
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: 'managed-credit API key required for managed-credit calls.' },
      { status: 401 }
    )
  }

  const account = await getManagedCreditAccountByApiKey(apiKey)

  if (!account) {
    return NextResponse.json(
      { error: 'managed-credit API key was not found.' },
      { status: 401 }
    )
  }

  const latestTopUp = account.topUps[0]

  if (!latestTopUp) {
    return NextResponse.json(
      { error: 'Managed credit balance is empty. Top up with PYUSD first.' },
      { status: 402 }
    )
  }

  const payload = await request.json().catch(() => ({}))
  const orderId = `ord_credit_${randomBytes(6).toString('hex')}`
  const requestId = `req_credit_${randomBytes(6).toString('hex')}`
  const receiptId = `rcpt_credit_${randomBytes(6).toString('hex')}`
  const providerIdempotencyKey = createProviderIdempotencyKey({
    orderId,
    requestId
  })
  const resolvedPrice = await resolveProductPrice({
    product,
    requestPayload: payload
  })
  const debitResult = await debitManagedCredits({
    apiKey,
    productSlug: slug,
    receiptId,
    amountUsdt: resolvedPrice.amountUsd
  })

  if (!debitResult?.debit) {
    return NextResponse.json(
      {
        error: 'Managed credit balance is too low for this API call.',
        account: debitResult
          ? toPublicManagedCreditAccount(debitResult.account)
          : undefined
      },
      { status: 402 }
    )
  }

  const providerAdapter = await getProviderAdapter(slug)

  if (!providerAdapter) {
    return NextResponse.json(
      { error: 'Provider adapter was not found.' },
      { status: 502 }
    )
  }

  const providerResult = await providerAdapter.call({
    productSlug: product.slug,
    requestPayload: payload,
    orderId,
    requestId,
    receiptId,
    providerIdempotencyKey,
    buyerWallet: account.wallet
  })

  if (providerResult.status === 'failed') {
    await refundManagedCreditDebit({
      apiKey,
      debitId: debitResult.debit.id,
      note: 'Provider failed after reservation; reserved PYUSD was returned to the managed credit balance.'
    })

    return NextResponse.json(
      {
        error: providerResult.errorMessage ?? 'Provider request failed.',
        creditAccount: toPublicManagedCreditAccount(debitResult.account),
        provider: {
          id: providerAdapter.id,
          request: providerResult.providerRequest,
          response: providerResult.responsePayload
        }
      },
      { status: 502 }
    )
  }

  const createdAt = new Date().toISOString()
  const usageDelta =
    providerResult.status === 'completed'
      ? await resolveFinalUsageDelta({
          product,
          requestPayload: payload,
          providerResponse: providerResult.responsePayload,
          paidAmountUsd: resolvedPrice.amountUsd
        }).catch(() => null)
      : null
  const settlementAdjustment =
    usageDelta?.actualPrice && usageDelta.releaseStatus !== 'not_applicable'
      ? await settleManagedCreditDebit({
          apiKey,
          debitId: debitResult.debit.id,
          actualAmountUsdt: usageDelta.actualPrice.amountUsd,
          note:
            usageDelta.releaseStatus === 'credit_due'
              ? 'Final usage was lower than the reserved quote; unused PYUSD was returned to the managed credit balance.'
              : usageDelta.releaseStatus === 'delta_payment_required'
                ? 'Final usage exceeded the reserved quote; result release requires the remaining PYUSD.'
                : 'Final metered usage matched the reserved quote.'
        })
      : null
  const resultReleaseStatus: MarketplaceOrder['resultReleaseStatus'] =
    usageDelta?.releaseStatus === 'delta_payment_required'
      ? 'delta_payment_required'
      : usageDelta?.releaseStatus === 'credit_due'
        ? 'credit_due'
        : providerResult.status === 'completed'
          ? 'released'
          : 'reserved'
  const orderStatus =
    resultReleaseStatus === 'delta_payment_required'
      ? ('delta_payment_required' as const)
      : providerResult.status
  const responsePayload =
    resultReleaseStatus === 'delta_payment_required'
      ? {
          status: 'ready',
          message:
            'Final usage exceeded the managed credit reservation. Top up or pay the delta before the gateway reveals the provider result.',
          externalJobId: providerResult.externalJobId
        }
      : providerResult.responsePayload
  const feeSplit = await resolveProviderFeeSplit(product)
  const receipt = {
    id: receiptId,
    orderId,
    requestId,
    productSlug: product.slug,
    productName: product.name,
    providerName: product.providerName,
    buyerWallet: account.wallet,
    providerWallet: product.providerWallet,
    amountUsdt: resolvedPrice.amountLabel,
    ...buildReceiptAmounts(resolvedPrice.amountUsd, feeSplit.platformFeeBps),
    providerPlan: feeSplit.planKey,
    platformFeeBps: feeSplit.platformFeeBps,
    providerShareBps: feeSplit.providerShareBps,
    network: x402Network as 'eip155:2368',
    txHash: latestTopUp.settlementTxHash,
    explorerUrl: buildExplorerUrl(latestTopUp.settlementTxHash),
    createdAt,
    resultUrl: providerResult.resultUrl
  }
  const order = {
    id: orderId,
    productSlug: product.slug,
    productName: product.name,
    providerName: product.providerName,
    providerWallet: product.providerWallet,
    buyerWallet: account.wallet,
    status: orderStatus,
    amountUsdt: resolvedPrice.amountLabel,
    quotedCredits: resolvedPrice.creditValue,
    quotedAmountUsdt: resolvedPrice.amountLabel,
    paidAmountUsdt: resolvedPrice.amountLabel,
    reservedAmountUsdt:
      resolvedPrice.model === 'credit_metered'
        ? resolvedPrice.amountLabel
        : undefined,
    actualCredits: usageDelta?.actualPrice?.creditValue,
    actualAmountUsdt: usageDelta?.actualPrice?.amountLabel,
    deltaAmountUsdt:
      usageDelta && usageDelta.deltaUsd !== 0
        ? usageDelta.deltaLabel
        : '0.00 PYUSD',
    pricingSource: resolvedPrice.source,
    resultReleaseStatus,
    requestId,
    providerIdempotencyKey,
    requestPayloadJson: JSON.stringify(payload, null, 2),
    receiptId,
    explorerUrl: receipt.explorerUrl,
    externalJobId: providerResult.externalJobId,
    responsePayload,
    providerRequest: providerResult.providerRequest,
    lockedResponsePayload:
      resultReleaseStatus === 'delta_payment_required'
        ? providerResult.responsePayload
        : undefined,
    resultUrl:
      resultReleaseStatus === 'delta_payment_required'
        ? undefined
        : providerResult.resultUrl,
    lockedResultUrl:
      resultReleaseStatus === 'delta_payment_required'
        ? providerResult.resultUrl
        : undefined,
    createdAt,
    updatedAt: createdAt
  }

  await recordMarketplaceReceipt(receipt)
  await recordMarketplaceOrder(order)

  return NextResponse.json({
    order,
    receipt,
    pricing: {
      quoted: resolvedPrice,
      actual: usageDelta?.actualPrice ?? null,
      deltaAmountUsdt:
        usageDelta && usageDelta.deltaUsd !== 0
          ? usageDelta.deltaLabel
          : '0.00 PYUSD',
      resultReleaseStatus
    },
    data: responsePayload,
    creditAccount: toPublicManagedCreditAccount(
      settlementAdjustment?.account ?? debitResult.account
    )
  })
}

function getBearerToken(header: string | null) {
  if (!header?.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return header.slice(7).trim()
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
