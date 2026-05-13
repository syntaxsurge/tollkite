import { NextRequest, NextResponse } from 'next/server'

import { getConvexClient } from '@/lib/db/convex/client'
import { defaultUserSettings } from '@/lib/settings/user-settings'
import type { UserSettings } from '@/lib/settings/user-settings'

import { api } from '../../../../../convex/_generated/api'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const walletAddress = request.nextUrl.searchParams.get('walletAddress')

  if (!walletAddress) {
    return NextResponse.json(
      {
        error: 'Wallet address is required.'
      },
      { status: 400 }
    )
  }

  const profile = await getConvexClient().query(api.users.getByWallet, {
    walletAddress
  })

  return NextResponse.json({
    settings: profile ? userToSettings(profile) : defaultUserSettings,
    profile: profile ?? null
  })
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    walletAddress?: unknown
    settings?: unknown
  } | null

  if (!body || typeof body.walletAddress !== 'string') {
    return NextResponse.json(
      {
        error: 'Wallet address is required.'
      },
      { status: 400 }
    )
  }

  if (!isUserSettingsInput(body.settings)) {
    return NextResponse.json(
      {
        error: 'Profile settings are required.'
      },
      { status: 400 }
    )
  }

  try {
    const profile = await getConvexClient().mutation(api.users.upsertProfile, {
      walletAddress: body.walletAddress,
      fullName: body.settings.fullName,
      username: body.settings.username,
      email: body.settings.email,
      plan: body.settings.plan
    })

    return NextResponse.json({
      settings: profile ? userToSettings(profile) : body.settings,
      profile
    })
  } catch (error) {
    const message =
      error instanceof Error ? normalizeConvexError(error.message) : ''

    return NextResponse.json(
      {
        error: message || 'Could not save profile.',
        message: message || 'Could not save profile.'
      },
      {
        status: message === 'That username is already taken.' ? 409 : 400
      }
    )
  }
}

function isUserSettingsInput(value: unknown): value is UserSettings {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<UserSettings>

  return (
    typeof candidate.fullName === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.plan === 'string'
  )
}

function userToSettings(user: UserSettings & Record<string, unknown>) {
  return {
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    plan: user.plan
  } satisfies UserSettings
}

function normalizeConvexError(message: string) {
  const marker = 'Uncaught Error:'
  const markerIndex = message.indexOf(marker)

  if (markerIndex === -1) {
    return message
  }

  return (
    message
      .slice(markerIndex + marker.length)
      .split('\n')[0]
      ?.trim() ?? ''
  )
}
