import { v } from 'convex/values'

import { mutation } from './_generated/server'

export const create = mutation({
  args: {
    orderId: v.id('orders'),
    productId: v.id('apiProducts'),
    providerId: v.id('providers'),
    requestId: v.string()
  },
  handler: async (
    ctx: any,
    args: {
      orderId: string
      productId: string
      providerId: string
      requestId: string
    }
  ) => {
    return await ctx.db.insert('apiRequests', {
      ...args,
      status: 'started',
      createdAt: Date.now()
    })
  }
})

export const complete = mutation({
  args: {
    requestId: v.string(),
    latencyMs: v.optional(v.number()),
    upstreamStatusCode: v.optional(v.number())
  },
  handler: async (
    ctx: any,
    args: {
      requestId: string
      latencyMs?: number
      upstreamStatusCode?: number
    }
  ) => {
    const request = await ctx.db
      .query('apiRequests')
      .withIndex('by_request_id', (q: any) => q.eq('requestId', args.requestId))
      .first()

    if (!request) {
      throw new Error('API request was not found.')
    }

    await ctx.db.patch(request._id, {
      status: 'completed',
      latencyMs: args.latencyMs,
      upstreamStatusCode: args.upstreamStatusCode
    })

    return request._id
  }
})

export const fail = mutation({
  args: {
    requestId: v.string(),
    errorCode: v.optional(v.string()),
    upstreamStatusCode: v.optional(v.number())
  },
  handler: async (
    ctx: any,
    args: {
      requestId: string
      errorCode?: string
      upstreamStatusCode?: number
    }
  ) => {
    const request = await ctx.db
      .query('apiRequests')
      .withIndex('by_request_id', (q: any) => q.eq('requestId', args.requestId))
      .first()

    if (!request) {
      throw new Error('API request was not found.')
    }

    await ctx.db.patch(request._id, {
      status: 'failed',
      errorCode: args.errorCode,
      upstreamStatusCode: args.upstreamStatusCode
    })

    return request._id
  }
})
