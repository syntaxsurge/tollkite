import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const userPlan = v.union(
  v.literal('free'),
  v.literal('base'),
  v.literal('plus')
)

export const getByWallet = query({
  args: {
    walletAddress: v.string()
  },
  handler: async (ctx: any, args: { walletAddress: string }) => {
    const walletAddress = normalizeWallet(args.walletAddress)
    const profile = await ctx.db
      .query('users')
      .withIndex('by_wallet_address', (q: any) =>
        q.eq('walletAddress', walletAddress)
      )
      .first()

    if (profile) {
      return profile
    }

    return null
  }
})

export const listProfiles = query({
  args: {},
  handler: async (ctx: any) => {
    return await ctx.db.query('users').collect()
  }
})

export const upsertProfile = mutation({
  args: {
    walletAddress: v.string(),
    fullName: v.string(),
    username: v.string(),
    email: v.string(),
    plan: userPlan
  },
  handler: async (
    ctx: any,
    args: {
      walletAddress: string
      fullName: string
      username: string
      email: string
      plan: 'free' | 'base' | 'plus'
    }
  ) => {
    const walletAddress = normalizeWallet(args.walletAddress)
    const fullName = args.fullName.trim()
    const normalizedUsername = normalizeUsername(args.username)

    if (!walletAddress) {
      throw new Error('Wallet address is required.')
    }

    if (fullName.length < 2) {
      throw new Error('Full name must be at least 2 characters.')
    }

    validateUsername(normalizedUsername)
    validateEmail(args.email)

    const existingUsername = await ctx.db
      .query('users')
      .withIndex('by_normalized_username', (q: any) =>
        q.eq('normalizedUsername', normalizedUsername)
      )
      .first()

    if (
      existingUsername &&
      normalizeWallet(existingUsername.walletAddress) !== walletAddress
    ) {
      throw new Error('That username is already taken.')
    }

    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_wallet_address', (q: any) =>
        q.eq('walletAddress', walletAddress)
      )
      .first()
    const now = Date.now()
    const profile = {
      walletAddress,
      fullName,
      username: normalizedUsername,
      normalizedUsername,
      email: args.email.trim(),
      plan: args.plan,
      updatedAt: now
    }

    if (existingUser) {
      await ctx.db.patch(existingUser._id, profile)
      return await ctx.db.get(existingUser._id)
    }

    const userId = await ctx.db.insert('users', {
      ...profile,
      createdAt: now
    })

    return await ctx.db.get(userId)
  }
})

function normalizeWallet(walletAddress: string) {
  return walletAddress.trim().toLowerCase()
}

function normalizeUsername(username: string) {
  return username
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Enter a valid email address.')
  }
}

function validateUsername(username: string) {
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters.')
  }

  if (username.length > 24) {
    throw new Error('Username must be 24 characters or fewer.')
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(username)) {
    throw new Error(
      'Username must start with a letter or number and use only letters, numbers, hyphens, or underscores.'
    )
  }
}
