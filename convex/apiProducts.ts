import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const category = v.union(
  v.literal('ai'),
  v.literal('data'),
  v.literal('media'),
  v.literal('agent'),
  v.literal('commerce'),
  v.literal('developer')
)

const productStatus = v.union(
  v.literal('draft'),
  v.literal('published'),
  v.literal('paused')
)

export const listMarketplace = query({
  args: {
    category: v.optional(category),
    search: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: { category?: string; search?: string | undefined }
  ) => {
    const rows = args.category
      ? await ctx.db
          .query('apiProducts')
          .withIndex('by_category', (q: any) => q.eq('category', args.category))
          .collect()
      : await ctx.db.query('apiProducts').collect()

    const normalizedSearch = args.search?.trim().toLowerCase()

    return rows
      .filter((row: any) => row.status === 'published')
      .filter((row: any) => {
        if (!normalizedSearch) {
          return true
        }

        return `${row.name} ${row.description} ${row.slug}`
          .toLowerCase()
          .includes(normalizedSearch)
      })
  }
})

export const listByProvider = query({
  args: { providerId: v.id('providers') },
  handler: async (ctx: any, args: { providerId: string }) => {
    return await ctx.db
      .query('apiProducts')
      .withIndex('by_provider', (q: any) => q.eq('providerId', args.providerId))
      .collect()
  }
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx: any, args: { slug: string }) => {
    return await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()
  }
})

export const create = mutation({
  args: {
    providerId: v.id('providers'),
    slug: v.string(),
    name: v.string(),
    description: v.string(),
    category,
    priceUsd: v.number(),
    priceLabel: v.string(),
    endpointUrl: v.string(),
    method: v.union(v.literal('GET'), v.literal('POST')),
    estimatedLatency: v.optional(v.string()),
    executionMode: v.optional(
      v.union(v.literal('synchronous'), v.literal('asynchronous'))
    ),
    settlementModel: v.optional(
      v.union(
        v.literal('pay_on_successful_response'),
        v.literal('pay_on_job_acceptance'),
        v.literal('pay_to_claim_result')
      )
    ),
    resultDelivery: v.optional(
      v.union(
        v.literal('direct_response'),
        v.literal('poll_or_webhook'),
        v.literal('claim_after_completion')
      )
    ),
    authType: v.optional(
      v.union(
        v.literal('none'),
        v.literal('bearer'),
        v.literal('api_key_header'),
        v.literal('api_key_query'),
        v.literal('basic')
      )
    ),
    authHeaderName: v.optional(v.string()),
    authQueryParam: v.optional(v.string()),
    authSecretName: v.optional(v.string()),
    statusEndpointUrl: v.optional(v.string()),
    statusMethod: v.optional(v.union(v.literal('GET'), v.literal('POST'))),
    externalJobIdPath: v.optional(v.string()),
    statusPath: v.optional(v.string()),
    resultUrlPath: v.optional(v.string()),
    errorMessagePath: v.optional(v.string()),
    timeoutSeconds: v.optional(v.number()),
    requestSchemaJson: v.string(),
    responseSchemaJson: v.string(),
    demoPayloadJson: v.optional(v.string()),
    productJson: v.optional(v.string()),
    isX402Protected: v.boolean(),
    isAgentReady: v.boolean(),
    status: productStatus
  },
  handler: async (ctx: any, args: Record<string, unknown>) => {
    const existing = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()

    if (existing) {
      throw new Error('API product slug is already in use.')
    }

    const now = Date.now()
    const productId = await ctx.db.insert('apiProducts', {
      ...args,
      createdAt: now,
      updatedAt: now
    })

    await ctx.db.insert('apiProductVersions', {
      productId,
      version: 1,
      requestSchemaJson: args.requestSchemaJson,
      responseSchemaJson: args.responseSchemaJson,
      endpointUrl: args.endpointUrl,
      createdAt: now
    })

    return productId
  }
})

export const listProviderCatalog = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('apiProducts').collect()

    return await Promise.all(rows.map((row: any) => productResponse(ctx, row)))
  }
})

