export const WALLET_SESSION_COOKIE = 'app_wallet_session'
export const WALLET_ADDRESS_COOKIE = 'app_wallet_address'
export const WALLET_SESSION_COOKIE_VALUE = 'connected'
export const WALLET_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const protectedAppPaths = [
  '/admin',
  '/agents',
  '/dashboard',
  '/marketplace',
  '/orders',
  '/provider',
  '/receipts',
  '/profile',
  '/billing',
  '/settings'
] as const

export function isProtectedAppPath(pathname: string) {
  return protectedAppPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  )
}
