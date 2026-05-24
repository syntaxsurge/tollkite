import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  isAddress,
  keccak256,
  parseUnits,
  toBytes,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { buildExplorerUrl } from '@/features/marketplace/receipts'
import {
  defaultAppChain,
  getExplorerAddressUrl,
  paymentTokenDecimals,
  paymentTokenAddress
} from '@/lib/config/chains'
import {
  extractEip7623FloorGasFromError,
  getBufferedContractWriteGasLimit
} from '@/lib/contracts/gas'
import { envClient } from '@/lib/env/env.client'
import { envServer } from '@/lib/env/env.server'

export type AgentVaultWriteResult = {
  txHash: Hex
  explorerUrl: string | null
  attempts: AgentVaultWriteAttempt[]
}

export type AgentRunVaultFunctionName =
  | 'markRunning'
  | 'recordSpend'
  | 'recordSpendRefund'
  | 'markCompleted'
  | 'cancelRun'
  | 'refundUnused'

export type AgentVaultWriteAttempt = {
  attempt: number
  functionName: AgentRunVaultFunctionName
  status: 'failed' | 'succeeded'
  message: string
  gasLimit?: string
  txHash?: Hex | null
  explorerUrl?: string | null
  retryDelayMs?: number
  createdAt: string
}

export type AgentRunVaultBudget = {
  owner: Address
  agentSigner: Address
  token: Address
  fundedAmount: bigint
  spentAmount: bigint
  refundedAmount: bigint
  expiresAt: bigint
  state: number
  createdAt: bigint
  updatedAt: bigint
}

export const agentRunVaultAbi = [
  {
    type: 'function',
    name: 'fundRun',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'runId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'agentSigner', type: 'address' },
      { name: 'expiresAt', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'markRunning',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'runId', type: 'bytes32' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'recordSpend',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'runId', type: 'bytes32' },
      { name: 'paymentId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'recordSpendRefund',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'runId', type: 'bytes32' },
      { name: 'paymentId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'markCompleted',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'runId', type: 'bytes32' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'cancelRun',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'runId', type: 'bytes32' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'refundUnused',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'runId', type: 'bytes32' }],
    outputs: []
  },
  {
    type: 'function',
    name: 'budgetOf',
    stateMutability: 'view',
    inputs: [{ name: 'runId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'agentSigner', type: 'address' },
          { name: 'token', type: 'address' },
          { name: 'fundedAmount', type: 'uint256' },
          { name: 'spentAmount', type: 'uint256' },
          { name: 'refundedAmount', type: 'uint256' },
          { name: 'expiresAt', type: 'uint256' },
          { name: 'state', type: 'uint8' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'updatedAt', type: 'uint256' }
        ]
      }
    ]
  }
] as const

export const erc20ApprovalAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }]
  }
] as const

const publicClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})
const agentRunVaultWriteMaxAttempts = 3
const agentRunVaultWriteBaseRetryDelayMs = 750

export function getAgentRunVaultAddress() {
  const address = envClient.NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS

  return address && isAddress(address) ? address : null
}

export function getAgentRunVaultExplorerUrl() {
  return getExplorerAddressUrl(getAgentRunVaultAddress(), defaultAppChain.id)
}

export function getAgentRunVaultOperatorPrivateKey() {
  const privateKey = envServer.AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY

  if (!privateKey) {
    return null
  }

  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
}

export function getAgentSignerAddress() {
  const privateKey = envServer.AGENT_SPENDER_PRIVATE_KEY

  if (!privateKey) {
    return null
  }

  return privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as Hex
  ).address
}

export function getAgentRunBytes32(runId: string) {
  return keccak256(toBytes(runId))
}

export function getAgentVaultPaymentId(runId: string, actionId: string) {
  return keccak256(toBytes(`${runId}:${actionId}`))
}

export function parsePaymentAmountToAtomic(amount: number | string) {
  return parseUnits(
    Number(amount).toFixed(Math.min(paymentTokenDecimals, 6)),
    paymentTokenDecimals
  )
}

export function formatAtomicPaymentAmount(amount: bigint) {
  return `${Number(formatUnits(amount, paymentTokenDecimals)).toFixed(2)} PYUSD`
}

export function getPaymentTokenAddress() {
  return paymentTokenAddress as Address
}

export async function getAgentRunVaultBudget(runId: string) {
  const address = getAgentRunVaultAddress()

  if (!address) {
    return null
  }

  const budget = await publicClient.readContract({
    address,
    abi: agentRunVaultAbi,
    functionName: 'budgetOf',
    args: [getAgentRunBytes32(runId)]
  })

  return normalizeAgentRunVaultBudget(budget)
}

export function isActiveAgentRunVaultBudget(
  budget: AgentRunVaultBudget | null
) {
  if (!budget) {
    return false
  }

  const now = BigInt(Math.floor(Date.now() / 1000))

  return (
    (budget.state === 1 || budget.state === 2) &&
    budget.fundedAmount > budget.spentAmount + budget.refundedAmount &&
    budget.expiresAt > now
  )
}

