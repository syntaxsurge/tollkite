import {
  buildProofId,
  getAgentRunReceiptIds,
  hashAgentRunProof
} from '@/features/agents/proof'
import { attestAgentRunOnChain } from '@/features/agents/proof-attestation'
import { executeAgentRunActions } from '@/features/agents/runner'
import { getAgentTemplate } from '@/features/agents/templates'
import type {
  AgentAsyncPollingResponse,
  AgentLedgerEvent,
  AgentProof,
  AgentRun,
  CreateAgentRunInput
} from '@/features/agents/types'
import { buildExplorerUrl } from '@/features/marketplace/receipts'
import {
  getAgentRunBytes32,
  getAgentRunVaultBudget,
  getAgentRunVaultAddress,
  getAgentRunVaultExplorerUrl,
  getAgentSignerAddress,
  getPaymentTokenAddress,
  isActiveAgentRunVaultBudget,
  parsePaymentAmountToAtomic,
  writeAgentRunVault
} from '@/lib/contracts/agent-run-vault'
import { getConvexClient } from '@/lib/db/convex/client'
import {
  compactJsonPayload,
  compactProviderRequestTrace
} from '@/lib/utils/json-payload'

import { api } from '../../../convex/_generated/api'

type AgentGlobalStore = {
  runs: Map<string, AgentRun>
  proofs: Map<string, AgentProof>
  cancelledRuns: Set<string>
  loadedRuns?: boolean
  loadedProofs?: boolean
}

const globalStore = globalThis as typeof globalThis & {
  __appAgentStore?: AgentGlobalStore
}

const store =
  globalStore.__appAgentStore ??
  (globalStore.__appAgentStore = {
    runs: new Map<string, AgentRun>(),
    proofs: new Map<string, AgentProof>(),
    cancelledRuns: new Set<string>()
  })

store.cancelledRuns ??= new Set<string>()

const runs = store.runs
const proofs = store.proofs
const cancelledRuns = store.cancelledRuns

export async function listAgentRuns() {
  await loadAgentRuns()

  return Array.from(runs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )
}

export async function getAgentRun(runId: string) {
  await loadAgentRuns()

  const persistedRun = await getConvexClient()
    .query(api.agentState.getRun, { runKey: runId })
    .catch(() => null)

  if (isAgentRun(persistedRun)) {
    runs.set(persistedRun.id, persistedRun)

    return persistedRun
  }

  return runs.get(runId)
}

export async function getAgentProof(proofId: string) {
  await loadAgentProofs()

  return proofs.get(proofId)
}

export async function syncAgentRunAsyncProviderStatus(
  runId: string,
  appUrl: string
) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  const canonicalRun = await canonicalizeAgentPollingUrls(run, appUrl)
  const syncableAction = canonicalRun.actions.find(shouldSyncAsyncAction)

  if (!syncableAction?.orderId) {
    return canonicalRun
  }

  const pollingUrl = `${appUrl}/api/orders/${encodeURIComponent(syncableAction.orderId)}/provider-status`
  const pollingRequest = {
    method: 'GET',
    url: pollingUrl,
    headers: { Accept: 'application/json' },
    params: { orderId: syncableAction.orderId }
  }
  const response = await fetch(pollingUrl, {
    headers: pollingRequest.headers
  }).catch(() => null)

  if (!response) {
    return canonicalRun
  }

  const body = (await response
    .json()
    .catch(() => null)) as ProviderStatusResponse | null

  if (!body?.order) {
    return canonicalRun
  }

  const poll = buildStoredAsyncPollingResponse({
    action: syncableAction,
    pollingUrl,
    request: pollingRequest,
    httpStatus: response.status,
    body
  })
  const actionStatus = mapProviderStatusToAgentActionStatus(
    body.order.status,
    syncableAction.status
  )
  const nextAction = {
    ...syncableAction,
    status: actionStatus,
    responsePayload: buildStoredProviderStatusPayload(body),
    latestAsyncPollingResponse: poll,
    asyncPollingResponses: [poll],
    completedAt:
      actionStatus === 'completed' || actionStatus === 'failed'
        ? new Date().toISOString()
        : syncableAction.completedAt
  } satisfies AgentRun['actions'][number]
  const nextRun = {
    ...canonicalRun,
    actions: canonicalRun.actions.map(action =>
      action.id === nextAction.id ? nextAction : action
    ),
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(nextRun.id, nextRun)
  await persistAgentRun(nextRun)

  return nextRun
}

