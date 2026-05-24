'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Activity,
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock,
  ExternalLink,
  FileCheck2,
  History,
  Link2,
  type LucideIcon,
  Network,
  Play,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Undo2,
  WalletCards
} from 'lucide-react'
import {
  createPublicClient,
  encodeFunctionData,
  formatUnits,
  http,
  isAddress,
  numberToHex,
  type Address,
  type Hex
} from 'viem'

import { JsonViewer } from '@/components/data-display/json-viewer'
import { MarkdownViewer } from '@/components/data-display/markdown-viewer'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import {
  agentActionStatusLabels,
  agentRunStatusDetails,
  agentRunStatusLabels
} from '@/features/agents/status'
import type { AgentLedgerEvent, AgentRun } from '@/features/agents/types'
import { useAutoPolling } from '@/hooks/use-auto-polling'
import { defaultAppChain, getExplorerTransactionUrl } from '@/lib/config/chains'
import {
  agentRunVaultAbi,
  erc20ApprovalAbi
} from '@/lib/contracts/agent-run-vault'

type AgentOutputItem = {
  id: string
  label: string
  kind: 'text' | 'video' | 'image' | 'link'
  value: string
  source: string
}

type AgentOutputCandidate = {
  id: string
  label: string
  source: string
  value?: string
  kind?: AgentOutputItem['kind']
}

type ExtractedOutput = {
  path: string
  value: string
  kind: AgentOutputItem['kind']
}

type AgentAsyncPoll = NonNullable<
  AgentRun['actions'][number]['asyncPollingResponses']
>[number]

type AgentRunClientProps = {
  runId: string
  initialRun: AgentRun | null
}

type EthereumProvider = {
  isMetaMask?: boolean
  providers?: EthereumProvider[]
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type FundingPrepareResponse = {
  run: AgentRun
  funding: {
    runId: Hex
    vaultAddress: Address
    tokenAddress: Address
    amount: string
    amountUsdt: string
    agentSigner: Address
    expiresAt: number
  }
  error?: string
}

const publicClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})
const AGENT_RUN_POLL_INTERVAL_MS = 8000
const agentRunPollingStatuses = new Set<AgentRun['status']>([
  'running',
  'attesting'
])

export function AgentRunClient({ runId, initialRun }: AgentRunClientProps) {
  return (
    <WalletAddressConsumer>
      {({ address }) => (
        <AgentRunContent
          runId={runId}
          initialRun={initialRun}
          address={address}
        />
      )}
    </WalletAddressConsumer>
  )
}

function AgentRunContent({
  runId,
  initialRun,
  address
}: AgentRunClientProps & { address: string | null }) {
  const [run, setRun] = useState<AgentRun | null>(initialRun)
  const [status, setStatus] = useState('')
  const [isFunding, setIsFunding] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [isAttesting, setIsAttesting] = useState(false)
  const [isRefreshingRun, setIsRefreshingRun] = useState(false)
  const refreshInFlightRef = useRef(false)
  const autoResumeInFlightRef = useRef(false)

  useEffect(() => {
    if (run) {
      return
    }

    const saved = window.sessionStorage.getItem(`app:agent-run:${runId}`)

    if (saved) {
      setRun(JSON.parse(saved) as AgentRun)
    }
  }, [run, runId])

  const completedPaidActions = useMemo(
    () =>
      run?.actions.filter(
        action => action.status === 'completed' && action.receipt
      ).length ?? 0,
    [run?.actions]
  )
  const shouldPollRun =
    Boolean(run) &&
    (isRunning ||
      isAttesting ||
      agentRunPollingStatuses.has(run?.status ?? 'planned') ||
      Boolean(run?.actions.some(shouldPollAsyncActionOnClient)))

  useAutoPolling({
    enabled: shouldPollRun,
    intervalMs: AGENT_RUN_POLL_INTERVAL_MS,
    onPoll: refreshRun
  })

  useEffect(() => {
    if (
      !run ||
      isRunning ||
      autoResumeInFlightRef.current ||
      !shouldResumePlannedActions(run)
    ) {
      return
    }

    autoResumeInFlightRef.current = true
    setStatus('Async tool completed. Continuing the remaining planned actions.')
    void executeRun().finally(() => {
      autoResumeInFlightRef.current = false
    })
  }, [isRunning, run])

  async function refreshRun() {
    if (refreshInFlightRef.current) {
      return
    }

    refreshInFlightRef.current = true
    setIsRefreshingRun(true)

    try {
      const response = await fetch(`/api/agents/runs/${runId}`, {
        headers: {
          Accept: 'application/json'
        }
      })
      const body = (await response.json()) as AgentRun & { error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to refresh the agent run.')
      }

      persistRun(body)

      if (['completed', 'failed', 'attested'].includes(body.status)) {
        setStatus(
          body.status === 'completed'
            ? 'Agent run completed paid actions and prepared deliverables.'
            : body.status === 'attested'
              ? 'Proof hash attested on-chain and ready for public audit.'
              : body.summary
        )
      }
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to refresh the agent run.'
      )
    } finally {
      refreshInFlightRef.current = false
      setIsRefreshingRun(false)
    }
  }

  async function fundRun() {
    setIsFunding(true)
    setStatus('Preparing the agent budget vault transaction.')

    try {
      const fundingWallet = await requestFundingWalletAddress(address)
      const prepareResponse = await fetch(
        `/api/agents/runs/${runId}/funding/prepare`,
        { method: 'POST' }
      )
      const prepared = (await prepareResponse.json()) as FundingPrepareResponse

      if (!prepareResponse.ok || prepared.error) {
        throw new Error(prepared.error ?? 'Unable to prepare agent funding.')
      }

      setRun(prepared.run)
      const requiredAmount = BigInt(prepared.funding.amount)
      const tokenState = await readFundingTokenState({
        tokenAddress: prepared.funding.tokenAddress,
        ownerAddress: fundingWallet,
        spenderAddress: prepared.funding.vaultAddress
      })

      if (tokenState.balance < requiredAmount) {
        throw new Error(
          `Your connected wallet has ${formatTokenAmount(
            tokenState.balance,
            tokenState.decimals,
            tokenState.symbol
          )}, but this run needs ${formatTokenAmount(
            requiredAmount,
            tokenState.decimals,
            tokenState.symbol
          )}. Fund the wallet with the configured settlement token on ${defaultAppChain.shortName}, then try again.`
        )
      }

      let approvalTxHash: Hex | undefined

      if (tokenState.allowance < requiredAmount) {
        setStatus('Open MetaMask and approve PYUSD for the agent run vault.')
        approvalTxHash = await sendBrowserWalletTransaction({
          from: fundingWallet,
          to: prepared.funding.tokenAddress,
          data: encodeFunctionData({
            abi: erc20ApprovalAbi,
            functionName: 'approve',
            args: [
              prepared.funding.vaultAddress,
              BigInt(prepared.funding.amount)
            ]
          })
        })

        await waitForSuccessfulTransaction(
          approvalTxHash,
          'PYUSD approval transaction reverted.'
        )

        const nextAllowance = await readFundingTokenAllowance({
          tokenAddress: prepared.funding.tokenAddress,
          ownerAddress: fundingWallet,
          spenderAddress: prepared.funding.vaultAddress
        })

        if (nextAllowance < requiredAmount) {
          throw new Error(
            `The approval transaction completed, but the vault allowance is only ${formatTokenAmount(
              nextAllowance,
              tokenState.decimals,
              tokenState.symbol
            )}. Approve the full ${formatTokenAmount(
              requiredAmount,
              tokenState.decimals,
              tokenState.symbol
            )} budget before funding.`
          )
        }
      }

      setStatus('Open MetaMask again to fund the agent run vault.')
      const fundingTxHash = await sendBrowserWalletTransaction({
        from: fundingWallet,
        to: prepared.funding.vaultAddress,
        data: encodeFunctionData({
          abi: agentRunVaultAbi,
          functionName: 'fundRun',
          args: [
            prepared.funding.runId,
            prepared.funding.tokenAddress,
            BigInt(prepared.funding.amount),
            prepared.funding.agentSigner,
            BigInt(prepared.funding.expiresAt)
          ]
        })
      })

      await waitForSuccessfulTransaction(
        fundingTxHash,
        'AgentRunVault funding transaction reverted.'
      )

      const confirmResponse = await fetch(
        `/api/agents/runs/${runId}/funding/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fundingTxHash, approvalTxHash })
        }
      )
      const body = (await confirmResponse.json()) as AgentRun & {
        error?: string
      }

      if (!confirmResponse.ok) {
        if (body.id) {
          persistRun(body)
        }

        throw new Error(body.error ?? 'Unable to confirm funding.')
      }

      persistRun(body)
      setStatus('Agent budget funded. The agent can now run paid actions.')
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to fund the agent.'
      )
    } finally {
      setIsFunding(false)
    }
  }

  async function executeRun() {
    setIsRunning(true)
    setStatus('')

    try {
      const response = await fetch(`/api/agents/runs/${runId}/execute`, {
        method: 'POST'
      })
      const body = (await response.json()) as AgentRun & { error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to execute the agent run.')
      }

      persistRun(body)
      setStatus(
        body.status === 'completed'
          ? 'Agent run completed paid actions and prepared deliverables.'
          : body.status === 'failed'
            ? body.summary
            : ''
      )
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to execute the agent run.'
      )
    } finally {
      setIsRunning(false)
    }
  }

  async function refundUnusedBudget() {
    setIsRefunding(true)
    setStatus('')

    try {
      const response = await fetch(`/api/agents/runs/${runId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const body = (await response.json()) as AgentRun & { error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to refund unused budget.')
      }

      persistRun(body)
      setStatus('Unused budget marked as refunded.')
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to refund unused budget.'
      )
    } finally {
      setIsRefunding(false)
    }
  }

  async function attestRun() {
    setIsAttesting(true)
    setStatus('')

    try {
      const response = await fetch(`/api/agents/runs/${runId}/attest`, {
        method: 'POST'
      })
      const body = (await response.json()) as AgentRun & { error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to attest the agent run.')
      }

      persistRun(body)
      setStatus('Proof hash attested on-chain and ready for public audit.')
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to attest the agent run.'
      )
    } finally {
      setIsAttesting(false)
    }
  }

  function persistRun(nextRun: AgentRun) {
    try {
      window.sessionStorage.setItem(
        `app:agent-run:${nextRun.id}`,
        JSON.stringify(nextRun)
      )
      nextRun.actions.forEach(action => {
        if (action.receipt) {
          window.sessionStorage.setItem(
            `app:receipt:${action.receipt.id}`,
            JSON.stringify(action.receipt)
          )
        }
      })
    } catch {
      window.sessionStorage.removeItem(`app:agent-run:${nextRun.id}`)
    }

    setRun(nextRun)
  }

  if (!run) {
    return (
      <Card>
        <p className='font-semibold'>Agent run not found</p>
        <p className='text-foreground/65 mt-2 text-sm leading-6'>
          The run is not available in this browser session.
        </p>
      </Card>
    )
  }

  const canRun =
    ['planned', 'failed'].includes(run.status) &&
    ['funded', 'partially_spent', 'refund_available'].includes(
      run.fundingStatus
    ) &&
    run.availableAmountUsdt !== '0.00 PYUSD'
  const canRefund =
    ['failed', 'completed', 'attested'].includes(run.status) &&
    run.fundingStatus === 'refund_available' &&
    run.availableAmountUsdt !== '0.00 PYUSD'
  const finalOutputs = collectFinalOutputs(run)
  const runControlStatus = getVisibleRunControlStatus(run, status)

  return (
    <div className='space-y-5'>
      <section className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='space-y-5'>
          <RunSummaryCard
            run={run}
            completedPaidActions={completedPaidActions}
          />
        </div>

        <RunControlPanel
          run={run}
          address={address}
          status={runControlStatus}
          isFunding={isFunding}
          isRunning={isRunning}
          isRefunding={isRefunding}
          isAttesting={isAttesting}
          isRefreshingRun={isRefreshingRun}
          canRun={canRun}
          canRefund={canRefund}
          onFund={fundRun}
          onRun={executeRun}
          onRefund={refundUnusedBudget}
          onAttest={attestRun}
        />
      </section>

      <ExecutionSection run={run} />

      <FinalOutputSection outputs={finalOutputs} run={run} />
    </div>
  )
}

