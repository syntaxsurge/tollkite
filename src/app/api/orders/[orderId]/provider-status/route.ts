import { NextResponse } from 'next/server'

import { syncMarketplaceOrderProviderStatus } from '@/features/marketplace/async-provider-status'

type OrderProviderStatusRouteProps = {
  params: Promise<{
    orderId: string
  }>
}

export async function GET(
  _request: Request,
  { params }: OrderProviderStatusRouteProps
) {
  const { orderId } = await params
  const result = await syncMarketplaceOrderProviderStatus(orderId, {
    forceProviderCall: false
  })

  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(
  _request: Request,
  { params }: OrderProviderStatusRouteProps
) {
  const { orderId } = await params
  const result = await syncMarketplaceOrderProviderStatus(orderId, {
    forceProviderCall: true
  })

  return NextResponse.json(result.body, { status: result.status })
}
