import { ConvexHttpClient } from 'convex/browser'
import 'dotenv/config'

import { api } from '../convex/_generated/api'

type ProviderSeed = {
  walletAddress: string
  fullName: string
  username: string
  email: string
  plan: 'free' | 'base' | 'plus'
  provider: {
    slug: string
    description: string
    websiteUrl?: string
    logoUrl?: string
  }
}

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  throw new Error('Set NEXT_PUBLIC_CONVEX_URL before seeding the database.')
}

const client = new ConvexHttpClient(convexUrl)
const seeds = getProviderSeeds()
const seeded = []

for (const seed of seeds) {
  const user = await client.mutation(api.users.upsertProfile, {
    walletAddress: seed.walletAddress,
    fullName: seed.fullName,
    username: seed.username,
    email: seed.email,
    plan: seed.plan
  })

  if (!user?._id) {
    throw new Error(`Unable to create or load user ${seed.username}.`)
  }

  const provider = await client.mutation(api.providers.upsertForUser, {
    userId: user._id,
    slug: seed.provider.slug,
    description: seed.provider.description,
    websiteUrl: seed.provider.websiteUrl,
    logoUrl: seed.provider.logoUrl
  })

  if (!provider?._id) {
    throw new Error(`Unable to create or load provider ${seed.provider.slug}.`)
  }

  seeded.push({
    walletAddress: user.walletAddress,
    username: user.username,
    providerSlug: provider.slug,
    providerId: provider._id
  })
}

console.log(JSON.stringify({ seeded }, null, 2))

function getProviderSeeds(): ProviderSeed[] {
  const adminWallet = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES?.split(
    ','
  )[0]
    ?.trim()
    .toLowerCase()

  return [
    {
      walletAddress: requireWallet(
        adminWallet,
        'NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES'
      ),
      fullName: process.env.ADMIN_TOOLS_PROVIDER_NAME ?? 'Provider Labs',
      username: process.env.ADMIN_TOOLS_PROVIDER_USERNAME ?? 'platform-labs',
      email: process.env.ADMIN_TOOLS_PROVIDER_EMAIL ?? 'hello@example.com',
      plan: 'plus',
      provider: {
        slug: process.env.ADMIN_TOOLS_PROVIDER_USERNAME ?? 'platform-labs',
        description:
          'Tollkite-operated provider profile for public USDT-ready API tools.',
        websiteUrl: process.env.NEXT_PUBLIC_APP_URL
      }
    },
    {
      walletAddress: requireWallet(
        process.env.SEED_PROVIDER_WALLET_1 ??
          '0x1000000000000000000000000000000000000001',
        'SEED_PROVIDER_WALLET_1'
      ),
      fullName: process.env.SEED_PROVIDER_NAME_1 ?? 'Kite Data Works',
      username: process.env.SEED_PROVIDER_USERNAME_1 ?? 'kite-data-works',
      email: process.env.SEED_PROVIDER_EMAIL_1 ?? 'data@tollkite.local',
      plan: 'base',
      provider: {
        slug: process.env.SEED_PROVIDER_USERNAME_1 ?? 'kite-data-works',
        description:
          'Demo provider profile for USDT-settled public data and research APIs.',
        websiteUrl: 'https://kite.org'
      }
    },
    {
      walletAddress: requireWallet(
        process.env.SEED_PROVIDER_WALLET_2 ??
          '0x2000000000000000000000000000000000000002',
        'SEED_PROVIDER_WALLET_2'
      ),
      fullName: process.env.SEED_PROVIDER_NAME_2 ?? 'Supernormal Commerce',
      username:
        process.env.SEED_PROVIDER_USERNAME_2 ?? 'supernormal-commerce',
      email: process.env.SEED_PROVIDER_EMAIL_2 ?? 'commerce@tollkite.local',
      plan: 'free',
      provider: {
        slug: process.env.SEED_PROVIDER_USERNAME_2 ?? 'supernormal-commerce',
        description:
          'Demo provider profile for USDT-powered commerce, checkout, and agent payment APIs.',
        websiteUrl: 'https://www.supernormal.foundation'
      }
    }
  ]
}

function requireWallet(value: string | undefined, envName: string) {
  const wallet = value?.trim().toLowerCase()

  if (!wallet || !/^0x[a-f0-9]{40}$/.test(wallet)) {
    throw new Error(`${envName} must be a valid EVM wallet address.`)
  }

  return wallet
}