export async function createAgentRun(input: CreateAgentRunInput) {
  await loadAgentRuns()

  const now = new Date().toISOString()
  const runId = `run_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  const vaultAddress = getAgentRunVaultAddress() ?? undefined
  const template = getAgentTemplate(input.template)
  const run: AgentRun = {
    id: runId,
    template: template?.id ?? input.template ?? 'custom',
    title: template?.title ?? 'Custom Agent Run',
    objective: input.objective,
    sourceText: input.sourceText,
    ownerWallet: input.ownerWallet,
    budgetCapUsdt: input.budgetCapUsdt,
    maxPaidActions: input.maxPaidActions,
    allowedTools: input.allowedTools,
    mode: 'production',
    status: 'planned',
    fundingStatus: 'unfunded',
    vaultPaymentId: getAgentRunBytes32(runId),
    vaultAddress,
    vaultExplorerUrl: getAgentRunVaultExplorerUrl(),
    fundedAmountUsdt: '0.00 USDT',
    spentAmountUsdt: '0.00 USDT',
    reservedAmountUsdt: '0.00 USDT',
    refundedAmountUsdt: '0.00 USDT',
    availableAmountUsdt: '0.00 USDT',
    ledgerEvents: [],
    summary:
      'The launch-pack agent is ready to select paid tools, spend within budget, and prepare a on-chain proof.',
    deliverables: {},
    actions: [],
    createdAt: now,
    updatedAt: now
  }

  runs.set(run.id, run)
  cancelledRuns.delete(run.id)
  await persistAgentRun(run)

  return run
}

export async function deleteAgentRun(runId: string) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  cancelledRuns.add(runId)

  if (
    ['funded', 'partially_spent', 'refund_available'].includes(
      run.fundingStatus
    ) &&
    run.availableAmountUsdt !== '0.00 USDT'
  ) {
    await writeAgentRunVault({
      functionName: 'cancelRun',
      args: [getAgentRunBytes32(run.id)]
    }).catch(() => null)

    await writeAgentRunVault({
      functionName: 'refundUnused',
      args: [getAgentRunBytes32(run.id)]
    }).catch(() => null)
  }

  runs.delete(runId)
  await getConvexClient().mutation(api.agentState.deleteRun, { runKey: runId })
  Array.from(proofs.entries()).forEach(([proofId, proof]) => {
    if (proof.runId === runId) {
      proofs.delete(proofId)
    }
  })
  await getConvexClient().mutation(api.agentState.deleteProofsForRun, {
    runKey: runId
  })

  return run
}

export function isAgentRunCancelled(runId: string) {
  return cancelledRuns.has(runId)
}

export async function executeStoredAgentRun(runId: string, appUrl?: string) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  if (
    !['funded', 'partially_spent', 'refund_available'].includes(
      run.fundingStatus
    )
  ) {
    return {
      ...run,
      summary: 'Fund this agent run before it can spend USDT through x402.',
      updatedAt: new Date().toISOString()
    } satisfies AgentRun
  }

  const budget = await getAgentRunVaultBudget(run.id).catch(() => null)

  if (!isActiveAgentRunVaultBudget(budget) && budget?.state === 0) {
    const nextRun = resetRunFundingState(
      run,
      'This run is not funded in the current AgentRunVault. Fund the agent again before retrying paid actions.'
    )

    runs.set(run.id, nextRun)
    await persistAgentRun(nextRun)

    return nextRun
  }

  if (!isActiveAgentRunVaultBudget(budget)) {
    const nextRun = {
      ...run,
      status: 'failed',
      summary:
        'This run has an AgentRunVault budget, but it is no longer active for new paid actions. Refund unused budget, then create or fund a fresh run.',
      updatedAt: new Date().toISOString()
    } satisfies AgentRun

    runs.set(run.id, nextRun)
    await persistAgentRun(nextRun)

    return nextRun
  }

  const running = {
    ...run,
    status: 'running',
    fundingStatus: 'partially_spent',
    ledgerEvents: [
      ...run.ledgerEvents,
      buildLedgerEvent({
        type: 'run_started',
        label: 'Agent run started with a funded on-chain budget.'
      })
    ],
    updatedAt: new Date().toISOString()
  } satisfies AgentRun
  runs.set(run.id, running)
  await persistAgentRun(running)

  await writeAgentRunVault({
    functionName: 'markRunning',
    args: [getAgentRunBytes32(run.id)]
  }).catch(() => null)

  let latestRun = running
  const result = await executeAgentRunActions(
    running,
    () => isAgentRunCancelled(run.id),
    appUrl,
    async progress => {
      if (isAgentRunCancelled(run.id)) {
        return
      }

      latestRun = {
        ...latestRun,
        actions: progress.actions,
        summary: progress.summary ?? latestRun.summary,
        updatedAt: new Date().toISOString()
      } satisfies AgentRun
      runs.set(run.id, latestRun)
      await persistAgentRun(latestRun)
    }
  )

  if (isAgentRunCancelled(run.id)) {
    return null
  }

  const ledgerResult = await buildSpendLedger(running, result.actions)
  const nextRun = {
    ...latestRun,
    status: result.status,
    actions: result.actions,
    deliverables: result.deliverables,
    summary: result.summary,
    fundingStatus:
      ledgerResult.availableAmountUsdt === '0.00 USDT'
        ? 'partially_spent'
        : 'refund_available',
    spentAmountUsdt: ledgerResult.spentAmountUsdt,
    reservedAmountUsdt: ledgerResult.reservedAmountUsdt,
    availableAmountUsdt: ledgerResult.availableAmountUsdt,
    ledgerEvents: ledgerResult.ledgerEvents,
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(run.id, nextRun)
  await persistAgentRun(nextRun)

  await writeAgentRunVault({
    functionName: result.status === 'completed' ? 'markCompleted' : 'cancelRun',
    args: [getAgentRunBytes32(run.id)]
  }).catch(() => null)

  return nextRun
}

export async function prepareAgentRunFunding(runId: string) {
  const run = await getAgentRun(runId)
  const vaultAddress = getAgentRunVaultAddress()
  const agentSigner = getAgentSignerAddress()

  if (!run) {
    return null
  }

  const existingBudget = await getAgentRunVaultBudget(run.id).catch(() => null)

  if (isActiveAgentRunVaultBudget(existingBudget)) {
    return {
      error:
        'This agent run is already funded in the current AgentRunVault. Run the agent or refund unused budget before funding it again.'
    }
  }

  if (existingBudget && existingBudget.state !== 0) {
    return {
      error:
        'This agent run already has a finalized or inactive budget in the current AgentRunVault. Refund unused budget, then create a new run.'
    }
  }

  if (!vaultAddress || !agentSigner) {
    return {
      error:
        'Agent budget vault is not configured. Deploy AgentRunVault and set NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS plus AGENT_SPENDER_PRIVATE_KEY.'
    }
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24
  const nextRun = {
    ...run,
    fundingStatus: 'funding_pending',
    vaultAddress,
    vaultExplorerUrl: getAgentRunVaultExplorerUrl(),
    fundingExpiresAt: new Date(expiresAt * 1000).toISOString(),
    ledgerEvents: [
      ...run.ledgerEvents,
      buildLedgerEvent({
        type: 'funding_prepared',
        label: 'Funding request prepared for the agent run vault.',
        amountUsdt: `${run.budgetCapUsdt.toFixed(2)} USDT`
      })
    ],
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(run.id, nextRun)
  await persistAgentRun(nextRun)

  return {
    run: nextRun,
    funding: {
      runId: getAgentRunBytes32(run.id),
      vaultAddress,
      tokenAddress: getPaymentTokenAddress(),
      amount: parsePaymentAmountToAtomic(run.budgetCapUsdt).toString(),
      amountUsdt: `${run.budgetCapUsdt.toFixed(2)} USDT`,
      agentSigner,
      expiresAt
    }
  }
}

export async function confirmAgentRunFunding({
  runId,
  fundingTxHash,
  approvalTxHash
}: {
  runId: string
  fundingTxHash: string
  approvalTxHash?: string
}) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  const budget = await waitForActiveVaultBudget(run.id)

  if (!isActiveAgentRunVaultBudget(budget)) {
    return resetRunFundingState(
      run,
      'Funding transaction was not found in the current AgentRunVault. Confirm that your wallet submitted fundRun to the configured vault address, then fund the agent again.'
    )
  }

  const amountUsdt = `${run.budgetCapUsdt.toFixed(2)} USDT`
  const nextRun = {
    ...run,
    fundingStatus: 'funded',
    fundedAmountUsdt: amountUsdt,
    availableAmountUsdt: amountUsdt,
    fundingTxHash,
    fundingExplorerUrl: buildExplorerUrl(fundingTxHash),
    approvalTxHash,
    approvalExplorerUrl: buildExplorerUrl(approvalTxHash),
    ledgerEvents: [
      ...run.ledgerEvents,
      buildLedgerEvent({
        type: 'funded',
        label: 'User funded this autonomous agent run.',
        amountUsdt,
        txHash: fundingTxHash,
        explorerUrl: buildExplorerUrl(fundingTxHash)
      })
    ],
    summary:
      'The agent budget is funded. OpenAI can now select tools and the gateway can pay x402 calls inside this budget.',
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(run.id, nextRun)
  await persistAgentRun(nextRun)

  return nextRun
}

export async function refundAgentRunUnusedBudget({
  runId,
  refundTxHash
}: {
  runId: string
  refundTxHash?: string
}) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  const available = run.availableAmountUsdt
  const tx =
    refundTxHash ??
    (
      await writeAgentRunVault({
        functionName: 'refundUnused',
        args: [getAgentRunBytes32(run.id)]
      }).catch(() => null)
    )?.txHash

  const nextRun = {
    ...run,
    fundingStatus: 'refunded',
    refundedAmountUsdt: addUsdt(run.refundedAmountUsdt, available),
    availableAmountUsdt: '0.00 USDT',
    refundTxHash: tx,
    refundExplorerUrl: buildExplorerUrl(tx),
    ledgerEvents: [
      ...run.ledgerEvents,
      buildLedgerEvent({
        type: 'unused_refunded',
        label: 'Unused agent budget was returned to the owner.',
        amountUsdt: available,
        txHash: tx,
        explorerUrl: buildExplorerUrl(tx)
      })
    ],
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(run.id, nextRun)
  await persistAgentRun(nextRun)

  return nextRun
}

export async function getAgentRunLedger(runId: string) {
  return (await getAgentRun(runId))?.ledgerEvents ?? null
}

export async function attestStoredAgentRun(runId: string) {
  const run = await getAgentRun(runId)

  if (!run) {
    return null
  }

  const proofHash = hashAgentRunProof(run)
  const proofId = buildProofId(proofHash)
  const now = new Date().toISOString()
  const proofBase = {
    id: proofId,
    runId: run.id,
    ownerWallet: run.ownerWallet,
    proofHash,
    proofUri: `/proofs/${proofId}`,
    network: 'eip155:2368',
    receiptIds: getAgentRunReceiptIds(run.actions),
    totalSpendUsdt: calculateTotalSpend(run),
    createdAt: now
  } satisfies Omit<AgentProof, 'txHash' | 'explorerUrl'>

  const attestingRun = {
    ...run,
    status: 'attesting',
    updatedAt: now
  } satisfies AgentRun
  runs.set(run.id, attestingRun)
  await persistAgentRun(attestingRun)

  const attestation = await attestAgentRunOnChain(run, proofBase)
  const proof: AgentProof = {
    ...proofBase,
    txHash: attestation.txHash,
    explorerUrl: attestation.explorerUrl
  }
  const nextRun = {
    ...run,
    status: 'attested',
    proof,
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  proofs.set(proof.id, proof)
  runs.set(run.id, nextRun)
  await persistAgentProof(proof)
  await persistAgentRun(nextRun)

  return nextRun
}

export async function getAgentMetrics() {
  const allRuns = await listAgentRuns()
  const completed = allRuns.filter(run =>
    ['completed', 'attested'].includes(run.status)
  )
  const proofsCount = allRuns.filter(run => run.proof).length

  return {
    totalRuns: allRuns.length,
    completedRuns: completed.length,
    proofCount: proofsCount,
    totalSpendUsdt: allRuns
      .reduce((sum, run) => sum + Number(calculateTotalSpend(run)), 0)
      .toFixed(2)
  }
}

function calculateTotalSpend(run: AgentRun) {
  return run.actions
    .reduce((sum, action) => {
      if (action.status !== 'completed') {
        return sum
      }

      return sum + Number(action.amountUsdt.replace(' USDT', ''))
    }, 0)
    .toFixed(2)
}

function buildLedgerEvent({
  type,
  label,
  amountUsdt,
  txHash,
  explorerUrl,
  actionId
}: Omit<AgentLedgerEvent, 'id' | 'createdAt'>): AgentLedgerEvent {
  return {
    id: `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    type,
    label,
    amountUsdt,
    txHash,
    explorerUrl,
    actionId,
    createdAt: new Date().toISOString()
  }
}

