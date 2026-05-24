import { x402Client } from '@x402/core/client'
import {
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams,
  type ClientEvmSigner
} from '@x402/evm'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import {
  type x402PaymentResult,
  x402HTTPClient,
  wrapFetchWithPayment
} from '@x402/fetch'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'

import {
  type AgentPlanMetadata,
  buildAgentPlan,
  buildPlannerSummary,
  parseOpenAiJson
} from '@/features/agents/planner'
import type {
  AgentAction,
  AgentAsyncPollingResponse,
  AgentRun
} from '@/features/agents/types'
import { resolveProductPrice } from '@/features/marketplace/pricing'
import { getProductBySlug } from '@/features/marketplace/products'
import {
  buildExplorerUrl,
  type MarketplaceReceipt
} from '@/features/marketplace/receipts'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import {
  defaultAppChain,
  paymentTokenAddress,
  paymentTokenDecimals,
  paymentTokenTransferMethod
} from '@/lib/config/chains'
import {
  getAgentRunBytes32,
  getAgentRunVaultBudget,
  getAgentRunVaultAddress,
  getAgentRunVaultWriteAttempts,
  getAgentVaultPaymentId,
  parsePaymentAmountToAtomic,
  writeAgentRunVault
} from '@/lib/contracts/agent-run-vault'
import {
  extractEip7623FloorGasFromError,
  getBufferedContractWriteGasLimit
} from '@/lib/contracts/gas'
import { envClient } from '@/lib/env/env.client'
import { envServer } from '@/lib/env/env.server'
import {
  compactJsonPayload,
  compactProviderRequestTrace
} from '@/lib/utils/json-payload'

const asyncProviderPollIntervalMs = 5_000
const asyncProviderPollAttempts = 72
const agentPaymentTransactionMaxAttempts = 3
const agentPaidToolCallMaxRetries = 3
const agentPaidToolCallMaxAttempts = agentPaidToolCallMaxRetries + 1
const agentPaymentTransactionBaseRetryDelayMs = 750
const agentSignerBalancePollAttempts = 10
const agentSignerBalancePollDelayMs = 1_200

type AgentRunProgress = {
  actions: AgentAction[]
  summary?: string
}

type AgentRunProgressHandler = (
  progress: AgentRunProgress
) => Promise<void> | void

type AgentActionProgressHandler = (action: AgentAction) => Promise<void> | void

export async function executeAgentRunActions(
  run: AgentRun,
  shouldStop: () => boolean = () => false,
  appUrl = envClient.NEXT_PUBLIC_APP_URL,
  onProgress?: AgentRunProgressHandler
) {
  const plan =
    run.actions.length > 0
      ? {
          actions: run.actions,
          metadata: buildPlannerSummary(run, run.actions)
        }
      : await buildAgentPlan(run)
  const actions = plan.actions
  const completedActions: AgentAction[] = []
  let progressActions = actions
  let spendUsd = 0
  const publishProgress = async (summary?: string) => {
    await onProgress?.({
      actions: progressActions,
      summary
    })
  }
  const publishActionProgress = async (nextAction: AgentAction) => {
    progressActions = progressActions.map(action =>
      action.id === nextAction.id ? nextAction : action
    )
    await publishProgress(describeAgentActionProgress(nextAction))
  }

  await publishProgress(
    `The agent planned ${actions.length} paid action${
      actions.length === 1 ? '' : 's'
    } and is preparing x402 settlement.`
  )

  for (const action of actions) {
    if (action.status === 'completed') {
      completedActions.push(action)
      spendUsd = addActionSpend(spendUsd, action)
      await publishActionProgress(action)
      continue
    }

    if (shouldStop()) {
      const stoppedAction = {
        ...action,
        status: 'failed',
        errorMessage: 'The agent run was stopped before this action executed.',
        completedAt: new Date().toISOString()
      } satisfies AgentAction
      completedActions.push(stoppedAction)
      await publishActionProgress(stoppedAction)
      break
    }

    const result = await executeAgentAction(
      run,
      action,
      spendUsd,
      appUrl,
      publishActionProgress
    )

    spendUsd = addActionSpend(spendUsd, result)

    completedActions.push(result)
    await publishActionProgress(result)

    if (shouldStop()) {
      break
    }
  }

  const deliverables = await buildDeliverables(
    run,
    completedActions,
    plan.metadata
  )
  const completed = completedActions.every(
    action => action.status === 'completed'
  )
  const receiptCount = completedActions.filter(action => action.receipt).length

  return {
    actions: completedActions,
    deliverables,
    summary: completed
      ? receiptCount > 0
        ? `The launch-pack agent completed ${completedActions.length} actions, captured ${receiptCount} PYUSD receipt records, and prepared an auditable on-chain proof package.`
        : 'The launch-pack agent completed without receipt-backed paid actions.'
      : 'The launch-pack agent stopped before completing every selected paid action.',
    status: completed ? 'completed' : 'failed'
  } as const
}

