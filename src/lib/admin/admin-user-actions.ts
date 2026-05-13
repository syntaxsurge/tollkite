'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ADMIN_USER_OVERRIDES_COOKIE } from '@/lib/admin/admin-user-cookies'
import {
  parseAdminUserOverrides,
  serializeAdminUserOverrides
} from '@/lib/admin/admin-users'
import type { AdminUserPlan, AdminUserStatus } from '@/lib/admin/admin-users'
import {
  isAdminWalletAddress,
  normalizeWalletAddress,
  parseAdminWalletAddresses
} from '@/lib/auth/admin'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

const validPlans: AdminUserPlan[] = ['free', 'base', 'plus']
const validStatuses: AdminUserStatus[] = ['active', 'invited', 'paused']

export async function updateAdminUserAction(formData: FormData) {
  const cookieStore = await cookies()
  requireAdmin(cookieStore.get(WALLET_ADDRESS_COOKIE)?.value)

  const id = normalizeWalletAddress(String(formData.get('id') ?? ''))
  const returnTo = getReturnTo(formData)
  const plan = parseOption(
    String(formData.get('plan') ?? 'free'),
    validPlans,
    'free'
  )
  const status = parseOption(
    String(formData.get('status') ?? 'active'),
    validStatuses,
    'active'
  )

  if (!id) {
    redirect(returnTo)
  }

  const currentOverrides = parseAdminUserOverrides(
    cookieStore.get(ADMIN_USER_OVERRIDES_COOKIE)?.value
  )

  currentOverrides[id] = {
    ...currentOverrides[id],
    deleted: false,
    displayName: String(formData.get('displayName') ?? '').trim(),
    username: normalizeUsername(String(formData.get('username') ?? '')),
    email: String(formData.get('email') ?? '').trim(),
    plan,
    status
  }

  writeOverridesCookie(cookieStore, currentOverrides)
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  redirect(returnTo)
}

export async function deleteAdminUserAction(formData: FormData) {
  const cookieStore = await cookies()
  requireAdmin(cookieStore.get(WALLET_ADDRESS_COOKIE)?.value)

  const id = normalizeWalletAddress(String(formData.get('id') ?? ''))
  const returnTo = getReturnTo(formData)

  if (!id) {
    redirect(returnTo)
  }

  if (
    parseAdminWalletAddresses(
      process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESSES
    ).includes(id)
  ) {
    redirect(returnTo)
  }

  const currentOverrides = parseAdminUserOverrides(
    cookieStore.get(ADMIN_USER_OVERRIDES_COOKIE)?.value
  )

  currentOverrides[id] = {
    ...currentOverrides[id],
    deleted: true
  }

  writeOverridesCookie(cookieStore, currentOverrides)
  revalidatePath('/admin')
  revalidatePath('/admin/users')
  redirect(returnTo)
}

function requireAdmin(walletAddress?: string) {
  if (!isAdminWalletAddress(walletAddress)) {
    redirect('/dashboard')
  }
}

function writeOverridesCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  overrides: ReturnType<typeof parseAdminUserOverrides>
) {
  cookieStore.set(
    ADMIN_USER_OVERRIDES_COOKIE,
    serializeAdminUserOverrides(overrides),
    {
      path: '/',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    }
  )
}

function parseOption<T extends string>(
  value: string,
  options: readonly T[],
  fallback: T
) {
  return options.includes(value as T) ? (value as T) : fallback
}

function normalizeUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 32)
}

function getReturnTo(formData: FormData) {
  const value = String(formData.get('returnTo') ?? '/admin/users')

  return value.startsWith('/admin/users') ? value : '/admin/users'
}
