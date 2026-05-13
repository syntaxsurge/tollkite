import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { deleteProviderProduct } from '@/features/marketplace/products'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

type ProductRouteProps = {
  params: Promise<{
    slug: string
  }>
}

export async function DELETE(_request: Request, { params }: ProductRouteProps) {
  const { slug } = await params
  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const product = await deleteProviderProduct(slug, ownerWallet)

  if (!product) {
    return NextResponse.json(
      { error: 'Provider-created API product was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    deleted: true,
    slug: product.slug,
    name: product.name
  })
}
