import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { z } from 'zod'

import { updateProviderProductStatus } from '@/features/marketplace/products'
import { apiProductStatuses } from '@/features/marketplace/schemas'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

const statusUpdateSchema = z.object({
  status: z.enum(apiProductStatuses)
})

type ProductStatusRouteProps = {
  params: Promise<{
    slug: string
  }>
}

export async function PATCH(
  request: Request,
  { params }: ProductStatusRouteProps
) {
  const { slug } = await params
  const body = await request.json().catch(() => null)
  const parsed = statusUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid product status.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const product = await updateProviderProductStatus(
    slug,
    parsed.data.status,
    ownerWallet
  )

  if (!product) {
    return NextResponse.json(
      { error: 'API product not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    slug: product.slug,
    status: product.status,
    priceLabel: product.priceLabel
  })
}
