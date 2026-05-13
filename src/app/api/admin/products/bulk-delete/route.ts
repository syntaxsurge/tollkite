import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { deleteAdminProviderProducts } from '@/features/marketplace/products'
import { isAdminWalletAddress } from '@/lib/auth/admin'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const walletAddress = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value

  if (!isAdminWalletAddress(walletAddress)) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: 403 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown
  } | null
  const slugs = Array.isArray(body?.ids)
    ? body.ids.map(id => String(id)).filter(Boolean)
    : []

  if (slugs.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one product.' },
      { status: 400 }
    )
  }

  const deleted = await deleteAdminProviderProducts(slugs)

  revalidatePath('/admin')
  revalidatePath('/admin/products')
  revalidatePath('/marketplace')
  revalidatePath('/provider/products')

  return NextResponse.json({ deleted })
}
