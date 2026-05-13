import { NextResponse } from 'next/server'

import { z } from 'zod'

import {
  getManagedCreditAccountByWallet,
  getOrCreateManagedCreditAccount,
  toPublicManagedCreditAccount
} from '@/features/billing/managed-credits'

const creditAccountSchema = z.object({
  wallet: z.string().trim().min(10)
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const wallet = searchParams.get('wallet')

  if (!wallet) {
    return NextResponse.json(
      {
        error: 'Wallet address is required.'
      },
      { status: 400 }
    )
  }

  const account = await getManagedCreditAccountByWallet(wallet)

  return NextResponse.json({
    account: account ? toPublicManagedCreditAccount(account) : null
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = creditAccountSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid credit account payload.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  const account = await getOrCreateManagedCreditAccount(parsed.data.wallet)

  return NextResponse.json({
    account: toPublicManagedCreditAccount(account)
  })
}
