import { NextResponse } from 'next/server'

import {
  WALLET_ADDRESS_COOKIE,
  WALLET_SESSION_COOKIE,
  WALLET_SESSION_COOKIE_VALUE,
  WALLET_SESSION_MAX_AGE_SECONDS
} from '@/lib/auth/wallet-session'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../../convex/_generated/api'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    walletAddress?: unknown
  } | null

  if (!body || typeof body.walletAddress !== 'string') {
    return NextResponse.json(
      {
        error: 'Wallet address is required.'
      },
      { status: 400 }
    )
  }

  const walletAddress = body.walletAddress.trim().toLowerCase()

  if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      {
        error: 'Wallet address must be a valid EVM address.'
      },
      { status: 400 }
    )
  }

  const profile = await getConvexClient().query(api.users.getByWallet, {
    walletAddress
  })
  const response = NextResponse.json({
    status: 'connected',
    walletAddress,
    profile,
    settings: profile
      ? {
          fullName: profile.fullName,
          username: profile.username,
          email: profile.email,
          plan: profile.plan
        }
      : null
  })

  response.cookies.set(WALLET_SESSION_COOKIE, WALLET_SESSION_COOKIE_VALUE, {
    maxAge: WALLET_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax'
  })
  response.cookies.set(WALLET_ADDRESS_COOKIE, walletAddress, {
    maxAge: WALLET_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax'
  })

  return response
}

export async function DELETE() {
  const response = NextResponse.json({
    status: 'disconnected'
  })

  response.cookies.set(WALLET_SESSION_COOKIE, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax'
  })
  response.cookies.set(WALLET_ADDRESS_COOKIE, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax'
  })

  return response
}