function resetRunFundingState(run: AgentRun, summary: string) {
  return {
    ...run,
    status: 'planned',
    fundingStatus: 'unfunded',
    fundedAmountUsdt: '0.00 USDT',
    spentAmountUsdt: '0.00 USDT',
    reservedAmountUsdt: '0.00 USDT',
    refundedAmountUsdt: '0.00 USDT',
    availableAmountUsdt: '0.00 USDT',
    fundingTxHash: undefined,
    fundingExplorerUrl: undefined,
    approvalTxHash: undefined,
    approvalExplorerUrl: undefined,
    fundingExpiresAt: undefined,
    summary,
    updatedAt: new Date().toISOString()
  } satisfies AgentRun
}

async function waitForActiveVaultBudget(runId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const budget = await getAgentRunVaultBudget(runId).catch(() => null)

    if (isActiveAgentRunVaultBudget(budget)) {
      return budget
    }

    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
  }

  return await getAgentRunVaultBudget(runId).catch(() => null)
}

async function buildSpendLedger(run: AgentRun, actions: AgentRun['actions']) {
  const newEvents: AgentLedgerEvent[] = []
  let spent = 0

  for (const action of actions) {
    const advanced = parseUsdt(action.vaultAdvancedAmountUsdt)
    const refunded = parseUsdt(action.vaultRefundedAmountUsdt)

    if (advanced <= 0) {
      continue
    }

    spent += Math.max(0, advanced - refunded)
    newEvents.push(
      buildLedgerEvent({
        type: 'spend_recorded',
        label: `Agent advanced vault budget to pay ${action.productName}.`,
        amountUsdt: `${advanced.toFixed(2)} USDT`,
        txHash: action.vaultSpendTxHash ?? action.receipt?.txHash,
        explorerUrl:
          action.vaultSpendExplorerUrl ?? action.receipt?.explorerUrl,
        actionId: action.id
      })
    )

    if (refunded > 0) {
      newEvents.push(
        buildLedgerEvent({
          type: 'spend_refunded',
          label: `Unused agent signer funds were returned after ${action.productName}.`,
          amountUsdt: `${refunded.toFixed(2)} USDT`,
          txHash: action.vaultRefundTxHash ?? action.vaultReturnTxHash,
          explorerUrl:
            action.vaultRefundExplorerUrl ?? action.vaultReturnExplorerUrl,
          actionId: action.id
        })
      )
    }
  }

  const funded = parseUsdt(run.fundedAmountUsdt)
  const available = Math.max(0, funded - spent)

  return {
    spentAmountUsdt: `${spent.toFixed(2)} USDT`,
    reservedAmountUsdt: '0.00 USDT',
    availableAmountUsdt: `${available.toFixed(2)} USDT`,
    ledgerEvents: [
      ...run.ledgerEvents,
      ...newEvents,
      buildLedgerEvent({
        type: 'run_completed',
        label: 'Agent execution ended. Any remaining budget can be refunded.',
        amountUsdt: `${available.toFixed(2)} USDT`
      })
    ]
  }
}

