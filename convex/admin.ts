import { v } from 'convex/values'

import { mutation } from './_generated/server'

export const truncateAll = mutation({
  args: {
    secret: v.optional(v.string()),
    batchSize: v.optional(v.number())
  },
  handler: async (ctx: any, args: { secret?: string; batchSize?: number }) => {
    const expected = process.env.CONVEX_RESET_TOKEN

    if (expected && args.secret !== expected) {
      throw new Error('Unauthorized')
    }

    const tables = [
      'workspaces',
      'users',
      'providers',
      'apiProducts',
      'apiProductVersions',
      'orders',
      'receipts',
      'managedCreditAccounts',
      'apiRequests',
      'webhookEvents',
      'webhookEndpoints',
      'webhookDeliveries',
      'apiUsageEvents',
      'providerPayouts',
      'agentRuns',
      'agentActions',
      'agentProofs',
      'savedExamples',
      'reviews'
    ]
    const deleted: Record<string, number> = {}

    for (const table of tables) {
      const rows = await ctx.db.query(table).collect()
      deleted[table] = rows.length

      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
    }

    return deleted
  }
})
