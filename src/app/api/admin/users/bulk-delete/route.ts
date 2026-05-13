import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { ADMIN_USER_OVERRIDES_COOKIE } from '@/lib/admin/admin-user-cookies'
import {
  parseAdminUserOverrides,
  serializeAdminUserOverrides
} from '@/lib/admin/admin-users'
import {
  isAdminWalletAddress,
  normalizeWalletAddress,
  parseAdminWalletAddresses
} from '@/lib/auth/admin'
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
    ? body.ids.map(id => normalizeWalletAddress(String(id))).filter(Boolean)
    : []
  const configuredAdmins = parseAdminWalletAddresses(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
  )
  const deletableIds = ids.filter(id => !configuredAdmins.includes(id))

  if (deletableIds.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one non-admin user.' },
      { status: 400 }
    )
  }

  const overrides = parseAdminUserOverrides(
    cookieStore.get(ADMIN_USER_OVERRIDES_COOKIE)?.value
  )

  deletableIds.forEach(id => {
    overrides[id] = {
      ...overrides[id],
      deleted: true
    }
  })

  cookieStore.set(
    ADMIN_USER_OVERRIDES_COOKIE,
    serializeAdminUserOverrides(overrides),
    {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    }
  )

  revalidatePath('/admin')
  revalidatePath('/admin/users')

  return NextResponse.json({ deleted: deletableIds.length })
}
