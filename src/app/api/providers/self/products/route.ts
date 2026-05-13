import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  type ApiProduct,
  recordProviderProduct,
  getProductBySlug
} from '@/features/marketplace/products'
import {
  formatUsdtAmount,
  providerProductInputSchema
} from '@/features/marketplace/schemas'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../../../../convex/_generated/api'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = providerProductInputSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid product payload.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value

  if (!ownerWallet) {
    return NextResponse.json(
      { error: 'Connect a wallet before creating a provider listing.' },
      { status: 401 }
    )
  }

  const profile = await getConvexClient().query(api.users.getByWallet, {
    walletAddress: ownerWallet
  })

  if (!isCompleteProviderProfile(profile)) {
    return NextResponse.json(
      { error: 'Complete your profile before creating API products.' },
      { status: 403 }
    )
  }

  const existing = await getProductBySlug(payload.slug)

  if (existing) {
    return NextResponse.json(
      { error: 'API product slug is already in use.' },
      { status: 409 }
    )
  }

  let requestSchema: Record<string, string>
  let responseSchema: Record<string, string>
  let referencePayload: Record<string, unknown>
  try {
    requestSchema = parseSchemaJson(payload.requestSchemaJson, 'request schema')
    responseSchema = parseSchemaJson(
      payload.responseSchemaJson,
      'response schema'
    )
    referencePayload = payload.referencePayloadJson
      ? parseReferencePayload(payload.referencePayloadJson)
      : {}
  } catch {
    return NextResponse.json(
      { error: 'Schema and reference payload fields must contain valid JSON.' },
      { status: 400 }
    )
  }

  const product: ApiProduct = {
    slug: payload.slug,
    name: payload.name,
    ownerWallet: profile.walletAddress as `0x${string}`,
    providerName: profile.fullName,
    providerSlug: profile.username || slugify(profile.fullName),
    providerWallet: profile.walletAddress as `0x${string}`,
    category: payload.category,
    description: payload.description,
    priceUsd: payload.priceUsd,
    priceLabel:
      payload.pricingModel === 'credit_metered'
        ? 'Metered quote'
        : formatUsdtAmount(payload.priceUsd),
    pricing: {
      model: payload.pricingModel,
      quoteEndpointUrl: payload.pricingQuoteEndpointUrl || undefined,
      quoteMethod: payload.pricingQuoteMethod,
      creditUnitPath: payload.pricingCreditUnitPath || undefined,
      usageCreditPath: payload.pricingUsageCreditPath || undefined,
      creditToUsdtRate: payload.pricingCreditToUsdtRate,
      multiplier: payload.pricingMultiplier,
      minimumChargeUsd: payload.pricingMinimumChargeUsd,
      maximumChargeUsd:
        payload.pricingMaximumChargeUsd === ''
          ? undefined
          : payload.pricingMaximumChargeUsd || undefined
    },
    method: payload.method,
    endpointPath: `/api/x402/products/${payload.slug}/call`,
    providerEndpointUrl: payload.endpointUrl,
    providerAuth: {
      type: payload.authType,
      headerName: payload.authHeaderName || undefined,
      queryParam: payload.authQueryParam || undefined,
      secret: payload.authSecret || undefined,
      username: payload.authUsername || undefined,
      password: payload.authPassword || undefined
    },
    polling: {
      statusEndpointUrl: payload.statusEndpointUrl || undefined,
      method: payload.statusMethod,
      externalJobIdPath: payload.externalJobIdPath || undefined,
      statusPath: payload.statusPath || undefined,
      resultUrlPath: payload.resultUrlPath || undefined,
      errorMessagePath: payload.errorMessagePath || undefined
    },
    timeoutSeconds: payload.timeoutSeconds,
    estimatedLatency: payload.estimatedLatency,
    executionMode: payload.executionMode,
    settlementModel: payload.settlementModel,
    resultDelivery: payload.resultDelivery,
    requestSchema,
    responseSchema,
    referencePayload,
    isX402Protected: payload.isX402Protected,
    isAgentReady: payload.isAgentReady,
    status: payload.status,
    featured: payload.status === 'published',
    calls: 0,
    successRate: 'No calls yet',
    revenueUsdt: '0.00'
  }
  const createdProduct = await recordProviderProduct({
    product,
    userId: profile._id
  })

  return NextResponse.json({
    productId: `product_${createdProduct.slug}`,
    slug: createdProduct.slug,
    status: createdProduct.status,
    priceLabel: createdProduct.priceLabel
  })
}

function parseSchemaJson(value: string, label: string) {
  const parsed = JSON.parse(value) as unknown

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([key, type]) => [key, String(type)])
  )
}

function parseReferencePayload(value: string) {
  const parsed = JSON.parse(value) as unknown

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('reference payload must be a JSON object.')
  }

  return parsed as Record<string, unknown>
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'provider'
  )
}

function isCompleteProviderProfile(value: unknown): value is {
  _id: string
  walletAddress: string
  fullName: string
  username: string
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const profile = value as {
    _id?: unknown
    walletAddress?: unknown
    fullName?: unknown
    username?: unknown
  }

  return (
    typeof profile._id === 'string' &&
    typeof profile.walletAddress === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(profile.walletAddress) &&
    typeof profile.fullName === 'string' &&
    profile.fullName.trim().length >= 2 &&
    typeof profile.username === 'string' &&
    profile.username.trim().length >= 3
  )
}
