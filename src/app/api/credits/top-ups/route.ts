import { NextResponse } from 'next/server'

import { z } from 'zod'

import {
  recordManagedCreditTopUp,
  toPublicManagedCreditAccount
} from '@/features/billing/managed-credits'

const creditTopUpSchema = z.object({
  wallet: z.string().trim().min(10),
  amountUsdt: z.coerce.number().positive().max(100000),
  settlementTxHash: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{64}$/)
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = creditTopUpSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid credit top-up payload.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  const { account, topUp } = await recordManagedCreditTopUp(parsed.data)

  return NextResponse.json({
    account: toPublicManagedCreditAccount(account),
    topUp
  })
}
