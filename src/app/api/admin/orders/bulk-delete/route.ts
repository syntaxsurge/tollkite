import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { deleteMarketplaceOrders } from '@/features/marketplace/orders'
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
  const ids = Array.isArray(body?.ids)
    ? body.ids.map(id => String(id)).filter(Boolean)
    : []

  if (ids.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one order.' },
      { status: 400 }
    )
  }

  const deleted = await deleteMarketplaceOrders(ids)

  revalidatePath('/admin')
  revalidatePath('/admin/orders')
  revalidatePath('/orders')

  return NextResponse.json({ deleted })
}
