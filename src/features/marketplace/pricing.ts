import { Buffer } from 'node:buffer'

import type {
  ApiProduct,
  ApiProductProviderAuth
} from '@/features/marketplace/products'
import { sanitizeProductRequestPayload } from '@/features/marketplace/request-payload'
import { formatUsdtAmount } from '@/features/marketplace/schemas'

export type ResolvedProductPrice = {
  amountUsd: number
  amountLabel: string
  model: ApiProduct['pricing']['model']
  creditValue?: number
  creditUnitPath?: string
  usageCreditValue?: number
  usageCreditPath?: string
  source: 'fixed' | 'request_payload' | 'quote_endpoint' | 'provider_response'
  quoteResponse?: unknown
  quoteError?: string
}

export type PriceDelta = {
  actualPrice: ResolvedProductPrice | null
  deltaUsd: number
  deltaLabel: string
  releaseStatus:
    | 'not_applicable'
    | 'released'
    | 'delta_payment_required'
    | 'credit_due'
}

export async function resolveProductPrice({
  product,
  requestPayload,
  providerResponse
}: {
  product: ApiProduct
  requestPayload: unknown
  providerResponse?: unknown
}): Promise<ResolvedProductPrice> {
  const sanitizedRequestPayload = sanitizeProductRequestPayload({
    product,
    payload: requestPayload
  })

  if (product.pricing.model === 'fixed') {
    return toResolvedFixedPrice(product.priceUsd)
  }

  const pricing = product.pricing
  let quoteError: string | undefined
  const sourcePayload = providerResponse
    ? providerResponse
    : pricing.quoteEndpointUrl
      ? await fetchQuotePayload({
          endpointUrl: pricing.quoteEndpointUrl,
          method: pricing.quoteMethod ?? 'POST',
          auth: product.providerAuth,
          requestPayload: sanitizedRequestPayload
        }).catch(error => {
          quoteError =
            error instanceof Error
              ? error.message
              : 'Pricing quote endpoint failed.'

          return sanitizedRequestPayload
        })
      : sanitizedRequestPayload
  const creditUnitPath =
    providerResponse && pricing.usageCreditPath
      ? pricing.usageCreditPath
      : pricing.creditUnitPath || 'estimatedCredits'
  const creditValue = readNumberPath(sourcePayload, creditUnitPath)

  if (creditValue === null) {
    const fallbackAmountUsd =
      pricing.minimumChargeUsd && pricing.minimumChargeUsd > 0
        ? pricing.minimumChargeUsd
        : product.priceUsd

    if (fallbackAmountUsd > 0) {
      return {
        amountUsd: fallbackAmountUsd,
        amountLabel: formatUsdtAmount(fallbackAmountUsd),
        model: 'credit_metered',
        source: 'fixed',
        quoteError:
          quoteError ??
          `Unable to calculate usage-based price because ${creditUnitPath} was not found.`
      }
    }

    throw new Error(
      quoteError ??
        `Unable to calculate usage-based price because ${creditUnitPath} was not found.`
    )
  }

  const amountUsd = calculateCreditMeteredAmount({
    creditValue,
    creditToUsdtRate: pricing.creditToUsdtRate ?? 1,
    multiplier: pricing.multiplier ?? 1,
    minimumChargeUsd: pricing.minimumChargeUsd ?? 0,
    maximumChargeUsd: pricing.maximumChargeUsd
  })

  return {
    amountUsd,
    amountLabel: formatUsdtAmount(amountUsd),
    model: 'credit_metered',
    creditValue,
    creditUnitPath,
    usageCreditValue: pricing.usageCreditPath
      ? (readNumberPath(providerResponse, pricing.usageCreditPath) ?? undefined)
      : undefined,
    usageCreditPath: pricing.usageCreditPath,
    source: providerResponse
      ? 'provider_response'
      : pricing.quoteEndpointUrl
        ? 'quote_endpoint'
        : 'request_payload',
    quoteResponse:
      !providerResponse && pricing.quoteEndpointUrl ? sourcePayload : undefined,
    quoteError
  }
}

