import { NextResponse } from 'next/server'

import { getOperationalReadiness } from '@/lib/operations/readiness'

export const dynamic = 'force-dynamic'

export async function GET() {
  const readiness = await getOperationalReadiness()

  return NextResponse.json({
    status: readiness.attentionCount === 0 ? 'ready' : 'attention',
    readyChecks: readiness.readyCount,
    attentionChecks: readiness.attentionCount,
    checks: readiness.items
  })
}
