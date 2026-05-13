import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

export const getByUserId = query({
  args: { userId: v.id('users') },
  handler: async (ctx: any, args: { userId: string }) => {
    return await ctx.db
      .query('providers')
      .withIndex('by_user_id', (q: any) => q.eq('userId', args.userId))
      .first()
  }
})

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx: any, args: { slug: string }) => {
    return await ctx.db
      .query('providers')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()
  }
})

export const createProvider = mutation({
  args: {
    userId: v.id('users'),
    slug: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: {
      userId: string
      slug: string
      description?: string
      websiteUrl?: string
      logoUrl?: string
    }
  ) => {
    const existingUserProvider = await ctx.db
      .query('providers')
      .withIndex('by_user_id', (q: any) => q.eq('userId', args.userId))
      .first()

    if (existingUserProvider) {
      throw new Error('User already has a provider profile.')
    }

    const existing = await ctx.db
      .query('providers')
      .withIndex('by_slug', (q: any) => q.eq('slug', args.slug))
      .first()

    if (existing) {
      throw new Error('Provider slug is already in use.')
    }

    const now = Date.now()

    return await ctx.db.insert('providers', {
      ...args,
      status: 'active',
      createdAt: now,
      updatedAt: now
    })
  }
})

export const upsertForUser = mutation({
  args: {
    userId: v.id('users'),
    slug: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string())
  },
  handler: async (
    ctx: any,
    args: {
      userId: string
      slug: string
      description?: string
      websiteUrl?: string
      logoUrl?: string
    }
  ) => {
    const normalizedSlug = normalizeProviderSlug(args.slug)
    const existingUserProvider = await ctx.db
      .query('providers')
      .withIndex('by_user_id', (q: any) => q.eq('userId', args.userId))
      .first()

    const existingSlugProvider = await ctx.db
      .query('providers')
      .withIndex('by_slug', (q: any) => q.eq('slug', normalizedSlug))
      .first()

    if (
      existingSlugProvider &&
      (!existingUserProvider ||
        existingSlugProvider._id !== existingUserProvider._id)
    ) {
      throw new Error('Provider slug is already in use.')
    }

    const now = Date.now()
    const provider = {
      userId: args.userId,
      slug: normalizedSlug,
      description: args.description,
      websiteUrl: args.websiteUrl,
      logoUrl: args.logoUrl,
      status: 'active' as const,
      updatedAt: now
    }

    if (existingUserProvider) {
      await ctx.db.patch(existingUserProvider._id, provider)
      return await ctx.db.get(existingUserProvider._id)
    }

    const providerId = await ctx.db.insert('providers', {
      ...provider,
      createdAt: now
    })

    return await ctx.db.get(providerId)
  }
})

export const updateSettings = mutation({
  args: {
    providerId: v.id('providers'),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal('active'), v.literal('pending'), v.literal('suspended'))
    )
  },
  handler: async (
    ctx: any,
    args: {
      providerId: string
      description?: string
      websiteUrl?: string
      logoUrl?: string
      status?: 'active' | 'pending' | 'suspended'
    }
  ) => {
    const { providerId, ...updates } = args

    await ctx.db.patch(providerId, {
      ...updates,
      updatedAt: Date.now()
    })

    return providerId
  }
})

function normalizeProviderSlug(slug: string) {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (normalized.length < 3) {
    throw new Error('Provider slug must be at least 3 characters.')
  }

  if (normalized.length > 48) {
    throw new Error('Provider slug must be 48 characters or fewer.')
  }

  return normalized
}
