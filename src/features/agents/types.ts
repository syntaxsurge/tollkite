import type { MarketplaceReceipt } from '@/features/marketplace/receipts'

export type AgentRunStatus =
  | 'planned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'attesting'
  | 'attested'

export type AgentActionStatus =
  | 'planned'
  | 'quoted'
  | 'paid'
  | 'completed'
  | 'skipped'
  | 'failed'

export type AgentRunMode = 'production'
export type AgentPlannerMode = 'openai' | 'deterministic'
export type AgentFundingStatus =
  | 'unfunded'
  | 'funding_pending'
  | 'funded'
  | 'partially_spent'
  | 'refund_available'
  | 'refunded'

export type AgentLedgerEventType =
  | 'funding_prepared'
  | 'funded'
  | 'run_started'
  | 'spend_recorded'
  | 'spend_refunded'
  | 'run_completed'
  | 'unused_refunded'

export type AgentLedgerEvent = {
  id: string
  type: AgentLedgerEventType
  label: string
  amountUsdt?: string
  txHash?: string | null
  explorerUrl?: string | null
  actionId?: string
  createdAt: string
}

export type AgentToolSlug = string

export type AgentSkippedTool = {
  slug: AgentToolSlug
  productName?: string
  reason: string
}

export type AgentAsyncPollingResponse = {
  id: string
  attempt: number
  polledAt: string
  pollingUrl: string
  request: {
    method: string
    url: string
    headers: Record<string, string>
    params: Record<string, string>
  }
  httpStatus: number
  orderStatus?: string
  resultReleaseStatus?: string
  externalJobId?: string
  resultUrl?: string
  response: Record<string, unknown>
}

export type AgentActionVaultAttempt = {
  attempt: number
  functionName: string
  status: 'failed' | 'succeeded'
  message: string
  gasLimit?: string
  txHash?: string | null
  explorerUrl?: string | null
  retryDelayMs?: number
  createdAt: string
}

export type AgentAction = {
  id: string
  runId: string
  productSlug: AgentToolSlug
  productName: string
  providerName: string
  status: AgentActionStatus
  amountUsdt: string
  objective: string
  planningRationale?: string
  plannerScore?: number
  requestPayload: Record<string, unknown>
  responsePayload?: Record<string, unknown>
  latestAsyncPollingResponse?: AgentAsyncPollingResponse
  asyncPollingResponses?: AgentAsyncPollingResponse[]
  receipt?: MarketplaceReceipt
  orderId?: string
  requestId?: string
  vaultPaymentId?: string
  vaultAdvancedAmountUsdt?: string
  vaultSpendTxHash?: string | null
  vaultSpendExplorerUrl?: string | null
  vaultSpendAttempts?: AgentActionVaultAttempt[]
  vaultRefundedAmountUsdt?: string
  vaultRefundTxHash?: string | null
  vaultRefundExplorerUrl?: string | null
  vaultRefundAttempts?: AgentActionVaultAttempt[]
  vaultReturnTxHash?: string | null
  vaultReturnExplorerUrl?: string | null
  errorMessage?: string
  startedAt?: string
  completedAt?: string
}

export type AgentProof = {
  id: string
  runId: string
  ownerWallet: string
  proofHash: `0x${string}`
  proofUri: string
  network: 'eip155:2368'
  txHash: string | null
  explorerUrl: string | null
  receiptIds: string[]
  totalSpendUsdt: string
  createdAt: string
}

export type AgentRun = {
  id: string
  template: string
  title: string
  objective: string
  sourceText?: string
  ownerWallet: string
  budgetCapUsdt: number
  maxPaidActions: number
  allowedTools: AgentToolSlug[]
  mode: AgentRunMode
  status: AgentRunStatus
  fundingStatus: AgentFundingStatus
  vaultPaymentId?: string
  vaultAddress?: string
  vaultExplorerUrl?: string | null
  fundedAmountUsdt: string
  spentAmountUsdt: string
  reservedAmountUsdt: string
  refundedAmountUsdt: string
  availableAmountUsdt: string
  fundingTxHash?: string
  fundingExplorerUrl?: string | null
  approvalTxHash?: string
  approvalExplorerUrl?: string | null
  refundTxHash?: string
  refundExplorerUrl?: string | null
  fundingExpiresAt?: string
  ledgerEvents: AgentLedgerEvent[]
  summary: string
  deliverables: {
    plannerMode?: AgentPlannerMode
    plannerModel?: string
    plannerResponseId?: string
    planningPrompt?: string
    toolSelectionRationale?: string
    skippedTools?: AgentSkippedTool[]
    expectedDeliverables?: string[]
    budgetInstruction?: string
    budgetStrategy?: string
    synthesisInstructions?: string
    synthesisModel?: string
    synthesisResponseId?: string
    proofExplanation?: string
    launchBrief?: string
    developerCopy?: string
    marketSignal?: string
    videoResultUrl?: string
  }
  actions: AgentAction[]
  proof?: AgentProof
  createdAt: string
  updatedAt: string
}

export type CreateAgentRunInput = {
  template?: string
  objective: string
  sourceText?: string
  ownerWallet: string
  budgetCapUsdt: number
  maxPaidActions: number
  allowedTools: AgentToolSlug[]
  mode: AgentRunMode
}
