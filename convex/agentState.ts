import { v } from 'convex/values'

import { mutation, query } from './_generated/server'

const runStatus = new Set([
  'planned',
  'running',
  'completed',
  'failed',
  'attesting',
  'attested'
])

export const listRuns = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('agentRuns').collect()

    return rows.map((row: any) => parseJson(row.runJson)).filter(Boolean)
  }
})

export const getRun = query({
  args: { runKey: v.string() },
  handler: async (ctx: any, args: { runKey: string }) => {
    const row = await ctx.db
      .query('agentRuns')
      .withIndex('by_run_key', (q: any) => q.eq('runKey', args.runKey))
      .first()

    return row ? parseJson(row.runJson) : null
  }
})

export const upsertRun = mutation({
  args: {
    runKey: v.string(),
    runJson: v.string()
  },
  handler: async (ctx: any, args: { runKey: string; runJson: string }) => {
    const run = parseJson(args.runJson) as Record<string, any> | null

    if (!run) {
      throw new Error('Agent run JSON must be an object.')
    }

    const existing = await ctx.db
      .query('agentRuns')
      .withIndex('by_run_key', (q: any) => q.eq('runKey', args.runKey))
      .first()
    const now = Date.now()
    const row = {
      runKey: args.runKey,
      runJson: args.runJson,
      ownerWallet: String(run.ownerWallet ?? ''),
      template: String(run.template ?? 'custom'),
      objective: String(run.objective ?? ''),
      sourceText: run.sourceText,
      budgetCapUsdt: Number(run.budgetCapUsdt ?? 0),
      maxPaidActions: Number(run.maxPaidActions ?? 0),
      allowedToolsJson: JSON.stringify(run.allowedTools ?? []),
      mode: run.mode === 'demo' ? 'demo' : 'production',
      status: toRunStatus(run.status),
      summary: String(run.summary ?? ''),
      deliverablesJson: JSON.stringify(run.deliverables ?? {}),
      proofId: run.proof?.id,
      updatedAt: parseDate(run.updatedAt) ?? now
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return parseJson(args.runJson)
    }

    await ctx.db.insert('agentRuns', {
      ...row,
      createdAt: parseDate(run.createdAt) ?? now
    })

    return parseJson(args.runJson)
  }
})

export const deleteRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx: any, args: { runKey: string }) => {
    const row = await ctx.db
      .query('agentRuns')
      .withIndex('by_run_key', (q: any) => q.eq('runKey', args.runKey))
      .first()

    if (!row) {
      return false
    }

    await ctx.db.delete(row._id)
    return true
  }
})

export const listProofs = query({
  args: {},
  handler: async (ctx: any) => {
    const rows = await ctx.db.query('agentProofs').collect()

    return rows.map((row: any) => parseJson(row.proofJson)).filter(Boolean)
  }
})

export const getProof = query({
  args: { proofKey: v.string() },
  handler: async (ctx: any, args: { proofKey: string }) => {
    const row = await ctx.db
      .query('agentProofs')
      .withIndex('by_proof_key', (q: any) => q.eq('proofKey', args.proofKey))
      .first()

    return row ? parseJson(row.proofJson) : null
  }
})

export const upsertProof = mutation({
  args: {
    proofKey: v.string(),
    proofJson: v.string()
  },
  handler: async (ctx: any, args: { proofKey: string; proofJson: string }) => {
    const proof = parseJson(args.proofJson) as Record<string, any> | null

    if (!proof) {
      throw new Error('Agent proof JSON must be an object.')
    }

    const existing = await ctx.db
      .query('agentProofs')
      .withIndex('by_proof_key', (q: any) => q.eq('proofKey', args.proofKey))
      .first()
    const run = await ctx.db
      .query('agentRuns')
      .withIndex('by_run_key', (q: any) => q.eq('runKey', proof.runId))
      .first()
    const now = Date.now()
    const row = {
      proofKey: args.proofKey,
      proofJson: args.proofJson,
      runId: run?._id,
      runKey: proof.runId,
      ownerWallet: String(proof.ownerWallet ?? ''),
      proofHash: String(proof.proofHash ?? ''),
      proofUri: String(proof.proofUri ?? ''),
      network: 'eip155:2368' as const,
      txHash: String(proof.txHash ?? ''),
      explorerUrl: proof.explorerUrl ?? undefined,
      receiptIdsJson: JSON.stringify(proof.receiptIds ?? []),
      totalSpendUsdt: String(proof.totalSpendUsdt ?? '0.00 USDT'),
      createdAt: parseDate(proof.createdAt) ?? now
    }

    if (existing) {
      await ctx.db.patch(existing._id, row)
      return parseJson(args.proofJson)
    }

    await ctx.db.insert('agentProofs', row)

    return parseJson(args.proofJson)
  }
})

export const deleteProofsForRun = mutation({
  args: { runKey: v.string() },
  handler: async (ctx: any, args: { runKey: string }) => {
    const rows = await ctx.db
      .query('agentProofs')
      .withIndex('by_run_key', (q: any) => q.eq('runKey', args.runKey))
      .collect()

    for (const row of rows) {
      await ctx.db.delete(row._id)
    }

    return rows.length
  }
})

function parseJson(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function toRunStatus(status: unknown) {
  return typeof status === 'string' && runStatus.has(status)
    ? status
    : 'planned'
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const time = Date.parse(value)

  return Number.isFinite(time) ? time : null
}
