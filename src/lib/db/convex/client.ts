import { ConvexHttpClient } from 'convex/browser'

import { envClient } from '@/lib/env/env.client'

let client: ConvexHttpClient | null = null

export function getConvexClient() {
  const url = envClient.NEXT_PUBLIC_CONVEX_URL

  if (!url) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  }

  if (!client) {
    client = new ConvexHttpClient(url)
  }

  return client
}
