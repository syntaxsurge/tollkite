import { NextResponse } from 'next/server'

import { prepareAgentRunFunding } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type AgentRunFundingRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function POST(
  _request: Request,
  { params }: AgentRunFundingRouteProps
) {
  const prepared = await prepareAgentRunFunding((await params).runId)

  if (!prepared) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  if ('error' in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: 412 })
  }

  return NextResponse.json(prepared)
}
