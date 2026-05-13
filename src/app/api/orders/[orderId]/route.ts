import { NextResponse } from 'next/server'

import { getMarketplaceOrderWithProviderStatus } from '@/features/marketplace/async-provider-status'

type OrderRouteProps = {
  params: Promise<{
    orderId: string
  }>
}

export async function GET(_request: Request, { params }: OrderRouteProps) {
  const { orderId } = await params
  const order = await getMarketplaceOrderWithProviderStatus(orderId)

  if (!order) {
    return NextResponse.json({ error: 'Order was not found.' }, { status: 404 })
  }

  return NextResponse.json(order)
}