export async function writeAgentRunVault({
  functionName,
  args
}: {
  functionName: AgentRunVaultFunctionName
  args: readonly [Hex] | readonly [Hex, Hex, bigint]
}): Promise<AgentVaultWriteResult | null> {
  const address = getAgentRunVaultAddress()
  const privateKey = getAgentRunVaultOperatorPrivateKey()

  if (!address || !privateKey) {
    return null
  }

  const account = privateKeyToAccount(privateKey as Hex)
  const walletClient = createWalletClient({
    account,
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })
  const attempts: AgentVaultWriteAttempt[] = []
  let retryMinimumGas: bigint | undefined

  for (
    let attempt = 1;
    attempt <= agentRunVaultWriteMaxAttempts;
    attempt += 1
  ) {
    let txHash: Hex | null = null
    let gasLimit: bigint | undefined

    try {
      const { request } = await publicClient.simulateContract({
        address,
        abi: agentRunVaultAbi,
        functionName,
        args,
        account
      })
      const gasRequest = request as typeof request & {
        data?: Hex
        gas?: bigint
      }
      gasLimit = getBufferedContractWriteGasLimit({
        data: gasRequest.data,
        estimatedGas: gasRequest.gas,
        minimumGas: retryMinimumGas
      })
      txHash = await walletClient.writeContract({
        ...request,
        gas: gasLimit
      })
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash
      })

      if (receipt.status !== 'success') {
        throw new Error(`AgentRunVault ${functionName} transaction reverted.`)
      }

      const explorerUrl = buildExplorerUrl(txHash)

      attempts.push({
        attempt,
        functionName,
        status: 'succeeded',
        message: `AgentRunVault ${functionName} transaction confirmed.`,
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
      const message = describeContractWriteError(error)
      retryMinimumGas =
        extractEip7623FloorGasFromError(error) ?? retryMinimumGas
      const shouldRetry =
        !txHash &&
        attempt < agentRunVaultWriteMaxAttempts &&
        isRetryableAgentRunVaultWriteError(message)
      const retryDelayMs = shouldRetry
        ? getExponentialRetryDelayMs(attempt)
        : undefined

      attempts.push({
        attempt,
        functionName,
        status: 'failed',
        message,
        gasLimit: gasLimit?.toString(),
        txHash,
        retryDelayMs,
        createdAt: new Date().toISOString()
      })

      if (!shouldRetry) {
        throw new AgentRunVaultWriteError(message, attempts)
      }

      await wait(retryDelayMs)
    }
  }

  throw new AgentRunVaultWriteError(
    `AgentRunVault ${functionName} transaction failed after ${agentRunVaultWriteMaxAttempts} attempts.`,
    attempts
  )
}

export class AgentRunVaultWriteError extends Error {
  attempts: AgentVaultWriteAttempt[]

  constructor(message: string, attempts: AgentVaultWriteAttempt[]) {
    super(message)
    this.name = 'AgentRunVaultWriteError'
    this.attempts = attempts
  }
}

export function getAgentRunVaultWriteAttempts(error: unknown) {
  return error instanceof AgentRunVaultWriteError ? error.attempts : []
}

function isRetryableAgentRunVaultWriteError(message: string) {
  const lower = message.toLowerCase()

  if (
    lower.includes('agentrunvault: over budget') ||
    lower.includes('reverted') ||
    lower.includes('not authorized') ||
    lower.includes('invalid amount') ||
    lower.includes('invalid payment')
  ) {
    return false
  }

  return (
    lower.includes('gas limit below eip-7623 floor') ||
    lower.includes('failed to verify the fees') ||
    lower.includes('missing or invalid parameters') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network') ||
    lower.includes('connection') ||
    lower.includes('temporar') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('nonce too low') ||
    lower.includes('underpriced')
  )
}

function getExponentialRetryDelayMs(attempt: number) {
  return agentRunVaultWriteBaseRetryDelayMs * 2 ** (attempt - 1)
}

function describeContractWriteError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string' ? error : 'AgentRunVault write failed.'
}

function wait(delayMs = 0) {
  return new Promise<void>(resolve => setTimeout(resolve, delayMs))
}

function normalizeAgentRunVaultBudget(value: unknown): AgentRunVaultBudget {
  if (Array.isArray(value)) {
    return {
      owner: value[0] as Address,
      agentSigner: value[1] as Address,
      token: value[2] as Address,
      fundedAmount: BigInt(value[3] ?? 0),
      spentAmount: BigInt(value[4] ?? 0),
      refundedAmount: BigInt(value[5] ?? 0),
      expiresAt: BigInt(value[6] ?? 0),
      state: Number(value[7] ?? 0),
      createdAt: BigInt(value[8] ?? 0),
      updatedAt: BigInt(value[9] ?? 0)
    }
  }

  const budget = value as Partial<AgentRunVaultBudget> | null
  const zeroAddress = '0x0000000000000000000000000000000000000000'

  return {
    owner: (budget?.owner ?? zeroAddress) as Address,
    agentSigner: (budget?.agentSigner ?? zeroAddress) as Address,
    token: (budget?.token ?? zeroAddress) as Address,
    fundedAmount: BigInt(budget?.fundedAmount ?? 0),
    spentAmount: BigInt(budget?.spentAmount ?? 0),
    refundedAmount: BigInt(budget?.refundedAmount ?? 0),
    expiresAt: BigInt(budget?.expiresAt ?? 0),
    state: Number(budget?.state ?? 0),
    createdAt: BigInt(budget?.createdAt ?? 0),
    updatedAt: BigInt(budget?.updatedAt ?? 0)
  }
}
