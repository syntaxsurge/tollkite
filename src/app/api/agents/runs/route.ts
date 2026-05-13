import { NextResponse } from 'next/server'

import { createAgentRunSchema } from '@/features/agents/schemas'
import { createAgentRun, listAgentRuns } from '@/features/agents/store'
import { getPublishedProducts } from '@/features/marketplace/products'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    runs: await listAgentRuns()
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = createAgentRunSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid agent run payload.',
        issues: parsed.error.flatten().fieldErrors
      },
      { status: 400 }
    )
  }

  const allowedTools =
    parsed.data.toolSelectionMode === 'manual'
      ? (parsed.data.allowedTools ?? [])
      : (await getPublishedProducts())
          .filter(product => product.isAgentReady)
          .map(product => product.slug)
  const run = await createAgentRun({
    ...parsed.data,
    allowedTools
  })

  return NextResponse.json(run)
}