async function executeAgentAction(
  run: AgentRun,
  action: AgentAction,
  currentSpendUsd: number,
  appUrl?: string,
  onProgress?: AgentActionProgressHandler
) {
  if (action.status === 'paid' && action.orderId && action.receipt && appUrl) {
    return await completeExistingPaidAction(action, appUrl, onProgress)
  }

  const product = await getProductBySlug(action.productSlug)

  if (!product) {
    return {
      ...action,
      status: 'failed',
      errorMessage: 'API product was not found.',
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  }

  const requestPayload = action.requestPayload
  const quotedPrice = await resolveProductPrice({
    product,
    requestPayload
  }).catch(error => ({
    error:
      error instanceof Error
        ? error.message
        : 'The agent could not quote this paid tool.'
  }))

  if ('error' in quotedPrice) {
    return {
      ...action,
      status: 'failed',
      errorMessage: quotedPrice.error,
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  }

  if (currentSpendUsd + quotedPrice.amountUsd > run.budgetCapUsdt) {
    return {
      ...action,
      status: 'skipped',
      amountUsdt: quotedPrice.amountLabel,
      errorMessage:
        'Skipped because the quoted PYUSD price would exceed the agent budget.',
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  }

  const started = {
    ...action,
    status: 'quoted',
    amountUsdt: quotedPrice.amountLabel,
    requestPayload,
    startedAt: action.startedAt ?? new Date().toISOString()
  } satisfies AgentAction
  await onProgress?.(started)

  if (!envServer.AGENT_SPENDER_PRIVATE_KEY || !appUrl) {
    return {
      ...started,
      status: 'failed',
      errorMessage:
        'Production agent payment signing is not configured. Set AGENT_SPENDER_PRIVATE_KEY and NEXT_PUBLIC_APP_URL so the vault-funded signer can settle x402 payments.',
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  }

  let advanced: AgentAction | null = null

  try {
    advanced = {
      ...(await advanceAgentVaultSpend({
        runId: run.id,
        action: started,
        amountUsd: quotedPrice.amountUsd,
        amountLabel: quotedPrice.amountLabel
      })),
      status: 'paid'
    } satisfies AgentAction
    await onProgress?.(advanced)
    const paymentReadinessAttempts = await ensureAgentPaymentTokenReady(
      quotedPrice.amountUsd
    )

    if (paymentReadinessAttempts.length > 0) {
      advanced = {
        ...advanced,
        vaultSpendAttempts: mergeVaultAttempts(
          advanced.vaultSpendAttempts,
          paymentReadinessAttempts
        )
      } satisfies AgentAction
      await onProgress?.(advanced)
    }

    let paidProgress = advanced
    const paidCall = await callPaidProductWithAgentWallet(
      run.id,
      advanced,
      appUrl,
      async (progress, pollingResponse) => {
        paidProgress = {
          ...paidProgress,
          responsePayload: buildPaidProductResponsePayload(progress),
          latestAsyncPollingResponse:
            pollingResponse ?? paidProgress.latestAsyncPollingResponse,
          asyncPollingResponses: pollingResponse
            ? [pollingResponse]
            : paidProgress.asyncPollingResponses,
          receipt: progress.receipt,
          orderId: progress.order?.id,
          requestId: progress.order?.requestId
        } satisfies AgentAction
        await onProgress?.(paidProgress)
      }
    )
    const paidResult = paidCall.result

    if (paidCall.attempts.length > 0) {
      paidProgress = {
        ...paidProgress,
        vaultSpendAttempts: mergeVaultAttempts(
          paidProgress.vaultSpendAttempts,
          paidCall.attempts
        )
      } satisfies AgentAction
    }

    const resultStatus =
      paidResult.order?.status === 'failed' ||
      paidResult.order?.status === 'expired' ||
      paidResult.order?.status === 'delta_payment_required'
        ? 'failed'
        : 'completed'

    const refundedAdvance =
      resultStatus === 'failed' && didEscrowRefundBuyer(paidResult)
        ? await refundAgentVaultAdvance({
            runId: run.id,
            action: advanced,
            amountUsd: quotedPrice.amountUsd,
            amountLabel: quotedPrice.amountLabel
          }).catch(error => ({
            error:
              error instanceof Error
                ? error.message
                : 'Unable to return the refunded x402 payment to the agent vault.',
            attempts: getAgentTransactionAttempts(error)
          }))
        : null
    const refundError =
      refundedAdvance && 'error' in refundedAdvance
        ? refundedAdvance.error
        : undefined
    const refundFields =
      refundedAdvance && !('error' in refundedAdvance) ? refundedAdvance : {}
    const refundErrorFields =
      refundedAdvance && 'error' in refundedAdvance
        ? {
            vaultRefundAttempts: refundedAdvance.attempts
          }
        : {}

    return {
      ...paidProgress,
      ...refundFields,
      ...refundErrorFields,
      status: resultStatus,
      responsePayload: buildPaidProductResponsePayload(paidResult),
      latestAsyncPollingResponse: paidProgress.latestAsyncPollingResponse,
      asyncPollingResponses: paidProgress.asyncPollingResponses,
      receipt: paidResult.receipt,
      orderId: paidResult.order?.id,
      requestId: paidResult.order?.requestId,
      errorMessage:
        resultStatus === 'failed'
          ? [
              describeAsyncOrderFailure(paidResult.order),
              refundError
                ? `The x402 payment was refunded to the signer, but the gateway could not return it to the agent vault: ${refundError}`
                : undefined
            ]
              .filter(Boolean)
              .join(' ')
          : undefined,
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  } catch (caughtError) {
    const escrowHandoffFailure = isAsyncEscrowHandoffFailure(caughtError)
    const refundedAdvance =
      advanced && !escrowHandoffFailure
        ? await refundAgentVaultAdvance({
            runId: run.id,
            action: advanced,
            amountUsd: quotedPrice.amountUsd,
            amountLabel: quotedPrice.amountLabel
          }).catch(error => ({
            error:
              error instanceof Error
                ? error.message
                : 'Unable to return the advanced vault spend.',
            attempts: getAgentTransactionAttempts(error)
          }))
        : null
    const refundError =
      refundedAdvance && 'error' in refundedAdvance
        ? refundedAdvance.error
        : undefined
    const refundFields =
      refundedAdvance && !('error' in refundedAdvance) ? refundedAdvance : {}
    const refundErrorFields =
      refundedAdvance && 'error' in refundedAdvance
        ? {
            vaultRefundAttempts: refundedAdvance.attempts
          }
        : {}
    const failedAction = advanced ?? started

    return {
      ...failedAction,
      ...refundFields,
      ...refundErrorFields,
      status: 'failed',
      vaultSpendAttempts: mergeVaultAttempts(
        failedAction.vaultSpendAttempts,
        getAgentTransactionAttempts(caughtError)
      ),
      errorMessage: [
        caughtError instanceof Error
          ? caughtError.message
          : 'The paid x402 request failed.',
        escrowHandoffFailure
          ? 'The x402 settlement already moved the advanced PYUSD out of the agent signer, so the gateway did not try to return funds from the signer. Retry escrow reservation with the floor-safe escrow gas path or reconcile the escrow balance before refunding the vault.'
          : undefined,
        refundError
          ? `the gateway advanced this action from the vault, but could not return the unused signer funds: ${refundError}`
          : undefined
      ]
        .filter(Boolean)
        .join(' '),
      completedAt: new Date().toISOString()
    } satisfies AgentAction
  }
}

function describeAgentActionProgress(action: AgentAction) {
  if (action.status === 'planned') {
    return `${action.productName} is queued.`
  }

  if (action.status === 'quoted') {
    return `${action.productName} was quoted at ${action.amountUsdt}; the gateway is advancing vault funds.`
  }

  if (action.status === 'paid') {
    return `${action.productName} is paid and running. Async tools stay in this state while the gateway polls the provider result.`
  }

  if (action.status === 'completed') {
    return `${action.productName} completed and returned a receipt-backed result.`
  }

  if (action.status === 'skipped') {
    return `${action.productName} was skipped: ${
      action.errorMessage ??
      'the action could not run inside the selected budget.'
    }`
  }

  return `${action.productName} failed: ${
    action.errorMessage ?? 'the paid action did not complete.'
  }`
}

function parseUsdtLabel(value: string) {
  const amount = Number(value.replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function addActionSpend(currentSpendUsd: number, action: AgentAction) {
  if (action.vaultAdvancedAmountUsdt && !action.vaultRefundedAmountUsdt) {
    return Number(
      (
        currentSpendUsd + parseUsdtLabel(action.vaultAdvancedAmountUsdt)
      ).toFixed(6)
    )
  }

  if (action.receipt) {
    return Number(
      (currentSpendUsd + parseUsdtLabel(action.receipt.amountUsdt)).toFixed(6)
    )
  }

  return currentSpendUsd
}

async function advanceAgentVaultSpend({
  runId,
  action,
  amountUsd,
  amountLabel
}: {
  runId: string
  action: AgentAction
  amountUsd: number
  amountLabel: string
}) {
  const paymentId = getAgentVaultPaymentId(runId, action.id)
  const result = await writeAgentRunVault({
    functionName: 'recordSpend',
    args: [
      getAgentRunBytes32(runId),
      paymentId,
      parsePaymentAmountToAtomic(amountUsd)
    ]
  })

  if (!result) {
    throw new Error(
      'AgentRunVault spend could not be advanced. Set NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS and AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY so the gateway can transfer the funded run budget to the agent signer before x402 settlement.'
    )
  }

  return {
    ...action,
    vaultPaymentId: paymentId,
    vaultAdvancedAmountUsdt: amountLabel,
    vaultSpendTxHash: result.txHash,
    vaultSpendExplorerUrl: result.explorerUrl,
    vaultSpendAttempts: result.attempts
  } satisfies AgentAction
}

async function refundAgentVaultAdvance({
  runId,
  action,
  amountUsd,
  amountLabel
}: {
  runId: string
  action: AgentAction
  amountUsd: number
  amountLabel: string
}) {
  if (!action.vaultPaymentId) {
    throw new Error('The vault payment ID is missing for this agent action.')
  }

  const requestedAmount = parsePaymentAmountToAtomic(amountUsd)
  const budget = await getAgentRunVaultBudget(runId).catch(() => null)
  const refundableAmount =
    budget && budget.spentAmount < requestedAmount
      ? budget.spentAmount
      : requestedAmount

  if (refundableAmount <= 0n) {
    return {
      vaultRefundedAmountUsdt: '0.00 PYUSD'
    } satisfies Partial<AgentAction>
  }

  const returnTx = await returnAgentSignerUsdtToVault(refundableAmount)
  const refund = await writeAgentRunVault({
    functionName: 'recordSpendRefund',
    args: [
      getAgentRunBytes32(runId),
      action.vaultPaymentId as Hex,
      refundableAmount
    ]
  })

  if (!refund) {
    throw new Error(
      'AgentRunVault refund record could not be written. The signer transfer was submitted, but the operator key or vault address is not configured for recordSpendRefund.'
    )
  }

  return {
    vaultRefundedAmountUsdt:
      refundableAmount === requestedAmount
        ? amountLabel
        : formatUsdtAmount(refundableAmount),
    vaultRefundTxHash: refund.txHash,
    vaultRefundExplorerUrl: refund.explorerUrl,
    vaultRefundAttempts: mergeVaultAttempts(returnTx.attempts, refund.attempts),
    vaultReturnTxHash: returnTx.txHash,
    vaultReturnExplorerUrl: returnTx.explorerUrl
  } satisfies Partial<AgentAction>
}

function mergeVaultAttempts(
  current: AgentAction['vaultSpendAttempts'],
  next: AgentAction['vaultSpendAttempts']
) {
  if (!next?.length) {
    return current
  }

  return [...(current ?? []), ...next]
}

async function callPaidProductWithAgentWallet(
  runId: string,
  action: AgentAction,
  appUrl: string,
  onProgress?: PaidProductProgressHandler
) {
  const privateKey = envServer.AGENT_SPENDER_PRIVATE_KEY

  if (!privateKey) {
    throw new Error('AGENT_SPENDER_PRIVATE_KEY is not configured.')
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex
  )
  const attempts: AgentAction['vaultSpendAttempts'] = []
  const client = registerExactEvmScheme(new x402Client(), {
    signer: buildAgentX402Signer(account),
    schemeOptions: {
      rpcUrl: defaultAppChain.viemChain.rpcUrls.default.http[0]
    }
  })
  const httpClient = new x402HTTPClient(client)
  const paidFetch = wrapFetchWithPayment(fetch, httpClient)
  let acceptedResult: PaidProductCallResponse | null = null

  for (let attempt = 1; attempt <= agentPaidToolCallMaxAttempts; attempt += 1) {
    try {
      const response = await paidFetch(
        `${appUrl}/api/x402/products/${action.productSlug}/call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-app-agent-run-id': runId
          },
          body: JSON.stringify(action.requestPayload)
        }
      )
      const paymentResult = await httpClient
        .processResponse(response.clone())
        .catch(() => null)
      const body = await readJsonResponse(response)

      if (!response.ok) {
        const message = await describeAgentPaidCallError(
          describePaidCallFailure(response, body, paymentResult),
          action
        )

        attempts.push({
          attempt,
          functionName: 'x402Payment',
          status: 'failed',
          message,
          createdAt: new Date().toISOString()
        })

        if (isPaidProductCallResponse(body)) {
          await onProgress?.(body)
          acceptedResult = body

          break
        }

        throw new AgentPaymentTransactionError(message, attempts)
      }

      attempts.push({
        attempt,
        functionName: 'x402Payment',
        status: 'succeeded',
        message: 'x402 payment settled and the provider request was accepted.',
        createdAt: new Date().toISOString()
      })

      await onProgress?.(body as PaidProductCallResponse)
      acceptedResult = body as PaidProductCallResponse

      break
    } catch (error) {
      const message = await describeAgentPaidCallError(error, action)
      const shouldRetry =
        attempt < agentPaidToolCallMaxAttempts &&
        isRetryableAgentPaymentTransactionError(message)
      const retryDelayMs = shouldRetry
        ? getAgentPaymentRetryDelayMs(attempt)
        : undefined

      attempts.push({
        attempt,
        functionName: 'x402Payment',
        status: 'failed',
        message,
        retryDelayMs,
        createdAt: new Date().toISOString()
      })

      if (!shouldRetry) {
        throw new AgentPaymentTransactionError(message, attempts)
      }

      await delay(retryDelayMs ?? 0)
    }
  }

  if (!acceptedResult) {
    throw new AgentPaymentTransactionError(
      `x402 payment failed after ${agentPaidToolCallMaxRetries} retries.`,
      attempts
    )
  }

  return {
    result: await waitForPaidProductCompletion({
      appUrl,
      initial: acceptedResult,
      onProgress
    }),
    attempts
  }
}

type PaidProductCallResponse = {
  order?: Partial<MarketplaceOrder>
  receipt?: MarketplaceReceipt
  data?: Record<string, unknown>
  pricing?: unknown
  provider?: unknown
  x402?: unknown
  escrow?: unknown
}

function isPaidProductCallResponse(
  value: unknown
): value is PaidProductCallResponse {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'order' in value &&
      value.order &&
      typeof value.order === 'object'
  )
}

type PaidProductProgressHandler = (
  result: PaidProductCallResponse,
  pollingResponse?: AgentAsyncPollingResponse
) => Promise<void> | void

type ProviderStatusResponse = {
  error?: string
  order?: MarketplaceOrder
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

async function completeExistingPaidAction(
  action: AgentAction,
  appUrl: string,
  onProgress?: AgentActionProgressHandler
) {
  let paidProgress = action
  const latestPoll =
    action.latestAsyncPollingResponse ?? action.asyncPollingResponses?.at(-1)
  const paidResult = await waitForPaidProductCompletion({
    appUrl,
    initial: {
      order: {
        id: action.orderId,
        status: latestPoll?.orderStatus ?? 'processing',
        externalJobId: latestPoll?.externalJobId,
        resultReleaseStatus: latestPoll?.resultReleaseStatus,
        resultUrl: latestPoll?.resultUrl
      } as PaidProductCallResponse['order'],
      receipt: action.receipt!,
      data: action.responsePayload ?? {},
      provider: action.responsePayload?.provider,
      pricing: action.responsePayload?.pricing,
      escrow: action.responsePayload?.escrow
    },
    onProgress: async (progress, pollingResponse) => {
      paidProgress = {
        ...paidProgress,
        responsePayload: buildPaidProductResponsePayload(progress),
        latestAsyncPollingResponse:
          pollingResponse ?? paidProgress.latestAsyncPollingResponse,
        asyncPollingResponses: pollingResponse
          ? [pollingResponse]
          : paidProgress.asyncPollingResponses,
        receipt: progress.receipt,
        orderId: progress.order?.id ?? paidProgress.orderId,
        requestId: progress.order?.requestId ?? paidProgress.requestId
      } satisfies AgentAction
      await onProgress?.(paidProgress)
    }
  })
  const resultStatus =
    paidResult.order?.status === 'failed' ||
    paidResult.order?.status === 'expired' ||
    paidResult.order?.status === 'delta_payment_required'
      ? 'failed'
      : 'completed'

  return {
    ...paidProgress,
    status: resultStatus,
    responsePayload: buildPaidProductResponsePayload(paidResult),
    receipt: paidResult.receipt,
    orderId: paidResult.order?.id ?? paidProgress.orderId,
    requestId: paidResult.order?.requestId ?? paidProgress.requestId,
    errorMessage:
      resultStatus === 'failed'
        ? describeAsyncOrderFailure(paidResult.order)
        : undefined,
    completedAt: new Date().toISOString()
  } satisfies AgentAction
}

async function waitForPaidProductCompletion({
  appUrl,
  initial,
  onProgress
}: {
  appUrl: string
  initial: PaidProductCallResponse
  onProgress?: PaidProductProgressHandler
}) {
  const order = initial.order

  if (!shouldPollPaidOrder(order)) {
    return normalizePaidProductResponse(initial, order)
  }

  let lastOrder = order

  for (let attempt = 1; attempt <= asyncProviderPollAttempts; attempt += 1) {
    if (attempt > 1) {
      await delay(asyncProviderPollIntervalMs)
    }

    const pollingUrl = `${appUrl}/api/orders/${encodeURIComponent(String(order?.id))}/provider-status`
    const pollingRequest = {
      method: 'GET',
      url: pollingUrl,
      headers: { Accept: 'application/json' },
      params: { orderId: String(order?.id ?? '') }
    }
    const response = await fetch(pollingUrl, {
      headers: pollingRequest.headers
    })
    const body = (await readJsonResponse(response)) as ProviderStatusResponse
    const pollingResponse = buildAsyncPollingResponse({
      attempt,
      pollingUrl,
      request: pollingRequest,
      httpStatus: response.status,
      body
    })

    if (!response.ok || !body.order) {
      const failedProgress = normalizePaidProductResponse(
        {
          ...initial,
          data: {
            ...initial.data,
            providerStatusError: body
          }
        },
        lastOrder
      )
      await onProgress?.(failedProgress, pollingResponse)
      throw new Error(
        body.error ??
          `Unable to poll async provider status (${response.status} ${response.statusText}).`
      )
    }

    lastOrder = body.order
    const next = normalizePaidProductResponse(
      {
        ...initial,
        order: body.order,
        data: buildProviderStatusData(body)
      },
      body.order
    )
    await onProgress?.(next, pollingResponse)

    if (!shouldPollPaidOrder(body.order)) {
      return next
    }
  }

  throw new Error(
    [
      `Async provider job ${lastOrder?.externalJobId ?? ''} did not finish before the agent polling window expired.`,
      'Open the order page to continue polling, or retry the agent after the provider job completes.'
    ]
      .filter(Boolean)
      .join(' ')
  )
}

function buildAsyncPollingResponse({
  attempt,
  pollingUrl,
  request,
  httpStatus,
  body
}: {
  attempt: number
  pollingUrl: string
  request: AgentAsyncPollingResponse['request']
  httpStatus: number
  body: ProviderStatusResponse
}): AgentAsyncPollingResponse {
  const resultUrl =
    body.order?.resultUrl ??
    body.provider?.resultUrl ??
    extractResultUrl(body.order?.responsePayload) ??
    extractResultUrl(body.provider?.responsePayload)

  return {
    id: `poll_${Date.now().toString(36)}_${attempt}`,
    attempt,
    polledAt: new Date().toISOString(),
    pollingUrl,
    request,
    httpStatus,
    orderStatus: body.order?.status,
    resultReleaseStatus: body.order?.resultReleaseStatus,
    externalJobId: body.order?.externalJobId ?? body.provider?.externalJobId,
    resultUrl,
    response: compactProviderStatusResponse(body)
  }
}

function buildPaidProductResponsePayload(result: PaidProductCallResponse) {
  const payload: Record<string, unknown> = {
    data: compactJsonPayload(result.data, 0),
    order: compactMarketplaceOrderForAgent(result.order),
    receipt: result.receipt,
    pricing: compactJsonPayload(result.pricing),
    provider: compactJsonPayload(result.provider, 0),
    x402: result.x402,
    escrow: compactJsonPayload(result.escrow)
  }
  const resultUrl =
    extractResultUrl(result.data) ??
    extractResultUrl(result.order?.responsePayload) ??
    result.order?.resultUrl

  if (resultUrl) {
    payload.resultUrl = resultUrl
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )
}

function compactProviderStatusResponse(
  body: ProviderStatusResponse
): Record<string, unknown> {
  return {
    order: compactMarketplaceOrderForAgent(body.order),
    provider: compactJsonPayload(body.provider, 0),
    pricing: compactJsonPayload(body.pricing),
    escrow: compactJsonPayload(body.escrow),
    error: body.error
  }
}

function compactMarketplaceOrderForAgent(
  order: PaidProductCallResponse['order']
) {
  if (!order) {
    return undefined
  }

  return {
    ...order,
    responsePayload: compactJsonPayload(order.responsePayload, 0),
    lockedResponsePayload: compactJsonPayload(order.lockedResponsePayload, 0),
    providerRequest: compactProviderRequestTrace(order.providerRequest)
  }
}

function normalizePaidProductResponse(
  response: PaidProductCallResponse,
  order: PaidProductCallResponse['order']
): PaidProductCallResponse {
  const data = response.data ?? {}

  return {
    ...response,
    order,
    data: {
      ...data,
      order,
      resultUrl: order?.resultUrl ?? extractResultUrl(data) ?? data.resultUrl,
      externalJobId: order?.externalJobId ?? data.externalJobId,
      status: order?.status ?? data.status,
      resultReleaseStatus:
        order?.resultReleaseStatus ?? data.resultReleaseStatus
    }
  }
}

function buildProviderStatusData(body: ProviderStatusResponse) {
  const order = body.order
  const responsePayload =
    order?.responsePayload ?? body.provider?.responsePayload
  const resultUrl =
    order?.resultUrl ??
    body.provider?.resultUrl ??
    extractResultUrl(responsePayload)

  return {
    status: order?.status ?? body.provider?.status,
    resultReleaseStatus: order?.resultReleaseStatus,
    externalJobId: order?.externalJobId ?? body.provider?.externalJobId,
    resultUrl,
    responsePayload,
    provider: body.provider,
    pricing: body.pricing,
    escrow: body.escrow,
    order
  } as Record<string, unknown>
}

function shouldPollPaidOrder(order: PaidProductCallResponse['order']) {
  if (!order?.id) {
    return false
  }

  if (
    order.status === 'completed' ||
    order.status === 'failed' ||
    order.status === 'expired' ||
    order.status === 'delta_payment_required'
  ) {
    return false
  }

  return Boolean(
    order.externalJobId ||
      order.resultReleaseStatus === 'provider_retrying' ||
      order.resultReleaseStatus === 'reserved'
  )
}

function extractResultUrl(value: unknown): string | undefined {
  const direct = getStringPath(value, [
    'resultUrl',
    'renderUrl',
    'previewUrl',
    'publicProjectUrl',
    'projectUrl',
    'cloneUrl',
    'outputUrl',
    'url'
  ])

  if (direct) {
    return direct
  }

  return getStringPath(value, [
    'result.resultUrl',
    'result.renderUrl',
    'result.previewUrl',
    'result.publicProjectUrl',
    'result.projectUrl',
    'result.cloneUrl',
    'result.outputUrl',
    'data.resultUrl',
    'data.renderUrl',
    'data.previewUrl',
    'data.publicProjectUrl',
    'data.projectUrl',
    'data.cloneUrl',
    'data.outputUrl'
  ])
}

function getStringPath(value: unknown, paths: string[]) {
  for (const path of paths) {
    const match = readPath(value, path)

    if (typeof match === 'string' && match.trim().length > 0) {
      return match
    }
  }

  return undefined
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[key]
  }, value)
}

function describeAsyncOrderFailure(order: PaidProductCallResponse['order']) {
  if (!order) {
    return 'The paid provider request failed.'
  }

  const providerError =
    typeof order.responsePayload === 'object' &&
    order.responsePayload &&
    'errorMessage' in order.responsePayload &&
    typeof order.responsePayload.errorMessage === 'string'
      ? order.responsePayload.errorMessage
      : undefined

  return (
    providerError ||
    `The provider job ended with status ${order.status}. Result release state: ${
      order.resultReleaseStatus ?? 'unknown'
    }.`
  )
}

function didEscrowRefundBuyer(result: PaidProductCallResponse) {
  return (
    result.order?.resultReleaseStatus === 'refunded' ||
    result.order?.escrowStatus === 'refunded' ||
    result.receipt?.escrowStatus === 'refunded'
  )
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const agentPublicClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})

const usdtAgentAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)'
])

async function returnAgentSignerUsdtToVault(amount: bigint) {
  const privateKey = envServer.AGENT_SPENDER_PRIVATE_KEY
  const vaultAddress = getAgentRunVaultAddress()

  if (!privateKey) {
    throw new Error('AGENT_SPENDER_PRIVATE_KEY is not configured.')
  }

  if (!vaultAddress) {
    throw new Error('NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS is not configured.')
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex
  )
  const signerBalance = await readAgentSignerUsdtBalance(account.address)

  if (signerBalance < amount) {
    throw new Error(
      `Agent signer cannot return unused PYUSD to the vault because it only has ${formatUsdtAmount(
        signerBalance
      )} available and ${formatUsdtAmount(
        amount
      )} was expected. This is a backend agent signer settlement-token balance issue, not the owner's ${defaultAppChain.nativeCurrency.symbol} gas balance.`
    )
  }

  const walletClient = createWalletClient({
    account,
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })
  const data = encodeFunctionData({
    abi: usdtAgentAbi,
    functionName: 'transfer',
    args: [vaultAddress, amount]
  })
  const { txHash, explorerUrl, attempts } = await sendAgentSignerTransaction({
    account,
    walletClient,
    functionName: 'signerUsdtReturn',
    to: paymentTokenAddress as Address,
    data,
    confirmedMessage:
      'Agent signer returned unused PYUSD to the agent run vault.',
    failureMessage: `Agent signer could not return unused PYUSD to the vault. Expected ${formatUsdtAmount(
      amount
    )} and available before return was ${formatUsdtAmount(
      signerBalance
    )}. This is usually a settlement-token balance or token-transfer issue, not the owner's ${defaultAppChain.nativeCurrency.symbol} gas balance.`
  })

  return {
    txHash,
    explorerUrl,
    attempts
  }
}

async function sendAgentSignerTransaction({
  account,
  walletClient,
  functionName,
  to,
  data,
  confirmedMessage,
  failureMessage
}: {
  account: PrivateKeyAccount
  walletClient: ReturnType<typeof createWalletClient>
  functionName: string
  to: Address
  data: Hex
  confirmedMessage: string
  failureMessage: string
}) {
  const attempts: AgentAction['vaultSpendAttempts'] = []
  let retryMinimumGas: bigint | undefined

  for (
    let attempt = 1;
    attempt <= agentPaymentTransactionMaxAttempts;
    attempt += 1
  ) {
    let txHash: Hex | null = null
    const gasLimit = getBufferedContractWriteGasLimit({
      data,
      minimumGas: retryMinimumGas
    })

    try {
      txHash = await walletClient.sendTransaction({
        account,
        chain: defaultAppChain.viemChain,
        to,
        data,
        gas: gasLimit
      })
      const receipt = await agentPublicClient.waitForTransactionReceipt({
        hash: txHash
      })

      if (receipt.status !== 'success') {
        throw new Error(`${functionName} transaction reverted: ${txHash}`)
      }

      const explorerUrl = buildExplorerUrl(txHash)

      attempts.push({
        attempt,
        functionName,
        status: 'succeeded',
        message: confirmedMessage,
        gasLimit: gasLimit.toString(),
        txHash,
        explorerUrl,
        createdAt: new Date().toISOString()
      })

      return {
        txHash,
        explorerUrl,
        attempts
      }
    } catch (error) {
      const message = describeTransactionError(error)
      retryMinimumGas =
        extractEip7623FloorGasFromError(error) ?? retryMinimumGas
      const shouldRetry =
        !txHash &&
        attempt < agentPaymentTransactionMaxAttempts &&
        isRetryableAgentPaymentTransactionError(message)
      const retryDelayMs = shouldRetry
        ? getAgentPaymentRetryDelayMs(attempt)
        : undefined

      attempts.push({
        attempt,
        functionName,
        status: 'failed',
        message,
        gasLimit: gasLimit.toString(),
        txHash,
        retryDelayMs,
        createdAt: new Date().toISOString()
      })

      if (!shouldRetry) {
        throw new AgentPaymentTransactionError(
          `${failureMessage} ${message}`,
          attempts
        )
      }

      await delay(retryDelayMs ?? 0)
    }
  }

  throw new AgentPaymentTransactionError(
    `${failureMessage} Transaction failed after ${agentPaymentTransactionMaxAttempts} attempts.`,
    attempts
  )
}

class AgentPaymentTransactionError extends Error {
  attempts: AgentAction['vaultSpendAttempts']

  constructor(message: string, attempts: AgentAction['vaultSpendAttempts']) {
    super(message)
    this.name = 'AgentPaymentTransactionError'
    this.attempts = attempts
  }
}

function getAgentPaymentTransactionAttempts(error: unknown) {
  return error instanceof AgentPaymentTransactionError
    ? (error.attempts ?? [])
    : []
}

function getAgentTransactionAttempts(error: unknown) {
  return [
    ...getAgentRunVaultWriteAttempts(error),
    ...getAgentPaymentTransactionAttempts(error)
  ]
}

function buildAgentX402Signer(account: PrivateKeyAccount): ClientEvmSigner {
  return {
    address: account.address,
    signTypedData: message =>
      account.signTypedData(
        message as Parameters<typeof account.signTypedData>[0]
      ),
    readContract: args => agentPublicClient.readContract(args),
    getTransactionCount: args =>
      agentPublicClient.getTransactionCount({ address: args.address }),
    estimateFeesPerGas: () => agentPublicClient.estimateFeesPerGas(),
    signTransaction: args =>
      account.signTransaction({
        ...args,
        gas: getBufferedContractWriteGasLimit({
          data: args.data,
          estimatedGas: args.gas,
          minimumGas: args.gas
        })
      } as Parameters<typeof account.signTransaction>[0])
  }
}

function isRetryableAgentPaymentTransactionError(message: string) {
  const lower = message.toLowerCase()

  if (
    lower.includes('over budget') ||
    lower.includes('insufficient balance') ||
    lower.includes('allowance_required') ||
    lower.includes('invalid signature') ||
    lower.includes('signatureexpired') ||
    lower.includes('invalid nonce') ||
    lower.includes('already used') ||
    lower.includes('reverted')
  ) {
    return false
  }

  return (
    lower.includes('gas limit below eip-7623 floor') ||
    lower.includes('failed to verify the fees') ||
    lower.includes('missing or invalid parameters') ||
    lower.includes('invalid_exact_evm_transaction_failed') ||
    lower.includes('payment settlement failed') ||
    lower.includes('settlement failed') ||
    lower.includes('out of gas') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('temporar') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('500') ||
    lower.includes('internal server error') ||
    lower.includes('bad gateway') ||
    lower.includes('503') ||
    lower.includes('nonce too low') ||
    lower.includes('underpriced')
  )
}

function getAgentPaymentRetryDelayMs(attempt: number) {
  return agentPaymentTransactionBaseRetryDelayMs * 2 ** (attempt - 1)
}

function describeTransactionError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string' ? error : 'Transaction failed.'
}

function isAsyncEscrowHandoffFailure(error: unknown) {
  const message = describeTransactionError(error).toLowerCase()

  return (
    message.includes('reservepayment escrow transaction') ||
    message.includes('async paid product call failed') ||
    message.includes('async_prepaid_handoff_failed') ||
    message.includes('could not finish the async provider handoff')
  )
}

async function describeAgentPaidCallError(error: unknown, action: AgentAction) {
  const message = describeTransactionError(error)
  const lower = message.toLowerCase()

  if (!lower.includes('permit2_insufficient_balance')) {
    return message
  }

  const privateKey = envServer.AGENT_SPENDER_PRIVATE_KEY
  const requiredAmount = parsePaymentAmountToAtomic(
    parseUsdtLabel(action.amountUsdt)
  )

  if (!privateKey || requiredAmount <= 0n) {
    return `Agent signer does not have enough PYUSD for x402 settlement. This is the backend agent signer's settlement-token balance, not the owner's ${defaultAppChain.nativeCurrency.symbol} gas balance. ${message}`
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex
  )
  const balance = await readAgentSignerUsdtBalance(account.address).catch(
    () => null
  )
  const balanceText =
    balance === null ? 'unreadable' : formatUsdtAmount(balance)

  return `Agent signer does not have enough PYUSD for x402 settlement. Required at least ${formatUsdtAmount(
    requiredAmount
  )}; available on the backend agent signer is ${balanceText}. This is not the owner's ${defaultAppChain.nativeCurrency.symbol} gas balance. ${message}`
}

async function ensureAgentPaymentTokenReady(amountUsd: number) {
  const privateKey = envServer.AGENT_SPENDER_PRIVATE_KEY

  if (!privateKey) {
    throw new Error('AGENT_SPENDER_PRIVATE_KEY is not configured.')
  }

  const requiredAmount = parseUnits(
    amountUsd.toFixed(Math.min(paymentTokenDecimals, 6)),
    paymentTokenDecimals
  )

  if (requiredAmount <= 0n) {
    return []
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex
  )
  const tokenAddress = paymentTokenAddress as Address
  await waitForAgentSignerUsdtBalance({
    ownerAddress: account.address,
    requiredAmount
  })

  if (paymentTokenTransferMethod !== 'permit2') {
    return []
  }

  const allowance = await agentPublicClient.readContract(
    getPermit2AllowanceReadParams({
      tokenAddress,
      ownerAddress: account.address
    })
  )

  if (allowance >= requiredAmount) {
    return []
  }

  const walletClient = createWalletClient({
    account,
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })
  const approval = createPermit2ApprovalTx(tokenAddress)
  const result = await sendAgentSignerTransaction({
    account,
    walletClient,
    functionName: 'permit2Approval',
    to: approval.to,
    data: approval.data,
    confirmedMessage:
      'Agent signer Permit2 allowance was approved for x402 settlement.',
    failureMessage: `Agent signer received vault PYUSD but could not submit the Permit2 approval. Fund the agent signer with a small amount of ${defaultAppChain.nativeCurrency.symbol} on ${defaultAppChain.shortName} for gas.`
  })

  await waitForAgentPermit2Allowance({
    tokenAddress,
    ownerAddress: account.address,
    requiredAmount
  })

  return result.attempts
}

async function readAgentSignerUsdtBalance(ownerAddress: Address) {
  return await agentPublicClient.readContract({
    address: paymentTokenAddress as Address,
    abi: usdtAgentAbi,
    functionName: 'balanceOf',
    args: [ownerAddress]
  })
}

async function waitForAgentSignerUsdtBalance({
  ownerAddress,
  requiredAmount
}: {
  ownerAddress: Address
  requiredAmount: bigint
}) {
  let lastBalance = 0n

  for (
    let attempt = 1;
    attempt <= agentSignerBalancePollAttempts;
    attempt += 1
  ) {
    lastBalance = await readAgentSignerUsdtBalance(ownerAddress)

    if (lastBalance >= requiredAmount) {
      return lastBalance
    }

    if (attempt < agentSignerBalancePollAttempts) {
      await delay(agentSignerBalancePollDelayMs)
    }
  }

  throw new Error(
    `Agent signer did not receive enough PYUSD from AgentRunVault after waiting for the recordSpend transfer to become readable. Required ${formatUsdtAmount(
      requiredAmount
    )}, available ${formatUsdtAmount(
      lastBalance
    )}. Confirm the run vault is funded and AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY can call recordSpend.`
  )
}

async function waitForAgentPermit2Allowance({
  tokenAddress,
  ownerAddress,
  requiredAmount
}: {
  tokenAddress: Address
  ownerAddress: Address
  requiredAmount: bigint
}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const allowance = await agentPublicClient.readContract(
      getPermit2AllowanceReadParams({
        tokenAddress,
        ownerAddress
      })
    )

    if (allowance >= requiredAmount) {
      return
    }

    await new Promise(resolve => setTimeout(resolve, 1200))
  }

  throw new Error(
    'Agent PYUSD Permit2 approval was submitted, but the allowance is not readable yet. Retry the agent run in a moment.'
  )
}

function formatUsdtAmount(amount: bigint) {
  return `${Number(formatUnits(amount, paymentTokenDecimals)).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 6
    }
  )} PYUSD`
}

async function readJsonResponse(response: Response) {
  const text = await response.text().catch(() => '')

  if (!text) {
    return {} as Record<string, unknown>
  }

  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { message: text }
  }
}

function describePaidCallFailure(
  response: Response,
  body: Record<string, unknown>,
  paymentResult: x402PaymentResult | null
) {
  if (paymentResult?.kind === 'settle_failed') {
    return (
      [
        paymentResult.settleResponse.errorMessage,
        paymentResult.settleResponse.errorReason
      ]
        .filter(Boolean)
        .join(' ') || 'PYUSD settlement failed.'
    )
  }

  if (paymentResult?.kind === 'payment_required') {
    return [
      paymentResult.paymentRequired.error,
      body.error,
      body.message,
      body.guidance
    ]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.length > 0
      )
      .join(' ')
  }

  if (paymentResult?.kind === 'error') {
    const resultBody =
      paymentResult.body &&
      typeof paymentResult.body === 'object' &&
      !Array.isArray(paymentResult.body)
        ? (paymentResult.body as Record<string, unknown>)
        : {}
    const message = describePaidCallFailureBody(response, resultBody)

    if (message) {
      return message
    }
  }

  return (
    describePaidCallFailureBody(response, body) ||
    `Paid product call failed with ${response.status} ${response.statusText}.`
  )
}

function describePaidCallFailureBody(
  response: Response,
  body: Record<string, unknown>
) {
  const values = [
    body.error,
    body.message,
    body.guidance,
    typeof body.settlement === 'object' && body.settlement
      ? JSON.stringify(body.settlement)
      : undefined,
    typeof body.details === 'object' && body.details
      ? JSON.stringify(body.details)
      : undefined
  ].filter(
    (value): value is string => typeof value === 'string' && value.length > 0
  )

  return values.join(' ')
}

async function buildDeliverables(
  run: AgentRun,
  actions: AgentAction[],
  planMetadata: AgentPlanMetadata
) {
  const completedActions = actions.filter(
    action => action.status === 'completed'
  )
  const paidCompletedActions = completedActions.filter(action => action.receipt)

  if (actions.length > 0 && paidCompletedActions.length === 0) {
    return buildFailedPaidActionDeliverables(run, actions, planMetadata)
  }

  if (envServer.AGENT_LLM_API_KEY) {
    const synthesized = await synthesizeWithOpenAi(
      run,
      actions,
      planMetadata
    ).catch(error => {
      console.warn('OpenAI synthesis failed; using fallback synthesis.', error)
      return null
    })

    if (synthesized) {
      return synthesized
    }
  }

  return buildFallbackDeliverables(run, actions, planMetadata)
}

function buildFailedPaidActionDeliverables(
  run: AgentRun,
  actions: AgentAction[],
  planMetadata: AgentPlanMetadata
) {
  const failed = actions.filter(action => action.status === 'failed')
  const skipped = actions.filter(action => action.status === 'skipped')

  return {
    ...planMetadata,
    launchBrief:
      'The agent did not produce a final launch pack because no paid tool returned a completed receipt-backed result.',
    developerCopy:
      'Retry the failed tools after funding and provider health are confirmed.',
    marketSignal:
      failed.length > 0
        ? `No external market signal is available. ${failed.length} paid action(s) failed and ${skipped.length} action(s) were skipped.`
        : 'No external market signal is available because the agent did not complete a paid action.',
    videoResultUrl: '',
    proofExplanation: `The production agent selected ${actions.length} tool(s), but no paid action completed with a receipt. The proof should preserve failed action reasons without presenting generated copy as externally verified evidence for: ${run.objective}`
  }
}

function buildFallbackDeliverables(
  run: AgentRun,
  actions: AgentAction[],
  planMetadata: AgentPlanMetadata
) {
  const completedActions = actions.filter(
    action => action.status === 'completed'
  )
  const asyncAction = completedActions.find(
    action =>
      Boolean(extractResultUrl(action.responsePayload)) ||
      Boolean(action.responsePayload?.externalJobId)
  )
  const videoResultUrl = extractResultUrl(asyncAction?.responsePayload)

  return {
    ...planMetadata,
    launchBrief: `The agent used ${completedActions.length} selected marketplace APIs for: ${run.objective}`,
    developerCopy: completedActions
      .map(action => `${action.productName}: ${action.status}`)
      .join('\n'),
    marketSignal:
      completedActions.length > 0
        ? `${completedActions.length} paid tool result(s) are attached to this run.`
        : undefined,
    videoResultUrl: videoResultUrl ?? ''
  }
}

type OpenAiSynthesisResponse = {
  launchBrief: string
  developerCopy: string
  marketSignal: string
  videoResultUrl: string
  proofExplanation: string
}

async function synthesizeWithOpenAi(
  run: AgentRun,
  actions: AgentAction[],
  planMetadata: AgentPlanMetadata
) {
  const model = envServer.AGENT_LLM_MODEL || 'gpt-5.2'
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${envServer.AGENT_LLM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: [
                'You are Launch Pack Agent synthesizer.',
                'Use the completed paid tool outputs, receipts, skipped tools, and objective to produce the final launch-pack deliverables.',
                'Do not invent receipts, transactions, or provider results.',
                'Only include videoResultUrl when a completed media action returned a final result, project, render, preview, clone, or output URL. Do not use queued or processing job IDs as final media output.',
                'Return only structured JSON that matches the schema.'
              ].join('\n')
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                objective: run.objective,
                sourceText: run.sourceText ?? '',
                budgetCapUsdt: run.budgetCapUsdt,
                planMetadata,
                actions: actions.map(action => ({
                  productSlug: action.productSlug,
                  productName: action.productName,
                  providerName: action.providerName,
                  status: action.status,
                  amountUsdt: action.amountUsdt,
                  rationale: action.planningRationale,
                  requestPayload: action.requestPayload,
                  responsePayload: compactForSynthesis(action.responsePayload),
                  receipt: action.receipt
                    ? {
                        id: action.receipt.id,
                        amountUsdt: action.receipt.amountUsdt,
                        txHash: action.receipt.txHash,
                        explorerUrl: action.receipt.explorerUrl
                      }
                    : undefined,
                  errorMessage: action.errorMessage
                }))
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'app_agent_synthesis',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'launchBrief',
              'developerCopy',
              'marketSignal',
              'videoResultUrl',
              'proofExplanation'
            ],
            properties: {
              launchBrief: { type: 'string' },
              developerCopy: { type: 'string' },
              marketSignal: { type: 'string' },
              videoResultUrl: { type: 'string' },
              proofExplanation: { type: 'string' }
            }
          }
        }
      }
    })
  })
  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!response.ok) {
    throw new Error(
      `OpenAI synthesis failed with ${response.status} ${response.statusText}: ${JSON.stringify(body)}`
    )
  }

  const synthesized = parseOpenAiJson<OpenAiSynthesisResponse>(body)

  if (!synthesized) {
    return null
  }

  return {
    ...planMetadata,
    synthesisModel: model,
    synthesisResponseId: typeof body?.id === 'string' ? body.id : undefined,
    ...synthesized
  }
}

function compactForSynthesis(value: unknown) {
  if (!value) {
    return undefined
  }

  const serialized = JSON.stringify(value)

  if (serialized.length <= 6000) {
    return value
  }

  return {
    truncated: true,
    preview: serialized.slice(0, 6000)
  }
}
