export const adminAppPaths = ['/admin'] as const

export function isAdminAppPath(pathname: string) {
  return adminAppPaths.some(
    path => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export function normalizeWalletAddress(address: string) {
  return address.trim().toLowerCase()
}

export function parseAdminWalletAddresses(value = '') {
  return value
    .split(/[\s,]+/)
    .map(address => normalizeWalletAddress(address))
    .filter(Boolean)
}

export function isAdminWalletAddress(address: string | null | undefined) {
  if (!address) {
    return false
  }

  return parseAdminWalletAddresses(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
  ).includes(normalizeWalletAddress(address))
}
