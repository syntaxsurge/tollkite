import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { isAdminWalletAddress, normalizeWalletAddress } from '@/lib/auth/admin'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const sessionWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const url = new URL(request.url)
  const activeWallet = url.searchParams.get('walletAddress')

  if (!sessionWallet || !activeWallet) {
    return NextResponse.json({ isAdmin: false })
  }

  const walletMatchesSession =
    normalizeWalletAddress(sessionWallet) ===
    normalizeWalletAddress(activeWallet)

  return NextResponse.json({
    isAdmin: walletMatchesSession && isAdminWalletAddress(sessionWallet)
  })
}
