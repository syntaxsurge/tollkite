import { NextResponse } from 'next/server'

import { confirmAgentRunFunding } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type AgentRunFundingRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function POST(
  request: Request,
  { params }: AgentRunFundingRouteProps
) {
  const body = (await request.json().catch(() => null)) as {
    fundingTxHash?: string
    approvalTxHash?: string
  } | null
  const fundingTxHash = body?.fundingTxHash

  if (!fundingTxHash) {
    return NextResponse.json(
      { error: 'Funding transaction hash is required.' },
      { status: 400 }
    )
  }

  const run = await confirmAgentRunFunding({
    runId: (await params).runId,
    fundingTxHash,
    approvalTxHash: body?.approvalTxHash
  })

  if (!run) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  if (run.fundingStatus !== 'funded') {
    return NextResponse.json(
      {
        ...run,
        error: run.summary || 'Agent run funding was not confirmed on-chain.'
      },
      { status: 412 }
    )
  }

  return NextResponse.json(run)
}
