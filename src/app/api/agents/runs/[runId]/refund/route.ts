import { NextResponse } from 'next/server'

import { refundAgentRunUnusedBudget } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type AgentRunRefundRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function POST(
  request: Request,
  { params }: AgentRunRefundRouteProps
) {
  const body = (await request.json().catch(() => null)) as {
    refundTxHash?: string
  } | null
  const run = await refundAgentRunUnusedBudget({
    runId: (await params).runId,
    refundTxHash: body?.refundTxHash
  })

  if (!run) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json(run)
}
