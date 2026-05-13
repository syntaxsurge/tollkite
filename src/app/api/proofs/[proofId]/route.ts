import { NextResponse } from 'next/server'

import { getAgentProof, listAgentRuns } from '@/features/agents/store'

export const dynamic = 'force-dynamic'

type ProofRouteProps = {
  params: Promise<{
    proofId: string
  }>
}

export async function GET(_request: Request, { params }: ProofRouteProps) {
  const proof = await getAgentProof((await params).proofId)

  if (!proof) {
    return NextResponse.json({ error: 'Proof was not found.' }, { status: 404 })
  }

  const run = (await listAgentRuns()).find(item => item.id === proof.runId)

  return NextResponse.json({
    proof,
    run: run
      ? {
          id: run.id,
          title: run.title,
          objective: run.objective,
          status: run.status,
          summary: run.summary,
          deliverables: run.deliverables,
          actionCount: run.actions.length,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt
        }
      : null
  })
}
