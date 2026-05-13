import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const orderStatus = v.union(
  v.literal('created'),
  v.literal('payment_required'),
  v.literal('paid'),
  v.literal('forwarding'),
  v.literal('processing'),
  v.literal('completed'),
  v.literal('failed'),
  v.literal('expired')
)

const persistedOrderStatus = new Set([
  'created',
  'payment_required',
  'paid',
  'forwarding',
  'processing',
  'completed',
  'failed',
  'expired'
])

export const getById = query({
  args: { orderId: v.id('orders') },
  handler: async (ctx: any, args: { orderId: string }) => {
    return await ctx.db.get(args.orderId)
  }
})

export const listSnapshots = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('orders').collect()

    return rows.map((row: any) => parseJson(row.orderJson)).filter(Boolean)
  }
})

export const getSnapshotByKey = query({
  args: { orderKey: v.string() },
  handler: async (ctx: any, args: { orderKey: string }) => {
    const row = await ctx.db
      .query('orders')
      .withIndex('by_order_key', (q: any) => q.eq('orderKey', args.orderKey))
      .first()

    return row ? parseJson(row.orderJson) : null
  }
})

export const upsertSnapshot = mutation({
  args: {
    orderKey: v.string(),
    orderJson: v.string()
  },
  handler: async (ctx: any, args: { orderKey: string; orderJson: string }) => {
    const order = parseJson(args.orderJson) as Record<string, any> | null

    if (!order) {
      throw new Error('Order JSON must be an object.')
    }

    const existing = await ctx.db
      .query('orders')
      .withIndex('by_order_key', (q: any) => q.eq('orderKey', args.orderKey))
      .first()
    const product = await ctx.db
      .query('apiProducts')
      .withIndex('by_slug', (q: any) => q.eq('slug', order.productSlug))
      .first()
    const now = Date.now()
    const updatedAt = parseDate(order.updatedAt) ?? now
    const row = {
      orderKey: args.orderKey,
      orderJson: args.orderJson,
      buyerWallet: String(order.buyerWallet ?? ''),
      providerId: product?.providerId,
      productId: product?._id,
      status: toPersistedStatus(order.status),
      amountUsd: parseUsdt(order.amountUsdt),
      amountUsdt: order.amountUsdt,
      providerIdempotencyKey:
        typeof order.providerIdempotencyKey === 'string'
          ? order.providerIdempotencyKey
          : undefined,
      requestPayloadJson:
        typeof order.requestPayloadJson === 'string'
          ? order.requestPayloadJson
          : JSON.stringify(order.requestPayloadJson ?? {}),
      responsePayloadJson:
        order.responsePayload === undefined
          ? undefined
          : JSON.stringify(order.responsePayload),
      externalJobId: order.externalJobId,
      resultUrl: order.resultUrl,
      errorMessage: order.providerRetry?.reason,
      updatedAt
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return parseJson(args.orderJson)
    }

    await ctx.db.insert('orders', {
      ...row,
      createdAt: parseDate(order.createdAt) ?? now
    })

    return parseJson(args.orderJson)
  }
})

export const deleteSnapshots = mutation({
  args: { orderKeys: v.array(v.string()) },
  handler: async (ctx: any, args: { orderKeys: string[] }) => {
    let deleted = 0

    for (const orderKey of args.orderKeys) {
      const row = await ctx.db
        .query('orders')
        .withIndex('by_order_key', (q: any) => q.eq('orderKey', orderKey))
        .first()

      if (row) {
        await ctx.db.delete(row._id)
        deleted += 1
      }
    }

    return deleted
  }
})

export const listByWallet = query({
  args: { buyerWallet: v.string() },
  handler: async (ctx: any, args: { buyerWallet: string }) => {
    return await ctx.db
      .query('orders')
      .withIndex('by_buyer_wallet', (q: any) =>
        q.eq('buyerWallet', args.buyerWallet)
      )
      .collect()
  }
})

export const create = mutation({
  args: {
    buyerWallet: v.string(),
    providerId: v.id('providers'),
    productId: v.id('apiProducts'),
    amountUsd: v.number(),
    amountUsdt: v.optional(v.string()),
    requestPayloadJson: v.string()
  },
  handler: async (
    ctx: any,
    args: {
      buyerWallet: string
      providerId: string
      productId: string
      amountUsd: number
      amountUsdt?: string
      requestPayloadJson: string
    }
  ) => {
    const now = Date.now()

    return await ctx.db.insert('orders', {
      ...args,
      status: 'payment_required',
      createdAt: now,
      updatedAt: now
    })
  }
})

export const updateStatus = mutation({
  args: {
    orderId: v.id('orders'),
    status: orderStatus,
    responsePayloadJson: v.optional(v.string()),
    externalJobId: v.optional(v.string()),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: {
      orderId: string
      status: string
      responsePayloadJson?: string
      externalJobId?: string
      resultUrl?: string
      errorMessage?: string
    }
  ) => {
    const { orderId, ...updates } = args

    await ctx.db.patch(orderId, {
      ...updates,
      updatedAt: Date.now()
    })

    return orderId
  }
})

export const markPaid = mutation({
  args: {
    orderId: v.id('orders'),
    amountUsdt: v.string()
  },
  handler: async (
    ctx: any,
    args: {
      orderId: string
      amountUsdt: string
    }
  ) => {
    await ctx.db.patch(args.orderId, {
      status: 'paid',
      amountUsdt: args.amountUsdt,
      updatedAt: Date.now()
    })

    return args.orderId
  }
})

function parseJson(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function toPersistedStatus(status: unknown) {
  return typeof status === 'string' && persistedOrderStatus.has(status)
    ? status
    : 'processing'
}

function parseUsdt(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (typeof value !== 'string') {
    return 0
  }

  const amount = Number(value.replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const time = Date.parse(value)

  return Number.isFinite(time) ? time : null
}