const providerCatalogProductArgs = {
  userId: v.id('users'),
  providerSlug: v.string(),
  slug: v.string(),
  name: v.string(),
  description: v.string(),
  category,
  priceUsd: v.number(),
  priceLabel: v.string(),
  endpointUrl: v.string(),
  method: v.union(v.literal('GET'), v.literal('POST')),
  estimatedLatency: v.optional(v.string()),
  executionMode: v.union(v.literal('synchronous'), v.literal('asynchronous')),
  settlementModel: v.union(
    v.literal('pay_on_successful_response'),
    v.literal('pay_on_job_acceptance'),
    v.literal('pay_to_claim_result')
  ),
  resultDelivery: v.union(
    v.literal('direct_response'),
    v.literal('poll_or_webhook'),
    v.literal('claim_after_completion')
  ),
  authType: v.union(
    v.literal('none'),
    v.literal('bearer'),
    v.literal('api_key_header'),
    v.literal('api_key_query'),
    v.literal('basic')
  ),
  authHeaderName: v.optional(v.string()),
  authQueryParam: v.optional(v.string()),
  timeoutSeconds: v.optional(v.number()),
  requestSchemaJson: v.string(),
  responseSchemaJson: v.string(),
  demoPayloadJson: v.optional(v.string()),
  productJson: v.string(),
  isX402Protected: v.boolean(),
  isAgentReady: v.boolean(),
  status: productStatus
}

export const createProviderCatalogProduct = mutation({
  args: providerCatalogProductArgs,
  handler: async (ctx: any, args: any) => {
    const existingProduct = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()

    if (existingProduct) {
      throw new Error('API product slug is already in use.')
    }

    const providerId = await getOrCreateProvider(ctx, {
      userId: args.userId,
      slug: args.providerSlug
    })
    const now = Date.now()
    const { userId: _userId, providerSlug: _providerSlug, ...product } = args
    const productId = await ctx.db.insert('apiProducts', {
      ...product,
      providerId,
      createdAt: now,
      updatedAt: now
    })

    await ctx.db.insert('apiProductVersions', {
      productId,
      version: 1,
      requestSchemaJson: args.requestSchemaJson,
      responseSchemaJson: args.responseSchemaJson,
      endpointUrl: args.endpointUrl,
      createdAt: now
    })

    return await productResponse(ctx, await ctx.db.get(productId))
  }
})

export const upsertProviderCatalogProduct = mutation({
  args: providerCatalogProductArgs,
  handler: async (ctx: any, args: any) => {
    const existingProduct = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()
    const providerId = await getOrCreateProvider(ctx, {
      userId: args.userId,
      slug: args.providerSlug
    })
    const now = Date.now()
    const { userId: _userId, providerSlug: _providerSlug, ...product } = args
    const productFields = {
      ...product,
      providerId,
      updatedAt: now
    }
    const productId = existingProduct?._id

    if (productId) {
      await ctx.db.patch(productId, productFields)
    } else {
      await ctx.db.insert('apiProducts', {
        ...productFields,
        createdAt: now
      })
    }

    const row = productId
      ? await ctx.db.get(productId)
      : await ctx.db
          .query('apiProducts')
          .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
          .first()

    if (!row) {
      throw new Error('Unable to persist provider catalog product.')
    }

    await ctx.db.insert('apiProductVersions', {
      productId: row._id,
      version: await nextProductVersion(ctx, row._id),
      requestSchemaJson: args.requestSchemaJson,
      responseSchemaJson: args.responseSchemaJson,
      endpointUrl: args.endpointUrl,
      createdAt: now
    })

    return await productResponse(ctx, await ctx.db.get(row._id))
  }
})

export const updateProviderCatalogStatus = mutation({
  args: {
    slug: v.string(),
    ownerWallet: v.string(),
    status: productStatus
  },
  handler: async (
    ctx: any,
    args: { slug: string; ownerWallet: string; status: string }
  ) => {
    const row = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()

    if (!row || !(await isOwnedByWallet(ctx, row, args.ownerWallet))) {
      return null
    }

    const product = parseProductJson(row.productJson)
    const productJson = product
      ? JSON.stringify({
          ...product,
          status: args.status,
          featured:
            args.status === 'published' ? (product.featured ?? true) : false
        })
      : row.productJson

    await ctx.db.patch(row._id, {
      status: args.status,
      productJson,
      updatedAt: Date.now()
    })

    return await productResponse(ctx, await ctx.db.get(row._id))
  }
})

export const deleteProviderCatalogProduct = mutation({
  args: {
    slug: v.string(),
    ownerWallet: v.string()
  },
  handler: async (ctx: any, args: { slug: string; ownerWallet: string }) => {
    const row = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()

    if (!row || !(await isOwnedByWallet(ctx, row, args.ownerWallet))) {
      return null
    }

    const response = await productResponse(ctx, row)
    await ctx.db.delete(row._id)

    return response
  }
})

export const deleteProviderCatalogProducts = mutation({
  args: {
    slugs: v.array(v.string()),
    ownerWallet: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: { slugs: string[]; ownerWallet?: string }
  ) => {
    let deleted = 0

    for (const slug of args.slugs) {
      const row = await ctx.db
        .query('apiProducts')
        .withIndex('by_slug', (q: any) => q.eq('slug', slug))
        .first()

      if (!row) {
        continue
      }

      if (
        args.ownerWallet &&
        !(await isOwnedByWallet(ctx, row, args.ownerWallet))
      ) {
        continue
      }

      await ctx.db.delete(row._id)
      deleted += 1
    }

    return deleted
  }
})

