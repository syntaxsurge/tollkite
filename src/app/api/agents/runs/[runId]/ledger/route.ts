import { NextResponse } from 'next/server'

import { getAgentRunLedger } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type AgentRunLedgerRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function GET(
  _request: Request,
  { params }: AgentRunLedgerRouteProps
) {
  const ledger = await getAgentRunLedger((await params).runId)

  if (!ledger) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json({ ledger })
}
