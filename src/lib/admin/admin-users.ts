import 'server-only'

import {
  normalizeWalletAddress,
  parseAdminWalletAddresses
} from '@/lib/auth/admin'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../convex/_generated/api'

export type AdminUserPlan = 'free' | 'base' | 'plus'
export type AdminUserStatus = 'active' | 'invited' | 'paused'
export type AdminUserRole = 'admin' | 'member'
export type AdminUserSortKey =
  | 'displayName'
  | 'username'
  | 'email'
  | 'walletAddress'
  | 'role'
  | 'subscriptionStatus'
  | 'plan'
  | 'status'
  | 'lastSeenAt'

export type AdminUserRecord = {
  id: string
  walletAddress: string
  displayName: string
  username: string
  email: string
  role: AdminUserRole
  plan: AdminUserPlan
  status: AdminUserStatus
  createdAt: string
  lastSeenAt: string
}

export type AdminUserQuery = {
  search?: string
  q?: string
  role?: string
  plan?: string
  status?: string
  sort?: string
  direction?: string
  dir?: string
  page?: string
  pageSize?: string
}

export type AdminUserOverride = Partial<
  Pick<
    AdminUserRecord,
    'displayName' | 'username' | 'email' | 'plan' | 'status'
  >
> & {
  deleted?: boolean
}

export type AdminUserOverrides = Record<string, AdminUserOverride>

type ConvexUserProfile = {
  walletAddress: string
  fullName: string
  username: string
  email: string
  plan: AdminUserPlan
  createdAt: number
  updatedAt: number
}

const sortableColumns: AdminUserSortKey[] = [
  'displayName',
  'username',
  'email',
  'walletAddress',
  'role',
  'subscriptionStatus',
  'plan',
  'status',
  'lastSeenAt'
]

const defaultPageSize = 10

export function getAdminUserSeed() {
  const configuredAdmins = parseAdminWalletAddresses(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
  )
  const addresses = Array.from(new Set(configuredAdmins))
  const now = new Date().toISOString()

  return addresses.map((address, index): AdminUserRecord => {
    return {
      id: address,
      walletAddress: address,
      displayName: 'Provider Labs',
      username: 'platform',
      email: 'hello@example.com',
      role: 'admin',
      plan: 'free',
      status: 'active',
      createdAt: now,
      lastSeenAt:
        index === 0 ? now : new Date(Date.now() - index * 60000).toISOString()
    }
  })
}

export async function listAdminDirectoryUsers() {
  const profiles: ConvexUserProfile[] = await getConvexClient()
    .query(api.users.listProfiles, {})
    .catch(() => [])
  const configuredAdmins = parseAdminWalletAddresses(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
  )
  const profileRows = profiles.map(
    (profile: ConvexUserProfile): AdminUserRecord => {
      const walletAddress = normalizeWalletAddress(profile.walletAddress)

      return {
        id: walletAddress,
        walletAddress,
        displayName: profile.fullName,
        username: profile.username,
        email: profile.email,
        role: configuredAdmins.includes(walletAddress) ? 'admin' : 'member',
        plan: profile.plan,
        status: 'active',
        createdAt: new Date(profile.createdAt).toISOString(),
        lastSeenAt: new Date(profile.updatedAt).toISOString()
      }
    }
  )
  const profileWallets = new Set(profileRows.map(user => user.walletAddress))
  const missingAdminSeeds = getAdminUserSeed()
    .filter(user => configuredAdmins.includes(user.walletAddress))
    .filter(user => !profileWallets.has(user.walletAddress))

  return [...profileRows, ...missingAdminSeeds]
}

export function parseAdminUserOverrides(value?: string) {
  if (!value) {
    return {}
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as AdminUserOverrides
  } catch {
    return {}
  }
}

export function serializeAdminUserOverrides(overrides: AdminUserOverrides) {
  return encodeURIComponent(JSON.stringify(overrides))
}

export function applyAdminUserOverrides(
  users: AdminUserRecord[],
  overrides: AdminUserOverrides
) {
  const configuredAdmins = parseAdminWalletAddresses(
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
  )

  return users
    .map((user): AdminUserRecord => {
      const walletAddress = normalizeWalletAddress(user.walletAddress)
      const { deleted: _deleted, ...override } = overrides[user.id] ?? {}

      return {
        ...user,
        ...override,
        walletAddress,
        role: configuredAdmins.includes(walletAddress)
          ? ('admin' as const)
          : ('member' as const)
      }
    })
    .filter(user => !overrides[user.id]?.deleted)
}

export function getAdminUserById(
  users: AdminUserRecord[],
  id: string,
  overrides: AdminUserOverrides
) {
  return applyAdminUserOverrides(users, overrides).find(
    user => user.id === normalizeWalletAddress(id)
  )
}

export function queryAdminUsers(
  users: AdminUserRecord[],
  query: AdminUserQuery,
  overrides: AdminUserOverrides
) {
  const search = (query.q ?? query.search ?? '').trim().toLowerCase()
  const sort = isSortableColumn(query.sort) ? query.sort : 'lastSeenAt'
  const direction: 'asc' | 'desc' =
    query.dir === 'asc' || query.direction === 'asc' ? 'asc' : 'desc'
  const page = clampPositiveInt(query.page, 1)
  const pageSize = Math.min(
    clampPositiveInt(query.pageSize, defaultPageSize),
    50
  )

  const filtered = applyAdminUserOverrides(users, overrides)
    .filter(user => (query.role ? user.role === query.role : true))
    .filter(user => (query.plan ? user.plan === query.plan : true))
    .filter(user => (query.status ? user.status === query.status : true))
    .filter(user => {
      if (!search) {
        return true
      }

      return [
        user.walletAddress,
        user.displayName,
        user.username,
        user.email,
        user.role,
        getSubscriptionStatus(user.plan),
        user.plan,
        user.status
      ].some(value => value.toLowerCase().includes(search))
    })
    .sort((a, b) => {
      const left =
        sort === 'subscriptionStatus' ? getSubscriptionStatus(a.plan) : a[sort]
      const right =
        sort === 'subscriptionStatus' ? getSubscriptionStatus(b.plan) : b[sort]
      const comparison = left.localeCompare(right)

      return direction === 'asc' ? comparison : -comparison
    })

  const total = filtered.length
  const pageCount = Math.max(Math.ceil(total / pageSize), 1)
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize

  return {
    users: filtered.slice(start, start + pageSize),
    total,
    page: currentPage,
    pageSize,
    pageCount,
    sort,
    direction
  }
}

export function getSubscriptionStatus(plan: AdminUserPlan) {
  return plan === 'free' ? 'free' : 'paid'
}

export function getAdminStats(users: AdminUserRecord[]) {
  return {
    totalUsers: users.length,
    activeUsers: users.filter(user => user.status === 'active').length,
    adminUsers: users.filter(user => user.role === 'admin').length,
    paidUsers: users.filter(user => user.plan !== 'free').length
  }
}

function isSortableColumn(value: unknown): value is AdminUserSortKey {
  return sortableColumns.includes(value as AdminUserSortKey)
}

function clampPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}