async function requestFundingWalletAddress(expectedAddress: string | null) {
  const provider = getBrowserEthereumProvider()

  if (!provider) {
    throw new Error(
      'MetaMask was not detected. Open the app in a browser with MetaMask installed, then click Fund agent again.'
    )
  }

  const accounts = (await provider.request({
    method: 'eth_requestAccounts'
  })) as unknown
  const selectedAddress = Array.isArray(accounts)
    ? accounts.find(
        (account): account is Address =>
          typeof account === 'string' && isAddress(account)
      )
    : null

  if (!selectedAddress) {
    throw new Error('MetaMask did not return a funding wallet address.')
  }

  if (
    expectedAddress &&
    selectedAddress.toLowerCase() !== expectedAddress.toLowerCase()
  ) {
    throw new Error(
      `MetaMask is using ${shorten(
        selectedAddress
      )}, but this app session is connected as ${shorten(
        expectedAddress
      )}. Switch MetaMask to the connected wallet, then fund again.`
    )
  }

  return selectedAddress
}

async function sendBrowserWalletTransaction({
  from,
  to,
  data
}: {
  from: Address
  to: Address
  data: Hex
}) {
  const provider = getBrowserEthereumProvider()

  if (!provider) {
    throw new Error('MetaMask was not detected.')
  }

  await ensureBrowserWalletChain(provider)
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to,
        data,
        value: '0x0'
      }
    ]
  })

  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    throw new Error('MetaMask did not return a transaction hash.')
  }

  return txHash as Hex
}

async function readFundingTokenState({
  tokenAddress,
  ownerAddress,
  spenderAddress
}: {
  tokenAddress: Address
  ownerAddress: Address
  spenderAddress: Address
}) {
  const [balance, allowance, decimals, symbol] = await Promise.all([
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20ApprovalAbi,
      functionName: 'balanceOf',
      args: [ownerAddress]
    }),
    readFundingTokenAllowance({
      tokenAddress,
      ownerAddress,
      spenderAddress
    }),
    publicClient.readContract({
      address: tokenAddress,
      abi: erc20ApprovalAbi,
      functionName: 'decimals'
    }),
    publicClient
      .readContract({
        address: tokenAddress,
        abi: erc20ApprovalAbi,
        functionName: 'symbol'
      })
      .catch(() => 'PYUSD')
  ])

  return {
    balance,
    allowance,
    decimals,
    symbol
  }
}

async function readFundingTokenAllowance({
  tokenAddress,
  ownerAddress,
  spenderAddress
}: {
  tokenAddress: Address
  ownerAddress: Address
  spenderAddress: Address
}) {
  return await publicClient.readContract({
    address: tokenAddress,
    abi: erc20ApprovalAbi,
    functionName: 'allowance',
    args: [ownerAddress, spenderAddress]
  })
}

async function waitForSuccessfulTransaction(
  txHash: Hex,
  revertedMessage: string
) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  if (receipt.status !== 'success') {
    throw new Error(`${revertedMessage} Transaction hash: ${txHash}`)
  }

  return receipt
}

function formatTokenAmount(amount: bigint, decimals: number, symbol: string) {
  return `${Number(formatUnits(amount, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6
  })} ${symbol}`
}

async function ensureBrowserWalletChain(provider: EthereumProvider) {
  const chainId = numberToHex(defaultAppChain.id)

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }]
    })
    return
  } catch (error) {
    if (getWalletErrorCode(error) !== 4902) {
      throw error
    }
  }

  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        chainId,
        chainName: defaultAppChain.name,
        nativeCurrency: defaultAppChain.nativeCurrency,
        rpcUrls: defaultAppChain.viemChain.rpcUrls.default.http,
        blockExplorerUrls: [defaultAppChain.explorer.baseUrl]
      }
    ]
  })

  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId }]
  })
}

function getBrowserEthereumProvider() {
  if (typeof window === 'undefined') {
    return null
  }

  const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum

  if (!ethereum) {
    return null
  }

  return (
    ethereum.providers?.find(
      (provider: EthereumProvider) => provider.isMetaMask
    ) ?? ethereum
  )
}

function getWalletErrorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error
    ? Number((error as { code?: unknown }).code)
    : null
}

