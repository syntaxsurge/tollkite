import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAdminAppPath, isAdminWalletAddress } from '@/lib/auth/admin'
import {
  isProtectedAppPath,
  WALLET_ADDRESS_COOKIE,
  WALLET_SESSION_COOKIE,
  WALLET_SESSION_COOKIE_VALUE
} from '@/lib/auth/wallet-session'

export function middleware(request: NextRequest) {
  if (!isProtectedAppPath(request.nextUrl.pathname)) {
    return NextResponse.next()
  }

  const walletSession = request.cookies.get(WALLET_SESSION_COOKIE)?.value

  if (walletSession === WALLET_SESSION_COOKIE_VALUE) {
    if (isAdminAppPath(request.nextUrl.pathname)) {
      const walletAddress = request.cookies.get(WALLET_ADDRESS_COOKIE)?.value

      if (!isAdminWalletAddress(walletAddress)) {
        const dashboardUrl = request.nextUrl.clone()
        dashboardUrl.pathname = '/dashboard'
        dashboardUrl.search = ''

        return NextResponse.redirect(dashboardUrl)
      }
    }

    return NextResponse.next()
  }

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/'
  redirectUrl.search = ''
  redirectUrl.searchParams.set(
    'next',
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  )
  redirectUrl.searchParams.set('auth', 'wallet_required')

  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml).*)'
  ]
}
