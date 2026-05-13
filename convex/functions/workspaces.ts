import { v } from 'convex/values'

import { mutation, query } from '../_generated/server'

export const list = query({
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query('workspaces').collect()
  }
})

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx: any, args: { name: string }) => {
    return await ctx.db.insert('workspaces', {
      name: args.name,
      createdAt: Date.now()
    })
  }
})
