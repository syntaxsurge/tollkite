import { NextResponse } from 'next/server'

import {
  deleteAgentRun,
  syncAgentRunAsyncProviderStatus
} from '@/features/agents/store'
import { getPublicAppOrigin } from '@/lib/config/site'

export const dynamic = 'force-dynamic'

type AgentRunRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function GET(request: Request, { params }: AgentRunRouteProps) {
  const run = await syncAgentRunAsyncProviderStatus(
    (await params).runId,
    getAppOrigin(request)
  )

  if (!run) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json(run)
}

function getAppOrigin(request: Request) {
  return getPublicAppOrigin(request.url)
}

export async function DELETE(
  _request: Request,
  { params }: AgentRunRouteProps
) {
  const deleted = await deleteAgentRun((await params).runId)

  if (!deleted) {
    return NextResponse.json(
      { error: 'Agent run was not found.' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    deletedRunId: deleted.id,
    stopped: true
  })
}
