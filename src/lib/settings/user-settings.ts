export type UserPlan = 'free' | 'base' | 'plus'

export type UserSettings = {
  fullName: string
  username: string
  email: string
  plan: UserPlan
}

export type PublicUserProfile = {
  walletAddress: string
  fullName: string
  username: string
  avatarInitials: string
}

type LegacyUserSettings = Partial<UserSettings> & {
  role?: unknown
  website?: unknown
}

const userSettingsCache = new Map<string, UserSettings>()

const publicProfilesByWallet: Record<
  string,
  Omit<PublicUserProfile, 'walletAddress' | 'avatarInitials'>
> = {}

export const defaultUserSettings: UserSettings = {
  fullName: '',
  username: '',
  email: '',
  plan: 'free'
}

export function readUserSettings(walletAddress?: string | null): UserSettings {
  return userSettingsCache.get(cacheKey(walletAddress)) ?? defaultUserSettings
}

export function writeUserSettings(
  settings: UserSettings,
  walletAddress?: string | null
) {
  userSettingsCache.set(
    cacheKey(walletAddress),
    normalizeUserSettings(settings)
  )

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app:user-settings-updated'))
  }
}

export function clearUserSettings(walletAddress?: string | null) {
  userSettingsCache.delete(cacheKey(walletAddress))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('app:user-settings-updated'))
  }
}

export function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
}

export function isUserSettingsComplete(settings: UserSettings) {
  return (
    settings.fullName.trim().length >= 2 &&
    normalizeUsername(settings.username).length >= 3 &&
    isValidEmail(settings.email)
  )
}

export function validateUsername(
  username: string,
  walletAddress?: string | null
) {
  const normalizedUsername = normalizeUsername(username)

  if (normalizedUsername.length < 3) {
    return 'Username must be at least 3 characters.'
  }

  if (normalizedUsername.length > 24) {
    return 'Username must be 24 characters or fewer.'
  }

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(normalizedUsername)) {
    return 'Username must start with a letter or number and use only letters, numbers, hyphens, or underscores.'
  }

  if (isUsernameReservedForAnotherWallet(normalizedUsername, walletAddress)) {
    return 'That username is already taken.'
  }

  return ''
}

export function validateEmail(email: string) {
  const normalizedEmail = email.trim()

  if (!normalizedEmail) {
    return 'Email is required.'
  }

  if (!isValidEmail(normalizedEmail)) {
    return 'Enter a valid email address.'
  }

  return ''
}

export async function fetchUserSettings(
  walletAddress?: string | null
): Promise<UserSettings> {
  if (!walletAddress) {
    return defaultUserSettings
  }

  const response = await fetch(
    `/api/settings/profile?walletAddress=${encodeURIComponent(walletAddress)}`,
    { cache: 'no-store' }
  )

  if (!response.ok) {
    throw new Error(
      `Could not load profile. (${response.status} ${response.statusText})`
    )
  }

  const body = (await response.json()) as { settings?: LegacyUserSettings }
  const settings = normalizeUserSettings(body.settings ?? {})
  writeUserSettings(settings, walletAddress)

  return settings
}

export async function saveUserSettings(
  settings: UserSettings,
  walletAddress?: string | null
): Promise<UserSettings> {
  if (!walletAddress) {
    throw new Error('Connect a wallet before saving your profile.')
  }

  const response = await fetch('/api/settings/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      walletAddress,
      settings: normalizeUserSettings(settings)
    })
  })

  const body = (await response.json().catch(() => null)) as {
    settings?: LegacyUserSettings
    error?: string
    message?: string
  } | null

  if (!response.ok) {
    throw new Error(
      body?.message ||
        body?.error ||
        `Could not save profile. (${response.status} ${response.statusText})`
    )
  }

  const savedSettings = normalizeUserSettings(body?.settings ?? settings)
  writeUserSettings(savedSettings, walletAddress)

  return savedSettings
}

export function userDisplayName(settings: UserSettings) {
  return settings.fullName || settings.username || 'New builder'
}

export function userInitials(settings: UserSettings) {
  const nameParts = userDisplayName(settings)
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)

  return nameParts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

export function formatWalletAddress(walletAddress?: string | null) {
  if (!walletAddress) {
    return 'Wallet not connected'
  }

  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
}

export function getPublicUserProfile(
  walletAddress?: string | null,
  fallbackName = 'API creator'
): PublicUserProfile {
  const normalizedWallet = walletAddress?.toLowerCase() ?? ''
  const knownProfile = publicProfilesByWallet[normalizedWallet]
  const fullName =
    knownProfile?.fullName ||
    fallbackName.trim() ||
    formatWalletAddress(walletAddress)
  const username =
    knownProfile?.username ||
    normalizeUsername(fallbackName).replaceAll('-', '').slice(0, 18) ||
    'creator'
  const avatarInitials = initialsFromName(fullName)

  return {
    walletAddress: walletAddress ?? '',
    fullName,
    username,
    avatarInitials
  }
}

function isUsernameReservedForAnotherWallet(
  username: string,
  walletAddress?: string | null
) {
  const currentWallet = walletAddress?.toLowerCase()

  return Object.entries(publicProfilesByWallet).some(
    ([profileWallet, profile]) =>
      profileWallet !== currentWallet && profile.username === username
  )
}

function initialsFromName(name: string) {
  const parts = name
    .split(' ')
    .map(part => part.trim())
    .filter(Boolean)

  return (
    parts
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase())
      .join('') || 'TL'
  )
}

function normalizeUserSettings(
  settings: LegacyUserSettings = {}
): UserSettings {
  const currentSettings: LegacyUserSettings = { ...settings }
  delete currentSettings.role
  delete currentSettings.website

  return {
    ...defaultUserSettings,
    ...currentSettings,
    email: typeof settings.email === 'string' ? settings.email.trim() : '',
    plan: isUserPlan(settings.plan) ? settings.plan : defaultUserSettings.plan
  }
}

function isUserPlan(value: unknown): value is UserPlan {
  return value === 'free' || value === 'base' || value === 'plus'
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function cacheKey(walletAddress?: string | null) {
  return walletAddress?.toLowerCase() ?? 'anonymous'
}