export const publish = mutation({
  args: { productId: v.id('apiProducts') },
  handler: async (ctx: any, args: { productId: string }) => {
    await ctx.db.patch(args.productId, {
      status: 'published',
      updatedAt: Date.now()
    })
    return args.productId
  }
})

export const pause = mutation({
  args: { productId: v.id('apiProducts') },
  handler: async (ctx: any, args: { productId: string }) => {
    await ctx.db.patch(args.productId, {
      status: 'paused',
      updatedAt: Date.now()
    })
    return args.productId
  }
})

async function nextProductVersion(ctx: any, productId: string) {
  const versions = await ctx.db
    .query('apiProductVersions')
    .withIndex('by_product', (q: any) => q.eq('productId', productId))
    .collect()

  return (
    versions.reduce(
      (highest: number, version: { version?: number }) =>
        Math.max(highest, Number(version.version) || 0),
      0
    ) + 1
  )
}

async function getOrCreateProvider(
  ctx: any,
  args: { userId: string; slug: string }
) {
  const existingUserProvider = await ctx.db
    .query('providers')
    .withIndex('by_user_id', (q: any) => q.eq('userId', args.userId))
    .first()

  if (existingUserProvider) {
    return existingUserProvider._id
  }

  const uniqueSlug = await uniqueProviderSlug(ctx, args.slug)
  const now = Date.now()

  return await ctx.db.insert('providers', {
    userId: args.userId,
    slug: uniqueSlug,
    status: 'active',
    createdAt: now,
    updatedAt: now
  })
}

async function uniqueProviderSlug(ctx: any, slug: string) {
  const normalizedSlug = slug.trim().toLowerCase() || 'provider'
  const existing = await ctx.db
    .query('providers')
    .withIndex('by_slug', (q: any) => q.eq('slug', normalizedSlug))
    .first()

  if (!existing) {
    return normalizedSlug
  }

  return `${normalizedSlug}-${Date.now().toString(36)}`
}

async function isOwnedByWallet(ctx: any, row: any, walletAddress: string) {
  const normalizedWallet = walletAddress.trim().toLowerCase()
  const product = parseProductJson(row.productJson)

  if (
    typeof product?.ownerWallet === 'string' &&
    product.ownerWallet.toLowerCase() === normalizedWallet
  ) {
    return true
  }

  const provider = await ctx.db.get(row.providerId)
  const user = provider ? await ctx.db.get(provider.userId) : null

  return user?.walletAddress?.toLowerCase() === normalizedWallet
}

async function productResponse(ctx: any, row: any) {
  if (!row) {
    return null
  }

  const product = parseProductJson(row.productJson)

  if (product) {
    return {
      ...product,
      status: row.status
    }
  }

  const provider = await ctx.db.get(row.providerId)
  const user = provider ? await ctx.db.get(provider.userId) : null
  const requestSchema = parseJsonObject(row.requestSchemaJson)
  const responseSchema = parseJsonObject(row.responseSchemaJson)
  const referencePayload = parseJsonObject(row.demoPayloadJson)

  return {
    slug: row.slug,
    name: row.name,
    ownerWallet: user?.walletAddress,
    providerName: user?.fullName ?? provider?.slug ?? 'Provider',
    providerSlug: user?.username ?? provider?.slug ?? 'provider',
    providerWallet:
      user?.walletAddress ?? '0x0000000000000000000000000000000000000000',
    category: row.category,
    description: row.description,
    priceUsd: row.priceUsd,
    priceLabel: row.priceLabel,
    pricing: { model: 'fixed' },
    method: row.method,
    endpointPath: `/api/x402/products/${row.slug}/call`,
    providerEndpointUrl: row.endpointUrl,
    providerAuth: { type: row.authType ?? 'none' },
    timeoutSeconds: row.timeoutSeconds,
    estimatedLatency: row.estimatedLatency ?? 'Depends on API',
    executionMode: row.executionMode ?? 'synchronous',
    settlementModel: row.settlementModel ?? 'pay_on_successful_response',
    resultDelivery: row.resultDelivery ?? 'direct_response',
    requestSchema,
    responseSchema,
    referencePayload,
    isX402Protected: row.isX402Protected,
    isAgentReady: row.isAgentReady,
    status: row.status,
    featured: row.status === 'published',
    calls: 0,
    successRate: 'No calls yet',
    revenueUsdt: '0.00'
  }
}

function parseProductJson(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, any>)
      : null
  } catch {
    return null
  }
}

function parseJsonObject(value: unknown) {
  if (typeof value !== 'string') {
    return {}
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}
