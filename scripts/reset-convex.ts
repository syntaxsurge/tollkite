#!/usr/bin/env tsx

import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

function resolveConvexUrl(): string {
  const candidates = [
    process.env.CONVEX_DEPLOYMENT,
    process.env.NEXT_PUBLIC_CONVEX_URL
  ]

  const url = candidates.find(
    value => typeof value === 'string' && value.trim().length > 0
  )
  if (!url) {
    throw new Error('Set NEXT_PUBLIC_CONVEX_URL before running convex:reset.')
  }

  const normalized = url.trim()
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized
  }

  if (normalized.startsWith('dev:')) {
    return process.env.NEXT_PUBLIC_CONVEX_URL ?? 'http://127.0.0.1:8000'
  }

  throw new Error(
    `Unsupported Convex deployment value "${normalized}". Provide an https:// URL or dev: identifier.`
  )
}

async function main() {
  const url = resolveConvexUrl()
  const secret = process.env.CONVEX_RESET_TOKEN
  const batchSize = Number(process.env.CONVEX_RESET_BATCH ?? '128')

  const client = new ConvexHttpClient(url)
  console.log(`Resetting Convex deployment at ${url}…`)
  const result = (await client.mutation(anyApi.admin.truncateAll, {
    secret,
    batchSize
  })) as Record<string, number>

  console.log('Truncated tables:')
  for (const [table, count] of Object.entries(result)) {
    console.log(`- ${table}: ${count} rows deleted`)
  }
  console.log('Convex reset complete.')
}

main().catch(error => {
  console.error('Failed to reset Convex deployment:', error)
  process.exitCode = 1
})
