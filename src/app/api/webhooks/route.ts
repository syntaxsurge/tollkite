import { NextResponse } from 'next/server'

import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../../convex/_generated/api'

export async function POST(request: Request) {
  const payloadText = await request.text()
  const requestUrl = new URL(request.url)
  const payloadJson = parseJsonPayload(payloadText)
  const source =
    request.headers.get('x-app-webhook-source') ??
    requestUrl.searchParams.get('source') ??
    'external'
  const eventType =
    request.headers.get('x-app-event-type') ??
    request.headers.get('x-event-type') ??
    requestUrl.searchParams.get('event') ??
    'event.received'
  const eventId = await getConvexClient().mutation(api.webhooks.record, {
    source,
    eventType,
    payloadText,
    payloadJson,
    headers: Array.from(request.headers.entries()).map(([name, value]) => ({
      name,
      value
    }))
  })

  return NextResponse.json({
    received: true,
    eventId,
    source,
    eventType,
    bytes: Buffer.byteLength(payloadText)
  })
}

function parseJsonPayload(payloadText: string) {
  if (!payloadText.trim()) {
    return undefined
  }

  try {
    return JSON.parse(payloadText) as unknown
  } catch {
    return undefined
  }
}
