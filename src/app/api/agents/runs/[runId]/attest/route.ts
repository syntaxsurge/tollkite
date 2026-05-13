import { NextResponse } from 'next/server'

import { attestStoredAgentRun } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type AttestAgentRunRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function POST(
  _request: Request,
  { params }: AttestAgentRunRouteProps
) {
  const run = await attestStoredAgentRun((await params).runId)

  if (!run) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json(run)
}
