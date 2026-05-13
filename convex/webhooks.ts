import { v } from 'convex/values'

import { mutation } from './_generated/server'

export const record = mutation({
  args: {
    source: v.string(),
    eventType: v.string(),
    payloadText: v.string(),
    payloadJson: v.optional(v.any()),
    headers: v.array(
      v.object({
        name: v.string(),
        value: v.string()
      })
    )
  },
  handler: async (
    ctx: any,
    args: {
      source: string
      eventType: string
      payloadText: string
      payloadJson?: unknown
      headers: Array<{
        name: string
        value: string
      }>
    }
  ) => {
    const now = Date.now()

    return await ctx.db.insert('webhookEvents', {
      source: sanitizeLabel(args.source, 'external'),
      eventType: sanitizeLabel(args.eventType, 'event.received'),
      payloadText: args.payloadText,
      payloadJson: args.payloadJson,
      headers: args.headers
        .filter(header => isAllowedHeader(header.name))
        .map(header => ({
          name: header.name.toLowerCase(),
          value: header.value.slice(0, 512)
        })),
      status: 'received',
      receivedAt: now
    })
  }
})

function sanitizeLabel(value: string, fallback: string) {
  return value.trim().slice(0, 96) || fallback
}

function isAllowedHeader(name: string) {
  const normalizedName = name.toLowerCase()

  return (
    normalizedName.startsWith('x-') ||
    normalizedName === 'content-type' ||
    normalizedName === 'user-agent'
  )
}
