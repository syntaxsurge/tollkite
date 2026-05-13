import { NextResponse } from 'next/server'

import { executeStoredAgentRun } from '@/features/agents/store'
import { getPublicAppOrigin } from '@/lib/config/site'

export const dynamic = 'force-dynamic'

type ExecuteAgentRunRouteProps = {
  params: Promise<{
    runId: string
  }>
}

export async function POST(
  request: Request,
  { params }: ExecuteAgentRunRouteProps
) {
  const run = await executeStoredAgentRun(
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
