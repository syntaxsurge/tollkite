import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const listSnapshots = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('managedCreditAccounts').collect()

    return rows.map((row: any) => parseJson(row.accountJson)).filter(Boolean)
  }
})

export const getByWallet = query({
  args: { wallet: v.string() },
  handler: async (ctx: any, args: { wallet: string }) => {
    const row = await ctx.db
      .query('managedCreditAccounts')
      .withIndex('by_wallet', (q: any) =>
        q.eq('wallet', args.wallet.toLowerCase())
      )
      .first()

    return row ? parseJson(row.accountJson) : null
  }
})

export const getByApiKey = query({
  args: { apiKey: v.string() },
  handler: async (ctx: any, args: { apiKey: string }) => {
    const row = await ctx.db
      .query('managedCreditAccounts')
      .withIndex('by_api_key', (q: any) => q.eq('apiKey', args.apiKey))
      .first()

    return row ? parseJson(row.accountJson) : null
  }
})

export const upsertSnapshot = mutation({
  args: {
    wallet: v.string(),
    apiKey: v.string(),
    accountJson: v.string()
  },
  handler: async (
    ctx: any,
    args: { wallet: string; apiKey: string; accountJson: string }
  ) => {
    const account = parseJson(args.accountJson) as Record<string, any> | null

    if (!account) {
      throw new Error('Managed credit account JSON must be an object.')
    }

    const normalizedWallet = args.wallet.toLowerCase()
    const existing = await ctx.db
      .query('managedCreditAccounts')
      .withIndex('by_wallet', (q: any) => q.eq('wallet', normalizedWallet))
      .first()
    const now = Date.now()
    const row = {
      wallet: normalizedWallet,
      apiKey: args.apiKey,
      accountJson: args.accountJson,
      updatedAt: parseDate(account.updatedAt) ?? now
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return parseJson(args.accountJson)
    }

    await ctx.db.insert('managedCreditAccounts', {
      ...row,
      createdAt: parseDate(account.createdAt) ?? now
    })

    return parseJson(args.accountJson)
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