export async function resolveFinalUsageDelta({
  product,
  requestPayload,
  providerResponse,
  paidAmountUsd
}: {
  product: ApiProduct
  requestPayload: unknown
  providerResponse: unknown
  paidAmountUsd: number
}): Promise<PriceDelta> {
  if (product.pricing.model !== 'credit_metered') {
    return {
      actualPrice: null,
      deltaUsd: 0,
      deltaLabel: formatUsdtAmount(0),
      releaseStatus: 'not_applicable'
    }
  }

  if (!product.pricing.usageCreditPath) {
    return {
      actualPrice: null,
      deltaUsd: 0,
      deltaLabel: formatUsdtAmount(0),
      releaseStatus: 'released'
    }
  }

  const actualPrice = await resolveProductPrice({
    product,
    requestPayload,
    providerResponse
  })
  const deltaUsd = Number((actualPrice.amountUsd - paidAmountUsd).toFixed(6))
  const releaseStatus =
    deltaUsd > 0
      ? 'delta_payment_required'
      : deltaUsd < 0
        ? 'credit_due'
        : 'released'

  return {
    actualPrice,
    deltaUsd,
    deltaLabel: formatUsdtAmount(Math.abs(deltaUsd)),
    releaseStatus
  }
}

export function toResolvedFixedPrice(amountUsd: number): ResolvedProductPrice {
  return {
    amountUsd,
    amountLabel: formatUsdtAmount(amountUsd),
    model: 'fixed',
    source: 'fixed'
  }
}

export function calculateCreditMeteredAmount({
  creditValue,
  creditToUsdtRate,
  multiplier,
  minimumChargeUsd,
  maximumChargeUsd
}: {
  creditValue: number
  creditToUsdtRate: number
  multiplier: number
  minimumChargeUsd: number
  maximumChargeUsd?: number
}) {
  const rawAmount = creditValue * creditToUsdtRate * multiplier
  const minimumApplied = Math.max(rawAmount, minimumChargeUsd)
  const capped =
    maximumChargeUsd && maximumChargeUsd > 0
      ? Math.min(minimumApplied, maximumChargeUsd)
      : minimumApplied

  return Number(capped.toFixed(6))
}

export function readNumberPath(data: unknown, path?: string) {
  if (!data || !path) {
    return null
  }

  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, data)
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN

  return Number.isFinite(numberValue) ? numberValue : null
}

async function fetchQuotePayload({
  endpointUrl,
  method,
  auth,
  requestPayload
}: {
  endpointUrl: string
  method: 'GET' | 'POST'
  auth?: ApiProductProviderAuth
  requestPayload: unknown
}) {
  const url = new URL(endpointUrl)
  const headers = new Headers({ Accept: 'application/json' })
  const init: RequestInit = { method, headers }

  applyAuth({ url, headers, auth })

  if (method === 'GET') {
    for (const [key, value] of Object.entries(asRecord(requestPayload))) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }
  } else {
    headers.set('Content-Type', 'application/json')
    init.body = JSON.stringify(requestPayload ?? {})
  }

  const response = await fetch(url, init)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      `Pricing quote failed with status ${response.status} ${response.statusText}. Response body: ${formatUnknown(data)}`
    )
  }

  return data
}

function applyAuth({
  url,
  headers,
  auth
}: {
  url: URL
  headers: Headers
  auth?: ApiProductProviderAuth
}) {
  if (!auth || auth.type === 'none') {
    return
  }

  if (auth.type === 'bearer' && auth.secret) {
    headers.set(auth.headerName || 'Authorization', `Bearer ${auth.secret}`)
    return
  }

  if (auth.type === 'api_key_header' && auth.secret) {
    headers.set(auth.headerName || 'x-api-key', auth.secret)
    return
  }

  if (auth.type === 'api_key_query' && auth.secret) {
    url.searchParams.set(auth.queryParam || 'api_key', auth.secret)
    return
  }

  if (auth.type === 'basic' && auth.username && auth.password) {
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString(
        'base64'
      )}`
    )
  }
}

function asRecord(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

function formatUnknown(value: unknown) {
  if (value === null || value === undefined) {
    return 'empty response'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