async function loadAgentRuns() {
  if (store.loadedRuns) {
    return
  }

  const rows = await getConvexClient().query(api.agentState.listRuns, {})
  runs.clear()

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isAgentRun(row)) {
        runs.set(row.id, row)
      }
    }
  }

  store.loadedRuns = true
}

async function loadAgentProofs() {
  if (store.loadedProofs) {
    return
  }

  const rows = await getConvexClient().query(api.agentState.listProofs, {})
  proofs.clear()

  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (isAgentProof(row)) {
        proofs.set(row.id, row)
      }
    }
  }

  store.loadedProofs = true
}

async function persistAgentRun(run: AgentRun) {
  await getConvexClient().mutation(api.agentState.upsertRun, {
    runKey: run.id,
    runJson: JSON.stringify(createPersistableAgentRun(run))
  })
}

async function persistAgentProof(proof: AgentProof) {
  await getConvexClient().mutation(api.agentState.upsertProof, {
    proofKey: proof.id,
    proofJson: JSON.stringify(proof)
  })
}

function parseUsdt(value: string | null | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function addUsdt(first: string, second: string) {
  return `${(parseUsdt(first) + parseUsdt(second)).toFixed(2)} USDT`
}

function isAgentRun(value: unknown): value is AgentRun {
  if (!value || typeof value !== 'object') {
    return false
  }

  const run = value as Partial<AgentRun>

  return (
    typeof run.id === 'string' &&
    typeof run.title === 'string' &&
    typeof run.objective === 'string' &&
    typeof run.ownerWallet === 'string' &&
    typeof run.status === 'string' &&
    Array.isArray(run.actions) &&
    typeof run.createdAt === 'string'
  )
}

function isAgentProof(value: unknown): value is AgentProof {
  if (!value || typeof value !== 'object') {
    return false
  }

  const proof = value as Partial<AgentProof>

  return (
    typeof proof.id === 'string' &&
    typeof proof.runId === 'string' &&
    typeof proof.ownerWallet === 'string' &&
    typeof proof.proofHash === 'string' &&
    typeof proof.createdAt === 'string'
  )
}

type ProviderStatusResponse = {
  error?: string
  order?: {
    id?: string
    status?: string
    externalJobId?: string
    resultReleaseStatus?: string
    resultUrl?: string
    responsePayload?: unknown
    providerRequest?: unknown
  }
  provider?: {
    status?: string
    externalJobId?: string
    resultUrl?: string
    responsePayload?: unknown
    errorMessage?: string
  }
  pricing?: unknown
  escrow?: unknown
}

function createPersistableAgentRun(run: AgentRun): AgentRun {
  return {
    ...run,
    actions: run.actions.map(action => ({
      ...action,
      responsePayload: compactJsonPayload(
        action.responsePayload,
        0
      ) as AgentRun['actions'][number]['responsePayload'],
      latestAsyncPollingResponse: compactAsyncPollingResponse(
        action.latestAsyncPollingResponse
      ),
      asyncPollingResponses: action.latestAsyncPollingResponse
        ? [compactAsyncPollingResponse(action.latestAsyncPollingResponse)!]
        : action.asyncPollingResponses?.slice(-1).flatMap(poll => {
            const compactPoll = compactAsyncPollingResponse(poll)

            return compactPoll ? [compactPoll] : []
          })
    }))
  }
}

function compactAsyncPollingResponse(
  poll: AgentAsyncPollingResponse | undefined
): AgentAsyncPollingResponse | undefined {
  if (!poll) {
    return undefined
  }

  return {
    ...poll,
    response: compactJsonPayload(poll.response, 0) as Record<string, unknown>
  }
}

function shouldSyncAsyncAction(action: AgentRun['actions'][number]) {
  if (!action.orderId || action.status !== 'paid') {
    return false
  }

  const latestPoll =
    action.latestAsyncPollingResponse ?? action.asyncPollingResponses?.at(-1)

  return !isTerminalProviderStatus(latestPoll?.orderStatus)
}

async function canonicalizeAgentPollingUrls(run: AgentRun, appUrl: string) {
  let changed = false
  const actions: AgentRun['actions'] = run.actions.map(
    (action): AgentRun['actions'][number] => {
      const latestAsyncPollingResponse = action.latestAsyncPollingResponse
        ? canonicalizePollingResponse(action.latestAsyncPollingResponse, appUrl)
        : undefined
      const asyncPollingResponses = action.asyncPollingResponses?.map(poll =>
        canonicalizePollingResponse(poll, appUrl)
      )

      if (
        latestAsyncPollingResponse !== action.latestAsyncPollingResponse ||
        asyncPollingResponses?.some(
          (poll, index) => poll !== action.asyncPollingResponses?.[index]
        )
      ) {
        changed = true

        return {
          ...action,
          latestAsyncPollingResponse,
          asyncPollingResponses
        }
      }

      return action
    }
  )

  if (!changed) {
    return run
  }

  const nextRun = {
    ...run,
    actions,
    updatedAt: new Date().toISOString()
  } satisfies AgentRun

  runs.set(nextRun.id, nextRun)
  await persistAgentRun(nextRun)

  return nextRun
}

function canonicalizePollingResponse(
  poll: AgentAsyncPollingResponse,
  appUrl: string
): AgentAsyncPollingResponse {
  const pollingUrl = canonicalizeProviderStatusUrl(poll.pollingUrl, appUrl)
  const requestUrl = canonicalizeProviderStatusUrl(poll.request.url, appUrl)

  if (pollingUrl === poll.pollingUrl && requestUrl === poll.request.url) {
    return poll
  }

  return {
    ...poll,
    pollingUrl,
    request: {
      ...poll.request,
      url: requestUrl
    }
  }
}

function canonicalizeProviderStatusUrl(value: string, appUrl: string) {
  try {
    const url = new URL(value)

    if (!/^\/api\/orders\/[^/]+\/provider-status$/.test(url.pathname)) {
      return value
    }

    return new URL(`${url.pathname}${url.search}`, appUrl).toString()
  } catch {
    return value
  }
}

function buildStoredAsyncPollingResponse({
  action,
  pollingUrl,
  request,
  httpStatus,
  body
}: {
  action: AgentRun['actions'][number]
  pollingUrl: string
  request: AgentAsyncPollingResponse['request']
  httpStatus: number
  body: ProviderStatusResponse
}): AgentAsyncPollingResponse {
  const priorAttempt =
    action.latestAsyncPollingResponse?.attempt ??
    action.asyncPollingResponses?.at(-1)?.attempt ??
    0
  const resultUrl = extractResultUrlFromProviderStatus(body)

  return {
    id: `poll_${Date.now().toString(36)}_${priorAttempt + 1}`,
    attempt: priorAttempt + 1,
    polledAt: new Date().toISOString(),
    pollingUrl,
    request,
    httpStatus,
    orderStatus: body.order?.status,
    resultReleaseStatus: body.order?.resultReleaseStatus,
    externalJobId: body.order?.externalJobId ?? body.provider?.externalJobId,
    resultUrl,
    response: buildStoredProviderStatusPayload(body)
  }
}

function buildStoredProviderStatusPayload(
  body: ProviderStatusResponse
): Record<string, unknown> {
  const resultUrl = extractResultUrlFromProviderStatus(body)

  return {
    status: body.order?.status ?? body.provider?.status,
    resultReleaseStatus: body.order?.resultReleaseStatus,
    externalJobId: body.order?.externalJobId ?? body.provider?.externalJobId,
    resultUrl,
    order: body.order
      ? {
          id: body.order.id,
          status: body.order.status,
          externalJobId: body.order.externalJobId,
          resultReleaseStatus: body.order.resultReleaseStatus,
          resultUrl: body.order.resultUrl,
          providerRequest: compactProviderRequestTrace(
            body.order.providerRequest
          ),
          responsePayload: compactJsonPayload(body.order.responsePayload, 0)
        }
      : undefined,
    provider: compactJsonPayload(body.provider, 0),
    pricing: compactJsonPayload(body.pricing),
    escrow: compactJsonPayload(body.escrow),
    error: body.error
  }
}

function mapProviderStatusToAgentActionStatus(
  status: string | undefined,
  current: AgentRun['actions'][number]['status']
) {
  if (status === 'completed') {
    return 'completed'
  }

  if (status === 'failed' || status === 'expired') {
    return 'failed'
  }

  return current
}

function isTerminalProviderStatus(status: string | undefined) {
  return status === 'completed' || status === 'failed' || status === 'expired'
}

function extractResultUrlFromProviderStatus(body: ProviderStatusResponse) {
  return (
    body.order?.resultUrl ??
    body.provider?.resultUrl ??
    readStringPath(body.order?.responsePayload, 'previewUrl') ??
    readStringPath(body.provider?.responsePayload, 'previewUrl') ??
    readStringPath(body.order?.responsePayload, 'renderUrl') ??
    readStringPath(body.provider?.responsePayload, 'renderUrl') ??
    readStringPath(body.order?.responsePayload, 'resultUrl') ??
    readStringPath(body.provider?.responsePayload, 'resultUrl') ??
    readStringPath(body.order?.responsePayload, 'result.previewUrl') ??
    readStringPath(body.provider?.responsePayload, 'result.previewUrl')
  )
}

function readStringPath(value: unknown, path: string) {
  const result = path.split('.').reduce<unknown>((current, part) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[part]
  }, value)

  return typeof result === 'string' && result.trim() ? result : undefined
}