function RunSummaryCard({
  run,
  completedPaidActions
}: {
  run: AgentRun
  completedPaidActions: number
}) {
  const completed = run.actions.filter(
    action => action.status === 'completed'
  ).length
  const failed = run.actions.filter(action => action.status === 'failed').length
  const running = run.actions.filter(action =>
    ['quoted', 'paid'].includes(action.status)
  ).length
  const queued = run.actions.filter(
    action => action.status === 'planned'
  ).length

  return (
    <Card className='overflow-hidden p-0'>
      <div className='border-border/70 bg-background/35 border-b p-5 sm:p-6'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div className='min-w-0 space-y-3'>
            <div className='text-primary flex items-center gap-2'>
              <Bot className='h-5 w-5' aria-hidden />
              <span className='text-xs font-semibold tracking-[0.18em] uppercase'>
                Agent workspace
              </span>
            </div>
            <div>
              <h2 className='font-display max-w-4xl text-2xl leading-tight font-semibold text-balance sm:text-3xl'>
                {run.title}
              </h2>
              <p className='text-foreground/65 mt-2 max-w-3xl text-sm leading-6'>
                {run.objective}
              </p>
            </div>
          </div>
          <StatusPill status={run.status} />
        </div>
      </div>

      <div className='space-y-5 p-5 sm:p-6'>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <SummaryStat
            icon={WalletCards}
            label='Funded'
            value={run.fundedAmountUsdt}
          />
          <SummaryStat
            icon={CircleDollarSign}
            label='Spent'
            value={run.spentAmountUsdt}
          />
          <SummaryStat
            icon={Undo2}
            label='Available'
            value={run.availableAmountUsdt}
          />
          <SummaryStat
            icon={Sparkles}
            label='Planner'
            value={formatPlanner(run)}
          />
          <SummaryStat icon={Clock} label='Running' value={String(running)} />
          <SummaryStat icon={Bot} label='Queued' value={String(queued)} />
          <SummaryStat
            icon={CheckCircle2}
            label='Completed'
            value={String(completed)}
          />
          <SummaryStat
            icon={AlertTriangle}
            label='Failed'
            value={String(failed)}
          />
        </div>

        <StatusNotice run={run} completedPaidActions={completedPaidActions} />
      </div>
    </Card>
  )
}

