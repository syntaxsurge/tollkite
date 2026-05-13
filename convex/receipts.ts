import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const getById = query({
  args: { receiptId: v.id('receipts') },
  handler: async (ctx: any, args: { receiptId: string }) => {
    return await ctx.db.get(args.receiptId)
  }
})

export const listByWallet = query({
  args: { buyerWallet: v.string() },
  handler: async (ctx: any, args: { buyerWallet: string }) => {
    return await ctx.db
      .query('receipts')
      .withIndex('by_buyer_wallet', (q: any) =>
        q.eq('buyerWallet', args.buyerWallet)
      )
      .collect()
  }
})

export const listSnapshots = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('receipts').collect()

    return rows.map((row: any) => parseJson(row.receiptJson)).filter(Boolean)
  }
})

export const getSnapshotByKey = query({
  args: { receiptKey: v.string() },
  handler: async (ctx: any, args: { receiptKey: string }) => {
    const row = await ctx.db
      .query('receipts')
      .withIndex('by_receipt_key', (q: any) =>
        q.eq('receiptKey', args.receiptKey)
      )
      .first()

    return row ? parseJson(row.receiptJson) : null
  }
})

export const upsertSnapshot = mutation({
  args: {
    receiptKey: v.string(),
    receiptJson: v.string()
  },
  handler: async (
    ctx: any,
    args: { receiptKey: string; receiptJson: string }
  ) => {
    const receipt = parseJson(args.receiptJson) as Record<string, any> | null

    if (!receipt) {
      throw new Error('Receipt JSON must be an object.')
    }

    const existing = await ctx.db
      .query('receipts')
      .withIndex('by_receipt_key', (q: any) =>
        q.eq('receiptKey', args.receiptKey)
      )
      .first()
    const order = await ctx.db
      .query('orders')
      .withIndex('by_order_key', (q: any) => q.eq('orderKey', receipt.orderId))
      .first()
    const now = Date.now()
    const row = {
      receiptKey: args.receiptKey,
      receiptJson: args.receiptJson,
      orderId: order?._id,
      buyerWallet: String(receipt.buyerWallet ?? ''),
      providerWallet: String(receipt.providerWallet ?? ''),
      amountUsdt: String(receipt.amountUsdt ?? '0.00 USDT'),
      network: 'eip155:2368' as const,
      txHash: receipt.txHash,
      settlementPayloadJson: args.receiptJson,
      explorerUrl: receipt.explorerUrl ?? undefined,
      createdAt: parseDate(receipt.createdAt) ?? now
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return parseJson(args.receiptJson)
    }

    await ctx.db.insert('receipts', row)

    return parseJson(args.receiptJson)
  }
})

export const create = mutation({
  args: {
    orderId: v.id('orders'),
    buyerWallet: v.string(),
    providerWallet: v.string(),
    amountUsdt: v.string(),
    txHash: v.optional(v.string()),
    settlementPayloadJson: v.optional(v.string()),
    explorerUrl: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: {
      orderId: string
      buyerWallet: string
      providerWallet: string
      amountUsdt: string
      txHash?: string
      settlementPayloadJson?: string
      explorerUrl?: string
    }
  ) => {
    return await ctx.db.insert('receipts', {
      ...args,
      network: 'eip155:2368',
      createdAt: Date.now()
    })
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

function parseDate(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const time = Date.parse(value)

  return Number.isFinite(time) ? time : null
}