function StatusNotice({
  run,
  completedPaidActions
}: {
  run: AgentRun
  completedPaidActions: number
}) {
  const Icon = statusIcon(run.status)

  return (
    <div className='border-border/80 bg-muted/20 rounded-lg border p-4'>
      <div className='flex items-start gap-3'>
        <span className='bg-primary/10 text-primary mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full'>
          <Icon className='h-4 w-4' aria-hidden />
        </span>
        <div className='min-w-0'>
          <p className='font-semibold'>{agentRunStatusLabels[run.status]}</p>
          <p className='text-foreground/65 mt-1 text-sm leading-6'>
            {agentRunStatusDetails[run.status]}
          </p>
          {run.status === 'failed' && completedPaidActions === 0 ? (
            <p className='mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm leading-6 text-red-600 dark:text-red-300'>
              No paid tool completed with a receipt, so the gateway is showing
              diagnostics instead of treating generated copy as verified output.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function RunControlPanel({
  run,
  address,
  status,
  isFunding,
  isRunning,
  isRefunding,
  isAttesting,
  isRefreshingRun,
  canRun,
  canRefund,
  onFund,
  onRun,
  onRefund,
  onAttest
}: {
  run: AgentRun
  address: string | null
  status: string
  isFunding: boolean
  isRunning: boolean
  isRefunding: boolean
  isAttesting: boolean
  isRefreshingRun: boolean
  canRun: boolean
  canRefund: boolean
  onFund: () => void
  onRun: () => void
  onRefund: () => void
  onAttest: () => void
}) {
  return (
    <aside className='xl:sticky xl:top-28 xl:self-start'>
      <Card className='space-y-5'>
        <div className='space-y-1'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Run controls
          </p>
          <h3 className='text-lg font-semibold'>Fund, run, prove</h3>
          <p className='text-foreground/60 text-sm leading-6'>
            Spend is capped by the funded budget and each paid tool records a
            receipt.
          </p>
        </div>

        <div className='grid gap-2'>
          <Button
            className='w-full'
            onClick={onFund}
            disabled={
              isFunding ||
              !['unfunded', 'funding_pending', 'refund_available'].includes(
                run.fundingStatus
              ) ||
              (run.fundingStatus === 'refund_available' &&
                run.availableAmountUsdt !== '0.00 PYUSD')
            }
          >
            <WalletCards className='h-4 w-4' aria-hidden />
            {isFunding ? 'Funding' : 'Fund agent'}
          </Button>
          <Button
            className='w-full'
            onClick={onRun}
            disabled={isRunning || !canRun}
          >
            <Play className='h-4 w-4' aria-hidden />
            {isRunning
              ? 'Running'
              : run.status === 'failed'
                ? 'Retry actions'
                : 'Run actions'}
          </Button>
          <div className='grid grid-cols-2 gap-2'>
            <Button
              className='w-full px-3'
              variant='outline'
              onClick={onRefund}
              disabled={isRefunding || !canRefund}
            >
              <Undo2 className='h-4 w-4' aria-hidden />
              {isRefunding ? 'Refunding' : 'Refund'}
            </Button>
            <Button
              className='w-full px-3'
              variant='outline'
              onClick={onAttest}
              disabled={
                isAttesting || !['completed', 'attesting'].includes(run.status)
              }
            >
              <FileCheck2 className='h-4 w-4' aria-hidden />
              {isAttesting ? 'Writing' : 'Attest'}
            </Button>
          </div>
          {run.proof ? (
            <Link
              href={`/proofs/${run.proof.id}`}
              className={buttonClasses({
                variant: 'primary',
                size: 'md',
                className: 'w-full'
              })}
            >
              <ExternalLink className='h-4 w-4' aria-hidden />
              Open proof
            </Link>
          ) : null}
        </div>

        {status ? (
          <div className='space-y-2'>
            <RunStatusMessage run={run} status={status} />
            {isRefundStatusMessage(status) ? (
              <RefundTransactionLinks run={run} />
            ) : null}
          </div>
        ) : null}
        {isRefreshingRun ? (
          <p className='text-foreground/60 flex items-center gap-2 text-sm'>
            <RefreshCw
              className='text-primary h-4 w-4 animate-spin'
              aria-hidden
            />
            Refreshing agent progress
          </p>
        ) : null}

        <div className='border-border/80 grid gap-2 rounded-lg border p-3 text-sm'>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-foreground/60'>Funding</span>
            <span className='font-semibold'>{run.fundingStatus}</span>
          </div>
          <div className='flex items-center justify-between gap-3'>
            <span className='text-foreground/60'>Wallet</span>
            <span className='max-w-36 truncate font-semibold'>
              {address ?? 'Not connected'}
            </span>
          </div>
          {run.refundTxHash ? (
            <a
              href={
                run.refundExplorerUrl ??
                getExplorerTransactionUrl(run.refundTxHash) ??
                undefined
              }
              target='_blank'
              rel='noreferrer'
              className='border-border/70 text-primary hover:bg-primary/10 mt-1 flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 font-semibold transition'
            >
              <span>Refund tx</span>
              <span className='flex min-w-0 items-center gap-2'>
                <span className='max-w-32 truncate'>
                  {shorten(run.refundTxHash)}
                </span>
                <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
              </span>
            </a>
          ) : null}
        </div>
      </Card>
    </aside>
  )
}

function RefundTransactionLinks({ run }: { run: AgentRun }) {
  const links = collectRefundLinks(run)

  if (!links.length) {
    return (
      <p className='border-border/70 text-foreground/60 rounded-lg border border-dashed p-3 text-xs leading-5'>
        Refund transaction is not recorded yet. Refresh after the wallet or
        vault transaction confirms.
      </p>
    )
  }

  return (
    <div className='grid gap-2'>
      {links.map(link => (
        <a
          key={`${link.label}-${link.txHash}`}
          href={
            link.explorerUrl ??
            getExplorerTransactionUrl(link.txHash) ??
            undefined
          }
          target='_blank'
          rel='noreferrer'
          className='border-border bg-background/50 text-primary hover:bg-primary/10 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm font-semibold transition'
        >
          <span>{link.label}</span>
          <span className='flex min-w-0 items-center gap-2'>
            <span className='max-w-40 truncate'>{shorten(link.txHash)}</span>
            <ExternalLink className='h-4 w-4 shrink-0' aria-hidden />
          </span>
        </a>
      ))}
    </div>
  )
}

function collectRefundLinks(run: AgentRun) {
  const links: Array<{
    label: string
    txHash: string
    explorerUrl?: string | null
  }> = []
  const seen = new Set<string>()
  const addLink = (
    label: string,
    txHash: string | null | undefined,
    explorerUrl?: string | null
  ) => {
    if (!txHash || seen.has(txHash)) {
      return
    }

    seen.add(txHash)
    links.push({ label, txHash, explorerUrl })
  }

  addLink('Unused budget refund', run.refundTxHash, run.refundExplorerUrl)

  for (const event of run.ledgerEvents) {
    if (event.type === 'unused_refunded' || event.type === 'spend_refunded') {
      addLink(event.label, event.txHash, event.explorerUrl)
    }
  }

  for (const action of run.actions) {
    addLink(
      `${action.productName} vault refund`,
      action.vaultRefundTxHash,
      action.vaultRefundExplorerUrl
    )
    addLink(
      `${action.productName} signer return`,
      action.vaultReturnTxHash,
      action.vaultReturnExplorerUrl
    )
  }

  return links
}

function getVisibleRunControlStatus(run: AgentRun, status: string) {
  if (!status) {
    return ''
  }

  const notice = buildRunErrorNotice(status, run)

  if (!notice) {
    return status
  }

  if (shouldSuppressRecoveredRunError(run)) {
    return ''
  }

  return status
}

function shouldSuppressRecoveredRunError(run: AgentRun) {
  const hasFailedAction = run.actions.some(action => action.status === 'failed')

  if (run.status === 'failed' || hasFailedAction) {
    return false
  }

  return (
    ['running', 'completed', 'attested'].includes(run.status) ||
    run.actions.some(action => ['quoted', 'paid'].includes(action.status))
  )
}

function isRefundStatusMessage(status: string) {
  return /\brefund|refunded|refunding\b/i.test(status)
}

function RunStatusMessage({ run, status }: { run: AgentRun; status: string }) {
  const notice = buildRunErrorNotice(status, run)

  if (!notice) {
    return (
      <p
        className='border-border bg-muted/35 rounded-lg border p-3 text-sm leading-6 [overflow-wrap:anywhere]'
        role='status'
      >
        {status}
      </p>
    )
  }

  return (
    <div
      className='max-w-full min-w-0 overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10'
      role='status'
    >
      <div className='p-3'>
        <div className='min-w-0'>
          <p className='font-semibold text-red-700 dark:text-red-200'>
            {notice.title}
          </p>
          <p className='mt-1 text-sm leading-6 break-words text-red-700/85 dark:text-red-200/85'>
            {notice.message}
          </p>
          {notice.detail ? (
            <p className='mt-2 text-xs leading-5 break-words text-red-700/75 dark:text-red-200/75'>
              {notice.detail}
            </p>
          ) : null}
        </div>
      </div>
      <JsonViewer
        title='Full error message'
        value={notice.raw}
        defaultOpen={false}
        copyLabel='Copy error'
        tone='error'
        className='rounded-none border-x-0 border-b-0 shadow-none'
        maxHeightClassName='max-h-72'
      />
    </div>
  )
}

function ExecutionSection({ run }: { run: AgentRun }) {
  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <p className='text-primary text-xs font-semibold tracking-[0.16em] uppercase'>
            Execution
          </p>
          <h3 className='mt-1 text-xl font-semibold'>Tool calls</h3>
        </div>
        <span className='text-foreground/60 text-sm'>
          {run.actions.length} planned action
          {run.actions.length === 1 ? '' : 's'}
        </span>
      </div>
      {run.actions.length === 0 ? (
        <div className='border-border text-foreground/65 rounded-lg border border-dashed p-5 text-sm leading-6'>
          Actions appear here after the planner chooses tools.
        </div>
      ) : (
        <div className='grid gap-3'>
          {run.actions.map((action, index) => (
            <ActionCard
              key={action.id}
              action={action}
              run={run}
              stepNumber={index + 1}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function AdvancedRunDetails({ run }: { run: AgentRun }) {
  return (
    <section className='space-y-3'>
      <details className='group border-border/80 bg-card/75 overflow-hidden rounded-lg border'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-4 p-4 [&::-webkit-details-marker]:hidden'>
          <span className='flex items-center gap-2 font-semibold'>
            <ShieldCheck className='text-primary h-4 w-4' aria-hidden />
            Funding and skipped-tool details
          </span>
          <span className='text-foreground/55 text-sm group-open:hidden'>
            Expand
          </span>
          <span className='text-foreground/55 hidden text-sm group-open:inline'>
            Collapse
          </span>
        </summary>
        <div className='border-border/70 space-y-5 border-t p-4'>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <DetailLink
              label='Vault'
              value={run.vaultAddress}
              href={run.vaultExplorerUrl}
            />
            <DetailLink
              label='Funding tx'
              value={run.fundingTxHash}
              href={run.fundingExplorerUrl}
            />
            <DetailLink
              label='Approval tx'
              value={run.approvalTxHash}
              href={run.approvalExplorerUrl}
            />
            <DetailLink
              label='Refund tx'
              value={run.refundTxHash}
              href={run.refundExplorerUrl}
            />
          </div>
          <LedgerTimeline events={run.ledgerEvents} />
          <SkippedTools tools={run.deliverables.skippedTools ?? []} />
        </div>
      </details>

      <JsonViewer
        title='Planner, receipts, and deliverable diagnostics'
        value={run.deliverables}
        defaultOpen={false}
        copyLabel='Copy diagnostics'
      />
    </section>
  )
}

function SummaryStat({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className='border-border/70 bg-background/45 rounded-lg border p-3'>
      <div className='flex items-center gap-2'>
        <Icon className='text-primary h-4 w-4' aria-hidden />
        <p className='text-foreground/60 text-xs tracking-[0.14em] uppercase'>
          {label}
        </p>
      </div>
      <p className='mt-2 text-sm font-semibold break-words'>{value}</p>
    </div>
  )
}

function SkippedTools({
  tools
}: {
  tools: NonNullable<AgentRun['deliverables']['skippedTools']>
}) {
  if (tools.length === 0) {
    return null
  }

  return (
    <div className='space-y-3'>
      <p className='font-semibold'>Skipped tools</p>
      <div className='grid gap-3 md:grid-cols-2'>
        {tools.map(tool => (
          <div
            key={tool.slug}
            className='border-border bg-muted/20 rounded-lg border p-3 text-sm'
          >
            <p className='font-semibold'>{tool.productName ?? tool.slug}</p>
            <p className='text-foreground/65 mt-1 leading-6'>{tool.reason}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: AgentRun['status'] }) {
  const Icon = statusIcon(status)

  return (
    <span className='border-border bg-card inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold'>
      <Icon className='text-primary h-4 w-4' aria-hidden />
      {agentRunStatusLabels[status]}
    </span>
  )
}

function DetailLink({
  label,
  value,
  href
}: {
  label: string
  value?: string | null
  href?: string | null
}) {
  return (
    <div className='border-border bg-background/60 rounded-lg border p-3'>
      <p className='text-foreground/60 text-xs tracking-[0.14em] uppercase'>
        {label}
      </p>
      {value ? (
        href ? (
          <a
            href={href}
            target='_blank'
            rel='noreferrer'
            className='text-primary mt-1 inline-flex max-w-full items-center gap-2 font-semibold break-all underline-offset-4 hover:underline'
          >
            {shorten(value)}
            <ExternalLink className='h-4 w-4 shrink-0' aria-hidden />
          </a>
        ) : (
          <p className='mt-1 font-semibold break-all'>{shorten(value)}</p>
        )
      ) : (
        <p className='text-foreground/50 mt-1 text-sm'>Not recorded yet</p>
      )}
    </div>
  )
}

function LedgerTimeline({ events }: { events: AgentLedgerEvent[] }) {
  if (events.length === 0) {
    return (
      <p className='text-foreground/65 border-border rounded-lg border border-dashed p-4 text-sm leading-6'>
        Funding and spend events appear here as the run moves through the vault.
      </p>
    )
  }

  return (
    <div className='space-y-3'>
      {events.map(event => (
        <div key={event.id} className='flex gap-3'>
          <span className='bg-primary/10 text-primary mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full'>
            <History className='h-3.5 w-3.5' aria-hidden />
          </span>
          <div className='min-w-0'>
            <p className='text-sm font-semibold'>{event.label}</p>
            <p className='text-foreground/55 text-xs'>
              {new Date(event.createdAt).toLocaleString()}
              {event.amountUsdt ? ` - ${event.amountUsdt}` : ''}
            </p>
            {event.explorerUrl && event.txHash ? (
              <a
                href={event.explorerUrl}
                target='_blank'
                rel='noreferrer'
                className='text-primary mt-1 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline'
              >
                {shorten(event.txHash)}
                <ExternalLink className='h-3.5 w-3.5' aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}

function ActionCard({
  action,
  run,
  stepNumber
}: {
  action: AgentRun['actions'][number]
  run: AgentRun
  stepNumber: number
}) {
  const displayStatus = getActionDisplayStatus(action)
  const Icon =
    displayStatus.tone === 'completed'
      ? CheckCircle2
      : displayStatus.tone === 'failed'
        ? AlertTriangle
        : Clock
  const outputItems = collectActionOutputs(action)

  return (
    <details className='group border-border bg-background/55 overflow-hidden rounded-lg border shadow-sm'>
      <summary className='flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='bg-primary/10 text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
              {stepNumber}
            </span>
            <Icon className='text-primary h-4 w-4' aria-hidden />
            <p className='font-semibold'>{action.productName}</p>
          </div>
          <p className='text-foreground/60 mt-1 text-sm break-words'>
            {action.providerName} - {action.amountUsdt}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-2'>
          <ActionLinks action={action} />
          <span className='bg-muted rounded-md px-2 py-1 text-xs font-semibold'>
            {displayStatus.label}
          </span>
          <span className='text-foreground/50 inline-flex items-center gap-1 text-xs font-semibold group-open:hidden'>
            Expand
            <ChevronDown className='h-3.5 w-3.5' aria-hidden />
          </span>
          <span className='text-foreground/50 hidden items-center gap-1 text-xs font-semibold group-open:inline-flex'>
            Collapse
            <ChevronDown className='h-3.5 w-3.5 rotate-180' aria-hidden />
          </span>
        </div>
      </summary>
      <div className='border-border/70 border-t p-4'>
        {action.errorMessage ? (
          <ActionErrorPanel action={action} run={run} />
        ) : null}
        <PaymentAttemptPanel action={action} />
        <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
          <ActionMetric label='Quote' value={action.amountUsdt} />
          <ActionMetric label='Phase' value={getActionPhaseLabel(action)} />
          <ActionMetric
            label='Vault spend'
            value={action.vaultAdvancedAmountUsdt ?? 'Not advanced'}
          />
          <ActionMetric
            label='Order'
            value={action.orderId ? shorten(action.orderId) : 'Not created'}
          />
        </div>
        <p className='text-foreground/65 mt-3 text-sm leading-6 break-words'>
          {action.objective}
        </p>
        {action.planningRationale ? (
          <details className='border-border bg-muted/30 mt-3 rounded-lg border p-3 text-sm'>
            <summary className='cursor-pointer font-semibold'>
              Planner rationale
            </summary>
            <p className='text-foreground/65 mt-2 leading-6'>
              {action.planningRationale}
            </p>
          </details>
        ) : null}
        {outputItems.length > 0 ? (
          <div className='mt-4'>
            <SectionLabel icon={Link2} label='Tool output' />
            <OutputGallery outputs={outputItems} className='mt-2' compact />
          </div>
        ) : null}
        {action.asyncPollingResponses?.length ? (
          <AsyncPollingPanel action={action} />
        ) : null}
        <details className='border-border/70 bg-muted/20 mt-4 rounded-lg border'>
          <summary className='flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
            <span className='flex items-center gap-2'>
              <Braces className='text-primary h-4 w-4' aria-hidden />
              Request and response JSON
            </span>
            <span className='text-foreground/50 text-xs'>Expand</span>
          </summary>
          <div className='border-border/70 grid gap-3 border-t p-3 lg:grid-cols-2'>
            <JsonViewer
              title='Tool request'
              value={action.requestPayload}
              defaultOpen={false}
              copyLabel='Copy request'
            />
            <JsonViewer
              title='Tool response'
              value={
                action.responsePayload ?? {
                  status: action.status,
                  message:
                    action.errorMessage ??
                    (action.status === 'paid'
                      ? 'The paid request is running. the gateway is waiting for the provider response.'
                      : 'No response payload recorded yet.')
                }
              }
              defaultOpen={false}
              copyLabel='Copy response'
            />
          </div>
        </details>
      </div>
    </details>
  )
}

function ActionErrorPanel({
  action,
  run
}: {
  action: AgentRun['actions'][number]
  run: AgentRun
}) {
  const notice = buildActionErrorNotice(action, run)

  return (
    <div className='mt-3 max-w-full min-w-0 overflow-hidden rounded-lg border border-red-500/30 bg-red-500/10'>
      <div className='flex items-start justify-between gap-3 p-3'>
        <span className='flex min-w-0 items-start gap-3'>
          <AlertTriangle
            className='mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300'
            aria-hidden
          />
          <span className='min-w-0'>
            <span className='block font-semibold text-red-700 dark:text-red-200'>
              {notice.title}
            </span>
            <span className='mt-1 block text-sm leading-6 break-words text-red-700/85 dark:text-red-200/85'>
              {notice.message}
            </span>
            {notice.detail ? (
              <span className='mt-2 block text-xs leading-5 break-words text-red-700/75 dark:text-red-200/75'>
                {notice.detail}
              </span>
            ) : null}
          </span>
        </span>
      </div>
      <JsonViewer
        title='Full error message'
        value={notice.raw}
        defaultOpen={false}
        copyLabel='Copy error'
        tone='error'
        className='rounded-none border-x-0 border-b-0 shadow-none'
        maxHeightClassName='max-h-72'
      />
    </div>
  )
}

function PaymentAttemptPanel({
  action
}: {
  action: AgentRun['actions'][number]
}) {
  const attempts = collectPaymentAttempts(action)

  if (!attempts.length) {
    return null
  }

  const retryCount = attempts.filter(attempt => attempt.retryDelayMs).length

  return (
    <details className='group border-border/80 bg-card/45 mt-3 overflow-hidden rounded-lg border'>
      <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden'>
        <span className='flex min-w-0 items-center gap-2'>
          <RefreshCw className='text-primary h-4 w-4 shrink-0' aria-hidden />
          <span className='font-semibold'>Payment transaction attempts</span>
          <span className='bg-muted rounded-md px-2 py-1 text-xs font-semibold'>
            {attempts.length} total
          </span>
          {retryCount ? (
            <span className='rounded-md bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-600 dark:text-red-300'>
              {retryCount} {retryCount === 1 ? 'retry' : 'retries'}
            </span>
          ) : null}
        </span>
        <span className='text-foreground/50 text-xs group-open:hidden'>
          Expand
        </span>
        <span className='text-foreground/50 hidden text-xs group-open:inline'>
          Collapse
        </span>
      </summary>
      <div className='border-border/70 grid gap-2 border-t p-3'>
        {attempts.map((attempt, index) => (
          <div
            key={`${attempt.functionName}-${attempt.attempt}-${attempt.createdAt}`}
            className='border-border/70 bg-background/45 rounded-lg border p-3'
          >
            <div className='flex flex-wrap items-start justify-between gap-3'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold'>
                  Step {index + 1} - {humanizePath(attempt.functionName)}
                  {attempt.attempt > 1 ? ` (try ${attempt.attempt})` : ''}
                </p>
                <p className='text-foreground/55 mt-1 text-xs'>
                  {new Date(attempt.createdAt).toLocaleString()}
                  {attempt.gasLimit ? ` - gas ${attempt.gasLimit}` : ''}
                  {attempt.retryDelayMs
                    ? ` - retry after ${formatRetryDelay(attempt.retryDelayMs)}`
                    : ''}
                </p>
              </div>
              <span
                className={[
                  'rounded-md px-2 py-1 text-xs font-semibold',
                  attempt.status === 'succeeded'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                    : 'bg-red-500/10 text-red-600 dark:text-red-300'
                ].join(' ')}
              >
                {attempt.status}
              </span>
            </div>
            <p className='text-foreground/65 mt-2 text-sm leading-6 [overflow-wrap:anywhere]'>
              {attempt.message}
            </p>
            {attempt.explorerUrl && attempt.txHash ? (
              <a
                href={attempt.explorerUrl}
                target='_blank'
                rel='noreferrer'
                className='text-primary mt-2 inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline'
              >
                {shorten(attempt.txHash)}
                <ExternalLink className='h-3.5 w-3.5' aria-hidden />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  )
}

function ActionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className='border-border/70 bg-background/45 min-w-0 rounded-lg border p-2.5'>
      <p className='text-foreground/55 text-[0.68rem] font-semibold tracking-[0.12em] uppercase'>
        {label}
      </p>
      <p className='mt-1 text-sm font-semibold [overflow-wrap:anywhere]'>
        {value}
      </p>
    </div>
  )
}

function collectPaymentAttempts(action: AgentRun['actions'][number]) {
  return [
    ...(action.vaultSpendAttempts ?? []),
    ...(action.vaultRefundAttempts ?? [])
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

function formatRetryDelay(delayMs: number) {
  if (delayMs < 1000) {
    return `${delayMs}ms`
  }

  return `${(delayMs / 1000).toFixed(delayMs % 1000 === 0 ? 0 : 1)}s`
}

function getActionDisplayStatus(action: AgentRun['actions'][number]) {
  const poll = getLatestAsyncPoll(action)

  if (action.status === 'paid' && poll?.orderStatus) {
    if (poll.orderStatus === 'completed') {
      return { label: 'Completed', tone: 'completed' as const }
    }

    if (poll.orderStatus === 'failed' || poll.orderStatus === 'expired') {
      return { label: humanizePath(poll.orderStatus), tone: 'failed' as const }
    }

    if (poll.orderStatus === 'processing') {
      return { label: 'Processing', tone: 'running' as const }
    }

    if (poll.orderStatus === 'forwarding') {
      return { label: 'Running', tone: 'running' as const }
    }

    if (poll.orderStatus === 'created' || poll.orderStatus === 'paid') {
      return { label: 'Pending', tone: 'running' as const }
    }
  }

  return {
    label: agentActionStatusLabels[action.status],
    tone:
      action.status === 'completed'
        ? ('completed' as const)
        : action.status === 'failed'
          ? ('failed' as const)
          : ('running' as const)
  }
}

function getActionPhaseLabel(action: AgentRun['actions'][number]) {
  const poll = getLatestAsyncPoll(action)

  if (poll?.orderStatus === 'processing') {
    return 'Provider processing'
  }

  if (poll?.orderStatus === 'forwarding') {
    return 'Provider call'
  }

  if (action.status === 'quoted') {
    return 'Vault advance'
  }

  if (action.status === 'paid') {
    return poll?.orderStatus ? humanizePath(poll.orderStatus) : 'Paid request'
  }

  return agentActionStatusLabels[action.status]
}

type AgentErrorNotice = {
  title: string
  message: string
  detail?: string
  raw: string
}

function buildActionErrorNotice(
  action: AgentRun['actions'][number],
  run: AgentRun
): AgentErrorNotice {
  const raw = action.errorMessage ?? 'The tool call failed.'
  const lower = raw.toLowerCase()

  if (
    lower.includes('agentrunvault: over budget') ||
    (lower.includes('recordspend') && lower.includes('over budget'))
  ) {
    return {
      title: 'Agent budget is not enough for this tool call',
      message: `The vault rejected the ${action.amountUsdt} spend for ${action.productName} because the funded run budget does not cover this action.`,
      detail: `Funded: ${run.fundedAmountUsdt}. Spent: ${run.spentAmountUsdt}. Available: ${run.availableAmountUsdt}. Create or fund a run with enough PYUSD for this tool, then retry the action.`,
      raw
    }
  }

  if (
    lower.includes('reservepayment escrow transaction') ||
    lower.includes('async_prepaid_handoff_failed') ||
    lower.includes('could not finish the async provider handoff')
  ) {
    return {
      title: 'Escrow reservation failed',
      message:
        'The x402 payment reached the async escrow path, but the gateway could not record the escrow reservation on-chain.',
      detail:
        'This only affects prepaid async tools. The gateway uses a higher floor-safe gas limit and retries escrow writes before reporting this failure.',
      raw
    }
  }

  if (
    lower.includes('permit2_insufficient_balance') ||
    lower.includes('agent signer does not have enough usdt') ||
    lower.includes('agent signer cannot return unused usdt') ||
    lower.includes('agent signer could not return unused usdt') ||
    lower.includes('signerusdtreturn')
  ) {
    return {
      title: 'Agent signer needs PYUSD, not wallet gas',
      message:
        'The vault advanced this tool budget to the backend agent signer, but the signer did not have enough PYUSD available for settlement or refund recovery.',
      detail: `This is separate from your connected wallet's ${defaultAppChain.nativeCurrency.symbol} balance. Check AGENT_SPENDER_PRIVATE_KEY, the signer PYUSD balance, Permit2 allowance, and whether another failed or concurrent run consumed the signer funds before retrying.`,
      raw
    }
  }

  if (
    lower.includes('gas limit below eip-7623 floor') ||
    lower.includes('failed to verify the fees') ||
    lower.includes('invalid_exact_evm_transaction_failed')
  ) {
    return {
      title: 'Settlement gas estimate was too low',
      message:
        'The Kite RPC rejected the payment settlement before execution because the submitted gas limit was below the network calldata floor.',
      detail:
        'No provider result is lost before the provider accepts the paid request. Retry after the gateway uses the local floor-safe x402 facilitator.',
      raw
    }
  }

  if (lower.includes('contract function') || lower.includes('reverted')) {
    return {
      title: 'Contract transaction failed',
      message:
        'The agent could not complete the on-chain vault or settlement step for this tool call.',
      detail:
        'Check the budget, token allowance, configured vault address, and operator wallet before retrying.',
      raw
    }
  }

  if (lower.includes('refund')) {
    return {
      title: 'Tool failed during refund recovery',
      message:
        'The paid tool did not complete and the gateway could not fully recover the advanced vault funds.',
      detail:
        'Open the full error details and transaction links before retrying or refunding the remaining budget.',
      raw
    }
  }

  return {
    title: 'Tool call failed',
    message:
      'This tool did not reach a successful terminal state. The full provider or gateway error is available below.',
    raw
  }
}

function buildRunErrorNotice(
  status: string,
  run: AgentRun
): AgentErrorNotice | null {
  const lower = status.toLowerCase()
  const looksLikeError =
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('reverted') ||
    lower.includes('exception') ||
    lower.includes('over budget') ||
    lower.includes('invalid_exact_evm_transaction_failed') ||
    lower.includes('agentrunvault')

  if (!looksLikeError) {
    return null
  }

  if (
    lower.includes('agentrunvault: over budget') ||
    lower.includes('over budget')
  ) {
    return {
      title: 'Agent budget is not enough',
      message:
        'The vault rejected a spend because the remaining funded budget is lower than the next paid tool quote.',
      detail: `Funded: ${run.fundedAmountUsdt}. Spent: ${run.spentAmountUsdt}. Available: ${run.availableAmountUsdt}.`,
      raw: status
    }
  }

  if (
    lower.includes('gas limit below eip-7623 floor') ||
    lower.includes('failed to verify the fees') ||
    lower.includes('invalid_exact_evm_transaction_failed')
  ) {
    return {
      title: 'Settlement gas estimate was too low',
      message:
        'The Kite RPC rejected a payment transaction before execution because the submitted gas limit was below the calldata floor.',
      detail:
        'Retry after the gateway uses the local floor-safe x402 facilitator and floor-safe contract writes.',
      raw: status
    }
  }

  return {
    title: 'Run action failed',
    message:
      'The agent could not continue the current run. Expand the details for the full gateway or contract error.',
    raw: status
  }
}

function shouldPollAsyncActionOnClient(action: AgentRun['actions'][number]) {
  if (action.status !== 'paid' || !action.orderId) {
    return false
  }

  const poll = getLatestAsyncPoll(action)

  return !['completed', 'failed', 'expired'].includes(poll?.orderStatus ?? '')
}

function shouldResumePlannedActions(run: AgentRun) {
  if (!['running', 'failed'].includes(run.status)) {
    return false
  }

  if (
    !['funded', 'partially_spent', 'refund_available'].includes(
      run.fundingStatus
    )
  ) {
    return false
  }

  const hasCompletedAction = run.actions.some(
    action => action.status === 'completed'
  )
  const hasPlannedAction = run.actions.some(action =>
    ['planned', 'quoted'].includes(action.status)
  )
  const hasActivePaidAction = run.actions.some(shouldPollAsyncActionOnClient)

  return hasCompletedAction && hasPlannedAction && !hasActivePaidAction
}

function ActionLinks({ action }: { action: AgentRun['actions'][number] }) {
  const links = [
    action.receipt
      ? {
          label: 'Receipt',
          href: `/receipts/${action.receipt.id}`,
          icon: ReceiptText
        }
      : null,
    action.receipt?.explorerUrl
      ? {
          label: 'Settlement',
          href: action.receipt.explorerUrl,
          icon: ExternalLink,
          external: true
        }
      : null,
    action.vaultSpendExplorerUrl
      ? {
          label: 'Vault spend',
          href: action.vaultSpendExplorerUrl,
          icon: Network,
          external: true
        }
      : null
  ].filter(Boolean) as Array<{
    label: string
    href: string
    icon: LucideIcon
    external?: boolean
  }>

  if (!links.length) {
    return null
  }

  return (
    <div className='flex items-center gap-1'>
      {links.map(({ label, href, icon: Icon, external }) => {
        const classes =
          'border-border bg-card/70 text-foreground/75 hover:text-primary hover:border-primary/50 inline-flex h-9 w-9 items-center justify-center rounded-lg border transition'

        return external ? (
          <a
            key={label}
            href={href}
            target='_blank'
            rel='noreferrer'
            className={classes}
            title={label}
            aria-label={label}
            onClick={event => event.stopPropagation()}
          >
            <Icon className='h-4 w-4' aria-hidden />
          </a>
        ) : (
          <Link
            key={label}
            href={href}
            className={classes}
            title={label}
            aria-label={label}
            onClick={event => event.stopPropagation()}
          >
            <Icon className='h-4 w-4' aria-hidden />
          </Link>
        )
      })}
    </div>
  )
}

function AsyncPollingPanel({
  action
}: {
  action: AgentRun['actions'][number]
}) {
  const poll = getLatestAsyncPoll(action)
  const pollingUrl = poll?.pollingUrl

  if (!poll) {
    return null
  }

  const displayUrl = formatDisplayUrl(pollingUrl)

  return (
    <details className='border-border/80 bg-card/45 mt-4 overflow-hidden rounded-lg border'>
      <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden'>
        <span className='flex min-w-0 flex-wrap items-center gap-2'>
          <Activity className='text-primary h-4 w-4' aria-hidden />
          <span className='text-foreground/60 text-xs font-semibold tracking-[0.14em] uppercase'>
            Async polling
          </span>
          <span className='bg-primary/10 text-primary rounded-md px-2 py-1 text-xs font-semibold'>
            HTTP {poll.httpStatus}
          </span>
          {poll.orderStatus ? (
            <span className='bg-muted rounded-md px-2 py-1 text-xs font-semibold'>
              {poll.orderStatus}
            </span>
          ) : null}
          {poll.resultReleaseStatus ? (
            <span className='text-foreground/55 text-xs'>
              {poll.resultReleaseStatus}
            </span>
          ) : null}
        </span>
        <span className='text-foreground/50 text-xs'>
          {new Date(poll.polledAt).toLocaleTimeString()}
        </span>
      </summary>
      <div className='border-border/70 grid gap-3 border-t p-3 md:grid-cols-2'>
        <div className='border-border/70 bg-background/45 rounded-lg border p-3 text-sm'>
          <p className='text-foreground/55 text-xs tracking-[0.14em] uppercase'>
            Provider job
          </p>
          <p className='mt-1 truncate font-semibold'>
            {poll.externalJobId ?? 'No provider job id yet'}
          </p>
        </div>
        <div className='border-border/70 bg-background/45 grid gap-3 rounded-lg border p-3 text-sm md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
          <div className='min-w-0'>
            <p className='text-foreground/55 text-xs tracking-[0.14em] uppercase'>
              Polling endpoint
            </p>
            <p className='mt-1 truncate font-semibold'>{displayUrl.host}</p>
            <p className='text-foreground/55 mt-1 truncate text-xs'>
              {displayUrl.path}
            </p>
          </div>
          {pollingUrl ? (
            <a
              href={pollingUrl}
              target='_blank'
              rel='noreferrer'
              className='border-border bg-card/70 text-primary inline-flex h-9 w-9 items-center justify-center rounded-lg border'
              title='Open polling URL'
              aria-label='Open polling URL'
            >
              <ExternalLink className='h-4 w-4' aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
      <details className='border-border/70 border-t'>
        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 p-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
          <span className='flex items-center gap-2'>
            <Braces className='text-primary h-4 w-4' aria-hidden />
            Polling request and response JSON
          </span>
          <span className='text-foreground/50 text-xs'>Expand</span>
        </summary>
        <div className='border-border/70 border-t p-3'>
          <JsonViewer
            title='Async polling response'
            value={poll}
            defaultOpen={false}
            copyLabel='Copy polling response'
          />
        </div>
      </details>
    </details>
  )
}

function getLatestAsyncPoll(
  action: AgentRun['actions'][number]
): AgentAsyncPoll | undefined {
  return (
    action.latestAsyncPollingResponse ?? action.asyncPollingResponses?.at(-1)
  )
}

function SectionLabel({
  icon: Icon,
  label
}: {
  icon: LucideIcon
  label: string
}) {
  return (
    <p className='text-foreground/60 flex items-center gap-2 text-xs font-semibold tracking-[0.14em] uppercase'>
      <Icon className='text-primary h-4 w-4' aria-hidden />
      {label}
    </p>
  )
}

function formatPlanner(run: AgentRun) {
  const mode = run.deliverables.plannerMode

  if (mode === 'openai') {
    return `OpenAI ${run.deliverables.plannerModel ?? 'model'}`
  }

  if (mode === 'deterministic') {
    return 'Deterministic fallback'
  }

  return 'Pending'
}

function statusIcon(status: AgentRun['status']) {
  if (['completed', 'attested'].includes(status)) {
    return CheckCircle2
  }

  if (['failed'].includes(status)) {
    return AlertTriangle
  }

  if (['running', 'attesting'].includes(status)) {
    return Clock
  }

  return Bot
}

function FinalOutputSection({
  outputs,
  run
}: {
  outputs: AgentOutputItem[]
  run: AgentRun
}) {
  const completedActions = run.actions.filter(
    action => action.status === 'completed'
  )

  return (
    <Card className='space-y-4 overflow-hidden'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Final deliverable
          </p>
          <h3 className='mt-1 text-lg font-semibold'>Final agent output</h3>
          <p className='text-foreground/65 mt-1 max-w-2xl text-sm leading-6'>
            Completed project links, rendered media, and final text extracted
            after async tools finish and the agent synthesis is ready.
          </p>
        </div>
        <span className='bg-muted rounded-md px-2 py-1 text-xs font-semibold'>
          {completedActions.length} completed tool
          {completedActions.length === 1 ? '' : 's'}
        </span>
      </div>
      {outputs.length > 0 ? (
        <OutputGallery outputs={outputs} />
      ) : (
        <p className='border-border text-foreground/65 rounded-lg border border-dashed p-4 text-sm leading-6'>
          Final deliverables appear here after paid tools return completed text,
          image, video, or project URLs. Use the tool response panels above to
          inspect failed or pending calls.
        </p>
      )}
      <AdvancedRunDetails run={run} />
    </Card>
  )
}

function OutputGallery({
  outputs,
  className,
  compact = false
}: {
  outputs: AgentOutputItem[]
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={[
        'grid gap-3',
        compact ? 'md:grid-cols-2' : 'lg:grid-cols-2',
        className
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {outputs.map(output => (
        <OutputPreview key={output.id} output={output} compact={compact} />
      ))}
    </div>
  )
}

function OutputPreview({
  output,
  compact
}: {
  output: AgentOutputItem
  compact?: boolean
}) {
  if (compact && output.kind === 'link') {
    return (
      <div className='border-border bg-background/50 rounded-lg border p-3'>
        <CompactLinkPreview href={output.value} label={output.label} />
      </div>
    )
  }

  return (
    <div className='border-border bg-background/50 overflow-hidden rounded-lg border'>
      <div className='border-border/80 flex flex-wrap items-start justify-between gap-2 border-b p-3'>
        <div className='min-w-0'>
          <p className='font-semibold break-words'>{output.label}</p>
          <p className='text-foreground/55 mt-1 text-xs'>{output.source}</p>
        </div>
        <span className='bg-muted rounded-md px-2 py-1 text-xs font-semibold'>
          {output.kind}
        </span>
      </div>
      {output.kind === 'video' ? (
        <div className='bg-black'>
          <video
            src={output.value}
            controls
            playsInline
            className={compact ? 'max-h-56 w-full' : 'max-h-96 w-full'}
          />
        </div>
      ) : null}
      {output.kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={output.value}
          alt={output.label}
          className={
            compact
              ? 'max-h-56 w-full object-contain'
              : 'max-h-96 w-full object-contain'
          }
        />
      ) : null}
      {output.kind === 'text' ? (
        <div className='max-h-96 overflow-auto p-3'>
          <MarkdownViewer value={output.value} />
        </div>
      ) : null}
      <div className='p-3'>
        {output.kind === 'link' ? (
          <CompactLinkPreview href={output.value} />
        ) : output.kind === 'image' || output.kind === 'video' ? (
          <a
            href={output.value}
            target='_blank'
            rel='noreferrer'
            className='text-primary inline-flex max-w-full items-center gap-2 text-sm font-semibold break-all underline-offset-4 hover:underline'
          >
            Open source
            <ExternalLink className='h-4 w-4 shrink-0' aria-hidden />
          </a>
        ) : (
          <p className='text-foreground/55 text-xs'>
            Text output rendered from the agent result.
          </p>
        )}
      </div>
    </div>
  )
}

function CompactLinkPreview({ href, label }: { href: string; label?: string }) {
  const url = formatDisplayUrl(href)

  return (
    <a
      href={href}
      target='_blank'
      rel='noreferrer'
      className='group flex min-w-0 items-center gap-3 rounded-lg text-sm'
    >
      <span className='bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg'>
        <ExternalLink className='h-4 w-4' aria-hidden />
      </span>
      <span className='min-w-0'>
        <span className='block truncate font-semibold'>
          {label ? `${label} - ${url.host}` : url.host}
        </span>
        <span className='text-foreground/55 group-hover:text-primary block truncate text-xs'>
          {url.path}
        </span>
      </span>
    </a>
  )
}

function formatDisplayUrl(href?: string | null) {
  if (!href) {
    return {
      host: 'Not recorded',
      path: 'This run was created before polling URLs were captured.'
    }
  }

  try {
    const url = new URL(href)
    const path = `${url.pathname}${url.search}`

    return {
      host: url.host,
      path: path.length > 1 ? path : url.protocol.replace(':', '')
    }
  } catch {
    return {
      host: 'Link',
      path: shorten(href)
    }
  }
}

function collectFinalOutputs(run: AgentRun) {
  const outputs: AgentOutputItem[] = []
  const seen = new Set<string>()

  addOutput(outputs, seen, {
    id: 'deliverable-video-url',
    label: 'Synthesized video result',
    source: 'Agent deliverables',
    value: run.deliverables.videoResultUrl,
    kind: classifyUrl(run.deliverables.videoResultUrl, 'videoResultUrl')
  })

  for (const action of run.actions) {
    for (const output of collectActionOutputs(action)) {
      addOutput(outputs, seen, {
        ...output,
        id: `final-${output.id}`
      })
    }
  }

  addOutput(outputs, seen, {
    id: 'launch-brief',
    label: 'Launch brief',
    source: 'Agent synthesis',
    value: run.deliverables.launchBrief,
    kind: 'text'
  })
  addOutput(outputs, seen, {
    id: 'developer-copy',
    label: 'Developer copy',
    source: 'Agent synthesis',
    value: run.deliverables.developerCopy,
    kind: 'text'
  })
  addOutput(outputs, seen, {
    id: 'market-signal',
    label: 'Market signal',
    source: 'Agent synthesis',
    value: run.deliverables.marketSignal,
    kind: 'text'
  })

  return outputs
}

function collectActionOutputs(action: AgentRun['actions'][number]) {
  const outputs: AgentOutputItem[] = []
  const seen = new Set<string>()
  const latestPoll = getLatestAsyncPoll(action)

  addOutput(outputs, seen, {
    id: `${action.id}-async-result`,
    label: 'Provider result',
    source: action.productName,
    value: latestPoll?.resultUrl,
    kind: classifyUrl(latestPoll?.resultUrl, 'resultUrl')
  })

  if (!action.responsePayload) {
    return outputs
  }

  for (const candidate of extractResponseOutputs(action.responsePayload)) {
    if (!shouldSurfaceOutputCandidate(candidate.path, candidate.value)) {
      continue
    }

    addOutput(outputs, seen, {
      id: `${action.id}-${candidate.path}`,
      label: formatOutputLabel(candidate.path),
      source: action.productName,
      value: candidate.value,
      kind: candidate.kind
    })
  }

  return outputs
}

function shouldSurfaceOutputCandidate(path: string, value: string) {
  const lowerPath = path.toLowerCase()

  if (
    /explorer|settlement|escrow|receipt|txhash|transaction|vault/.test(
      lowerPath
    )
  ) {
    return false
  }

  if (!isUrl(value)) {
    return true
  }

  return /result|render|preview|project|clone|output|job|url|image|video/.test(
    lowerPath
  )
}

function formatOutputLabel(path: string) {
  const key = path.split('.').at(-1)?.toLowerCase() ?? path.toLowerCase()

  if (key === 'url') {
    return 'Provider job'
  }

  if (key === 'resulturl') {
    return 'Result'
  }

  if (key === 'renderurl') {
    return 'Rendered video'
  }

  if (key === 'previewurl') {
    return 'Preview'
  }

  if (key === 'projecturl' || key === 'publicprojecturl') {
    return 'Project'
  }

  return humanizePath(path)
}

function extractResponseOutputs(
  value: unknown,
  path = 'response',
  depth = 0
): ExtractedOutput[] {
  if (depth > 5 || value == null) {
    return []
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    const kind = classifyValue(trimmed, path)

    if (!kind) {
      return []
    }

    return [{ path, value: trimmed, kind }]
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      extractResponseOutputs(item, `${path}.${index}`, depth + 1)
    )
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, item]) => extractResponseOutputs(item, `${path}.${key}`, depth + 1)
    )
  }

  return []
}

function addOutput(
  outputs: AgentOutputItem[],
  seen: Set<string>,
  output: AgentOutputCandidate
) {
  if (!output.value) {
    return
  }

  const value = output.value.trim()

  if (!value || seen.has(`${output.kind}:${value}`)) {
    return
  }

  seen.add(`${output.kind}:${value}`)
  outputs.push({
    ...output,
    value,
    kind: output.kind ?? classifyValue(value, output.label) ?? 'text'
  })
}

function classifyValue(
  value: string,
  path: string
): AgentOutputItem['kind'] | null {
  if (isUrl(value)) {
    return classifyUrl(value, path) ?? null
  }

  const lowerPath = path.toLowerCase()

  if (
    value.length >= 24 &&
    /summary|brief|copy|signal|result|output|text|description|message|content/.test(
      lowerPath
    )
  ) {
    return 'text'
  }

  return null
}

function classifyUrl(
  value: string | undefined,
  path: string
): AgentOutputItem['kind'] | undefined {
  if (!value || !isUrl(value)) {
    return undefined
  }

  const lowerUrl = value.toLowerCase().split('?')[0] ?? ''
  const lowerPath = path.toLowerCase()

  if (/\.(mp4|webm|mov|m4v|ogg|ogv)$/.test(lowerUrl)) {
    return 'video'
  }

  if (/\.(png|jpe?g|gif|webp|svg|avif)$/.test(lowerUrl)) {
    return 'image'
  }

  if (
    /video|movie|render/.test(lowerPath) &&
    !/thumbnail|image/.test(lowerPath)
  ) {
    return 'link'
  }

  if (/image|thumbnail|poster|preview/.test(lowerPath)) {
    return 'image'
  }

  return 'link'
}

function isUrl(value: string) {
  try {
    const url = new URL(value)

    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function humanizePath(path: string) {
  const key = path.split('.').at(-1) ?? path

  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\d+$/, index => `Result ${Number(index) + 1}`)
    .replace(/\b\w/g, char => char.toUpperCase())
}

function shorten(value?: string | null) {
  if (!value) {
    return ''
  }

  if (value.length <= 18) {
    return value
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`
}
