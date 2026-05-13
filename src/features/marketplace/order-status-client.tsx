'use client'

import { useEffect, useRef, useState } from 'react'

import { decodePaymentRequiredHeader as decodeX402PaymentRequiredHeader } from '@x402/core/http'
import {
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams
} from '@x402/evm'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import type { PaymentRequired, x402PaymentResult } from '@x402/fetch'
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch'
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  Circle,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileJson,
  Loader2,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards
} from 'lucide-react'
import { prepareTransaction, sendTransaction } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { createPublicClient, formatUnits, http, parseAbi } from 'viem'
import { useWalletClient } from 'wagmi'

import { JsonViewer } from '@/components/data-display/json-viewer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyTextButton } from '@/features/marketplace/copy-endpoint-button'
import {
  storeMarketplaceOrderSnapshot,
  storeMarketplaceReceiptSnapshot
} from '@/features/marketplace/order-session-storage'
import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import {
  orderStatusDetails,
  orderStatusLabels
} from '@/features/marketplace/status'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import { useAutoPolling } from '@/hooks/use-auto-polling'
import {
  defaultAppChain,
  getExplorerTransactionUrl,
  paymentTokenAddress,
  paymentTokenDecimals,
  paymentTokenSymbol,
  paymentTokenTransferMethod,
  x402Network
} from '@/lib/config/chains'
import { walletProvider } from '@/lib/config/wallet'
import { cn } from '@/lib/utils/cn'
import { thirdwebActiveChain, thirdwebClient } from '@/lib/wallet/thirdweb'

type OrderStatusClientProps = {
  orderId: string
  initialOrder: MarketplaceOrder | null
}

export function OrderStatusClient({
  orderId,
  initialOrder
}: OrderStatusClientProps) {
  if (walletProvider === 'rainbow-kit') {
    return (
      <RainbowOrderStatusClient orderId={orderId} initialOrder={initialOrder} />
    )
  }

  return (
    <ThirdwebOrderStatusClient orderId={orderId} initialOrder={initialOrder} />
  )
}

type BrowserEvmSigner = {
  readonly address: `0x${string}`
  signTypedData(message: {
    domain: Record<string, unknown>
    types: Record<string, unknown>
    primaryType: string
    message: Record<string, unknown>
  }): Promise<`0x${string}`>
}

type Permit2ApprovalTransaction = {
  to: `0x${string}`
  data: `0x${string}`
}

type BrowserWalletControls = {
  signer: BrowserEvmSigner
  sendTransaction: (
    transaction: Permit2ApprovalTransaction
  ) => Promise<`0x${string}`>
}

type WalletStepId =
  | 'requirement'
  | 'allowance'
  | 'signature'
  | 'settlement'
  | 'result'

type WalletStepStatus = 'idle' | 'active' | 'complete' | 'error'

type WalletStep = {
  id: WalletStepId
  title: string
  description: string
  status: WalletStepStatus
  detail?: string
  txHash?: `0x${string}`
}

type PaymentRequirementInspection = {
  status: number
  statusText: string
  paymentRequired: PaymentRequired | null
  response: unknown
}

type PaidApiErrorBody = {
  error?: string
  message?: string
  reason?: string
  guidance?: string
  details?: unknown
  settlement?: {
    errorReason?: string
    errorMessage?: string
    transaction?: string
    network?: string
    status?: number
  }
}

type PaidProductCallBody = PaidApiErrorBody & {
  data?: unknown
  order?: Partial<MarketplaceOrder>
  receipt?: MarketplaceReceipt
  x402?: {
    transaction?: string
    network?: string
  }
}

const usdtBalanceAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
])
const ASYNC_JOB_POLL_INTERVAL_MS = 8000
const TRANSIENT_RETRY_ATTEMPTS = 3
const TRANSIENT_RETRY_BASE_DELAY_MS = 900
const asyncJobTerminalStatuses = new Set<MarketplaceOrder['status']>([
  'completed',
  'failed',
  'expired',
  'delta_payment_required'
])

const paymentChainPublicClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})

function RainbowOrderStatusClient(props: OrderStatusClientProps) {
  const { data: walletClient } = useWalletClient()

  return (
    <OrderStatusContent
      {...props}
      walletAddress={walletClient?.account?.address ?? null}
      walletLabel='RainbowKit wallet'
      getWalletControls={() => {
        if (!walletClient?.account) {
          return null
        }

        return {
          signer: {
            address: walletClient.account.address,
            signTypedData: message =>
              walletClient.signTypedData({
                account: walletClient.account,
                domain: message.domain,
                types: message.types,
                primaryType: message.primaryType,
                message: message.message
              } as Parameters<typeof walletClient.signTypedData>[0])
          },
          sendTransaction: transaction =>
            walletClient.sendTransaction({
              account: walletClient.account,
              chain: defaultAppChain.viemChain,
              to: transaction.to,
              data: transaction.data,
              value: 0n
            } as Parameters<typeof walletClient.sendTransaction>[0])
        } satisfies BrowserWalletControls
      }}
    />
  )
}

function ThirdwebOrderStatusClient(props: OrderStatusClientProps) {
  const account = useActiveAccount()

  return (
    <OrderStatusContent
      {...props}
      walletAddress={account?.address ?? null}
      walletLabel='Thirdweb wallet'
      getWalletControls={() => {
        if (!account?.address) {
          return null
        }

        return {
          signer: {
            address: account.address as `0x${string}`,
            signTypedData: message =>
              account.signTypedData(message as never) as Promise<`0x${string}`>
          },
          sendTransaction: async transaction => {
            if (!thirdwebClient) {
              throw new Error(
                'Thirdweb client is not configured for browser transactions.'
              )
            }

            const preparedTransaction = prepareTransaction({
              chain: thirdwebActiveChain,
              client: thirdwebClient,
              to: transaction.to,
              data: transaction.data,
              value: 0n
            })
            const receipt = await sendTransaction({
              account,
              transaction: preparedTransaction
            })

            return receipt.transactionHash as `0x${string}`
          }
        } satisfies BrowserWalletControls
      }}
    />
  )
}

function OrderStatusContent({
  orderId,
  initialOrder,
  walletAddress,
  walletLabel,
  getWalletControls
}: OrderStatusClientProps & {
  walletAddress: string | null
  walletLabel: string
  getWalletControls: () => BrowserWalletControls | null
}) {
  const [order, setOrder] = useState<MarketplaceOrder | null>(initialOrder)
  const [status, setStatus] = useState('')
  const [paymentRequirements, setPaymentRequirements] =
    useState<PaymentRequirementInspection | null>(null)
  const [walletSteps, setWalletSteps] =
    useState<WalletStep[]>(createWalletSteps)
  const [paymentError, setPaymentError] = useState('')
  const [isInspecting, setIsInspecting] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isRetryingProvider, setIsRetryingProvider] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const pollInFlightRef = useRef(false)

  useEffect(() => {
    if (order) {
      return
    }

    const saved = window.sessionStorage.getItem(`app:order:${orderId}`)

    if (saved) {
      setOrder(JSON.parse(saved) as MarketplaceOrder)
    }
  }, [order, orderId])

  const providerRetrying = order?.resultReleaseStatus === 'provider_retrying'
  const shouldPollProvider =
    Boolean(order) &&
    Boolean(order?.externalJobId || providerRetrying) &&
    !asyncJobTerminalStatuses.has(order?.status ?? 'failed')
  const providerPollIntervalMs = providerRetrying
    ? Math.max(
        ASYNC_JOB_POLL_INTERVAL_MS,
        (order?.providerRetry?.retryAfterSeconds ?? 60) * 1000
      )
    : ASYNC_JOB_POLL_INTERVAL_MS

  useAutoPolling({
    enabled: shouldPollProvider,
    intervalMs: providerPollIntervalMs,
    onPoll: pollProviderStatus
  })

  async function inspectPaymentRequirement() {
    if (!order) {
      return
    }

    setIsInspecting(true)
    setStatus('')
    setPaymentError('')
    setPaymentRequirements(null)

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-App-Order-Id': order.id
    }

    try {
      const { response, body } = await withTransientRetries(
        async () => {
          const nextResponse = await fetch(
            `/api/x402/products/${order.productSlug}/call`,
            {
              method: 'POST',
              headers,
              body: order.requestPayloadJson ?? '{}'
            }
          )
          const nextBody = (await readResponseBody(nextResponse)) as {
            error?: string
            order?: Partial<MarketplaceOrder>
            receipt?: MarketplaceReceipt
          }

          return { response: nextResponse, body: nextBody }
        },
        {
          shouldRetryResult: ({ response, body }) =>
            shouldRetryUnsettledHttpResult({ response, body }),
          onRetry: ({ nextAttempt, maxAttempts }) =>
            setStatus(
              `Temporary quote inspection error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
        }
      )

      if (response.status === 402) {
        setPaymentRequirements({
          status: response.status,
          statusText: response.statusText,
          paymentRequired: decodePaymentRequiredHeader(response),
          response: body
        })
        setStatus(
          'Payment requirements returned. Use an x402 buyer client, backend, or agent runner to sign and settle this request.'
        )
        return
      }

      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to run the paid API request.')
      }

      const receipt = body.receipt
        ? {
            ...body.receipt,
            orderId: order.id
          }
        : undefined
      const nextOrder: MarketplaceOrder = {
        ...order,
        ...body.order,
        id: order.id,
        status: (body.order?.status as MarketplaceOrder['status']) ?? 'paid',
        receiptId: receipt?.id,
        explorerUrl: receipt?.explorerUrl,
        updatedAt: new Date().toISOString()
      }

      storeMarketplaceOrderSnapshot(nextOrder)

      if (receipt) {
        storeMarketplaceReceiptSnapshot(receipt)
      }

      setOrder(nextOrder)
      setStatus(
        `${paymentTokenSymbol} payment settled and provider response returned.`
      )
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to inspect payment requirements.'
      )
    } finally {
      setIsInspecting(false)
    }
  }

  function updateWalletStep(id: WalletStepId, update: Partial<WalletStep>) {
    setWalletSteps(current =>
      current.map(step => (step.id === id ? { ...step, ...update } : step))
    )
  }

  function failActiveWalletStep(message: string) {
    setWalletSteps(current => {
      const activeStep = current.find(step => step.status === 'active')

      if (!activeStep) {
        return current
      }

      return current.map(step =>
        step.id === activeStep.id
          ? {
              ...step,
              status: 'error',
              detail: summarizeStepError(message)
            }
          : step
      )
    })
  }

  async function runWithWallet() {
    if (!order) {
      return
    }

    const walletControls = getWalletControls()

    if (!walletControls) {
      setStatus(`Connect a ${walletLabel} before running this paid API call.`)
      return
    }

    setIsPaying(true)
    setWalletSteps(createWalletSteps('requirement'))
    setStatus('Reading the x402 payment requirement from the gateway.')
    setPaymentError('')
    setPaymentRequirements(null)

    try {
      const initialRequirement = await withTransientRetries(
        () => requestPaymentRequirement(order),
        {
          onRetry: ({ nextAttempt, maxAttempts }) => {
            updateWalletStep('requirement', {
              status: 'active',
              detail: `Temporary quote error. Retrying ${nextAttempt} of ${maxAttempts}.`
            })
            setStatus(
              `Temporary quote error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
          }
        }
      )

      if (initialRequirement) {
        updateWalletStep('requirement', {
          status: 'complete',
          detail: 'the gateway returned a payable x402 requirement.'
        })
        setPaymentRequirements({
          status: initialRequirement.status,
          statusText: initialRequirement.statusText,
          paymentRequired: initialRequirement.paymentRequired,
          response: initialRequirement.body
        })
        await ensurePermit2Allowance(
          initialRequirement.paymentRequired,
          walletControls,
          message => setStatus(message),
          updateWalletStep
        )
      }

      updateWalletStep('signature', {
        status: 'active',
        detail: `Confirm the x402 ${paymentTokenSymbol} payment signature in your wallet.`
      })
      setStatus(
        `Waiting for wallet signature and ${paymentTokenSymbol} settlement.`
      )

      const client = registerExactEvmScheme(new x402Client(), {
        signer: walletControls.signer
      })
      const httpClient = new x402HTTPClient(client)
      const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient)
      let response: Response | null = null
      let paymentResult: x402PaymentResult | null = null
      let body: PaidProductCallBody | null = null

      let permit2AllowanceRefreshUsed = false

      for (let attempt = 0; attempt < TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
        updateWalletStep('signature', {
          status: 'active',
          detail:
            attempt === 0
              ? `Confirm the x402 ${paymentTokenSymbol} payment signature in your wallet.`
              : `Retrying wallet signature and settlement ${attempt + 1} of ${TRANSIENT_RETRY_ATTEMPTS}.`
        })

        try {
          response = await fetchWithPayment(
            `/api/x402/products/${order.productSlug}/call`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-App-Order-Id': order.id
              },
              body: order.requestPayloadJson ?? '{}'
            }
          )
          paymentResult = await httpClient
            .processResponse(response.clone())
            .catch(() => null)
          body = (await readResponseBody(response)) as PaidProductCallBody

          if (
            !permit2AllowanceRefreshUsed &&
            isPermit2AllowanceError(response, body, paymentResult)
          ) {
            const refreshedRequirement =
              decodePaymentRequiredHeader(response) ??
              initialRequirement?.paymentRequired

            if (!refreshedRequirement) {
              break
            }

            permit2AllowanceRefreshUsed = true
            setStatus(
              `${paymentTokenSymbol} approval is confirmed, but the payment retry still needs a refreshed allowance check.`
            )
            await sleep(calculateRetryDelay(attempt))
            await ensurePermit2Allowance(
              refreshedRequirement,
              walletControls,
              message => setStatus(message),
              updateWalletStep
            )
            continue
          }

          if (
            attempt < TRANSIENT_RETRY_ATTEMPTS - 1 &&
            shouldRetryUnsettledHttpResult({
              response,
              body,
              paymentResult
            })
          ) {
            const nextAttempt = attempt + 2
            updateWalletStep('signature', {
              status: 'active',
              detail: `Temporary payment error. Retrying ${nextAttempt} of ${TRANSIENT_RETRY_ATTEMPTS}.`
            })
            setStatus(
              `Temporary payment error. Retrying ${nextAttempt} of ${TRANSIENT_RETRY_ATTEMPTS}.`
            )
            await sleep(calculateRetryDelay(attempt))
            continue
          }

          break
        } catch (caughtError) {
          if (
            attempt < TRANSIENT_RETRY_ATTEMPTS - 1 &&
            shouldRetryTransientError(caughtError)
          ) {
            const nextAttempt = attempt + 2
            updateWalletStep('signature', {
              status: 'active',
              detail: `Temporary wallet or payment error. Retrying ${nextAttempt} of ${TRANSIENT_RETRY_ATTEMPTS}.`
            })
            setStatus(
              `Temporary wallet or payment error. Retrying ${nextAttempt} of ${TRANSIENT_RETRY_ATTEMPTS}.`
            )
            await sleep(calculateRetryDelay(attempt))
            continue
          }

          throw caughtError
        }
      }

      if (!response || !body) {
        throw new Error('Unable to run the paid API request.')
      }

      if (response.status === 402) {
        const nextPaymentRequired = decodePaymentRequiredHeader(response)

        if (!nextPaymentRequired) {
          throw new Error(buildPaidRequestError(response, body, paymentResult))
        }

        setPaymentRequirements({
          status: response.status,
          statusText: response.statusText,
          paymentRequired: nextPaymentRequired,
          response: body
        })
        throw new Error(
          body.error ??
            `Wallet payment was not completed. Check ${paymentTokenSymbol} balance, network, and signature approval.`
        )
      }

      if (!response.ok) {
        throw new Error(buildPaidRequestError(response, body, paymentResult))
      }

      const settlement =
        paymentResult?.kind === 'success'
          ? paymentResult.settleResponse
          : getSettleResponseOrNull(httpClient, response)
      const settlementTxHash =
        settlement?.transaction ||
        body.x402?.transaction ||
        body.receipt?.txHash

      updateWalletStep('signature', {
        status: 'complete',
        detail: 'Wallet signed the x402 payment payload.'
      })
      updateWalletStep('settlement', {
        status: 'complete',
        detail: settlementTxHash
          ? `${paymentTokenSymbol} settled on the configured network.`
          : `${paymentTokenSymbol} settled and the gateway received the paid response.`,
        txHash: isHexTransactionHash(settlementTxHash)
          ? settlementTxHash
          : undefined
      })
      const receipt = body.receipt
        ? {
            ...body.receipt,
            orderId: order.id
          }
        : undefined
      const responsePayload = body.order?.responsePayload ?? body.data
      const nextOrder: MarketplaceOrder = {
        ...order,
        ...body.order,
        id: order.id,
        buyerWallet: receipt?.buyerWallet ?? walletControls.signer.address,
        status:
          (body.order?.status as MarketplaceOrder['status']) ?? 'completed',
        receiptId: receipt?.id,
        explorerUrl: receipt?.explorerUrl,
        responsePayload,
        resultUrl: receipt?.resultUrl ?? body.order?.resultUrl,
        updatedAt: new Date().toISOString()
      }
      const providerFailed = nextOrder.status === 'failed'
      const providerRetrying =
        nextOrder.resultReleaseStatus === 'provider_retrying'

      updateWalletStep('result', {
        status: providerFailed
          ? 'error'
          : providerRetrying
            ? 'active'
            : 'complete',
        detail: providerFailed
          ? 'Provider failed after payment settlement. Review refund and provider response details below.'
          : providerRetrying
            ? 'Provider returned a temporary error. Payment remains reserved in escrow while the gateway retries.'
            : 'Provider response and receipt were saved.'
      })

      storeMarketplaceOrderSnapshot(nextOrder)

      if (receipt) {
        storeMarketplaceReceiptSnapshot(receipt)
      }

      setOrder(nextOrder)
      setStatus(
        providerRetrying
          ? body.message ||
              'Payment settled, and the gateway is holding escrow while retrying the provider.'
          : providerFailed
            ? body.message ||
              body.error ||
              'Payment settled, but the provider request failed.'
            : settlementTxHash
              ? `${paymentTokenSymbol} payment settled on-chain. Transaction: ${settlementTxHash}`
              : `${paymentTokenSymbol} payment settled and provider response returned.`
      )
      setPaymentError(
        providerFailed
          ? [
              body.error,
              body.message,
              nextOrder.resultReleaseStatus === 'refunded'
                ? 'Escrow refund completed.'
                : nextOrder.resultReleaseStatus === 'refundable'
                  ? 'Refund is required.'
                  : undefined
            ]
              .filter(Boolean)
              .join(' ')
          : ''
      )
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to run the paid API request.'

      setPaymentError(message)
      setStatus('')
      failActiveWalletStep(message)
    } finally {
      setIsPaying(false)
    }
  }

  async function pollProviderStatus() {
    if (
      !order?.externalJobId &&
      order?.resultReleaseStatus !== 'provider_retrying'
    ) {
      return
    }

    if (pollInFlightRef.current) {
      return
    }

    pollInFlightRef.current = true
    setIsPolling(true)
    setStatus('Checking provider job status.')

    try {
      const { response, body } = await withTransientRetries(
        async () => {
          const nextResponse = await fetch(
            `/api/orders/${order.id}/provider-status`,
            {
              headers: {
                Accept: 'application/json'
              }
            }
          )
          const nextBody = (await readResponseBody(nextResponse)) as {
            error?: string
            order?: MarketplaceOrder
          }

          return { response: nextResponse, body: nextBody }
        },
        {
          shouldRetryResult: ({ response }) =>
            isRetryableHttpStatus(response.status),
          onRetry: ({ nextAttempt, maxAttempts }) =>
            setStatus(
              `Temporary provider status error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
        }
      )

      if (!response.ok || !body.order) {
        throw new Error(body.error ?? 'Unable to refresh provider job status.')
      }

      setOrder(body.order)
      storeMarketplaceOrderSnapshot(body.order)
      setStatus(
        body.order.status === 'completed'
          ? 'Provider job completed. The API response is ready.'
          : body.order.resultReleaseStatus === 'provider_retrying'
            ? 'Provider returned a temporary error. Escrow is still reserved and the gateway will retry.'
            : `Provider job is ${orderStatusLabels[body.order.status].toLowerCase()}.`
      )
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to refresh provider job status.'
      )
    } finally {
      pollInFlightRef.current = false
      setIsPolling(false)
    }
  }

  async function retryProviderCall() {
    if (!order || !canRetryProviderCall(order)) {
      return
    }

    setIsRetryingProvider(true)
    setPaymentError('')
    setStatus('Retrying the provider with the existing paid order.')

    try {
      const { response, body } = await withTransientRetries(
        async () => {
          const nextResponse = await fetch(
            `/api/orders/${order.id}/provider-status`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json'
              }
            }
          )
          const nextBody = (await readResponseBody(nextResponse)) as {
            error?: string
            order?: MarketplaceOrder
            provider?: { errorMessage?: string }
          }

          return { response: nextResponse, body: nextBody }
        },
        {
          shouldRetryResult: ({ response }) =>
            isRetryableHttpStatus(response.status),
          onRetry: ({ nextAttempt, maxAttempts }) =>
            setStatus(
              `Temporary provider retry error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
        }
      )

      if (!response.ok || !body.order) {
        throw new Error(
          body.error ??
            body.provider?.errorMessage ??
            'Unable to retry the provider request.'
        )
      }

      storeMarketplaceOrderSnapshot(body.order)
      setOrder(body.order)
      setStatus(
        body.order.status === 'failed'
          ? 'Provider retry completed, but the provider still returned an error.'
          : 'Provider retry completed and the order was updated.'
      )
      setPaymentError(
        body.order.status === 'failed'
          ? (body.provider?.errorMessage ??
              'Provider retry failed. Review the provider response below.')
          : ''
      )
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to retry the provider request.'

      setPaymentError(message)
      setStatus('')
    } finally {
      setIsRetryingProvider(false)
    }
  }

  async function claimMeteredResult() {
    if (!order || order.status !== 'delta_payment_required') {
      return
    }

    const walletControls = getWalletControls()

    if (!walletControls) {
      setStatus(`Connect a ${walletLabel} before claiming this result.`)
      return
    }

    setIsClaiming(true)
    setPaymentError('')
    setStatus('Reading the metered delta payment requirement.')

    try {
      const initialRequirement = await withTransientRetries(
        () => requestClaimPaymentRequirement(order),
        {
          onRetry: ({ nextAttempt, maxAttempts }) =>
            setStatus(
              `Temporary claim quote error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
        }
      )

      if (initialRequirement) {
        setPaymentRequirements({
          status: initialRequirement.status,
          statusText: initialRequirement.statusText,
          paymentRequired: initialRequirement.paymentRequired,
          response: initialRequirement.body
        })
        await ensurePermit2Allowance(
          initialRequirement.paymentRequired,
          walletControls,
          message => setStatus(message),
          updateWalletStep
        )
      }

      const client = registerExactEvmScheme(new x402Client(), {
        signer: walletControls.signer
      })
      const httpClient = new x402HTTPClient(client)
      const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient)
      const { response, body, paymentResult } = await withTransientRetries(
        async () => {
          const nextResponse = await fetchWithPayment(
            `/api/x402/orders/${order.id}/claim`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json'
              }
            }
          )
          const nextPaymentResult = await httpClient
            .processResponse(nextResponse.clone())
            .catch(() => null)
          const nextBody = (await readResponseBody(nextResponse)) as {
            error?: string
            order?: Partial<MarketplaceOrder>
            receipt?: MarketplaceReceipt
            data?: unknown
            x402?: {
              transaction?: string
              network?: string
            }
          }

          return {
            response: nextResponse,
            body: nextBody,
            paymentResult: nextPaymentResult
          }
        },
        {
          shouldRetryResult: ({ response, body, paymentResult }) =>
            shouldRetryUnsettledHttpResult({
              response,
              body,
              paymentResult
            }),
          onRetry: ({ nextAttempt, maxAttempts }) =>
            setStatus(
              `Temporary claim payment error. Retrying ${nextAttempt} of ${maxAttempts}.`
            )
        }
      )

      if (!response.ok) {
        throw new Error(buildPaidRequestError(response, body, paymentResult))
      }

      const receipt = body.receipt
      const nextOrder: MarketplaceOrder = {
        ...order,
        ...body.order,
        id: order.id,
        status: 'completed',
        resultReleaseStatus: 'released',
        receiptId: receipt?.id ?? order.receiptId,
        explorerUrl: receipt?.explorerUrl ?? order.explorerUrl,
        responsePayload: body.data ?? body.order?.responsePayload,
        resultUrl: receipt?.resultUrl ?? body.order?.resultUrl,
        updatedAt: new Date().toISOString()
      }

      storeMarketplaceOrderSnapshot(nextOrder)

      if (receipt) {
        storeMarketplaceReceiptSnapshot(receipt)
      }

      setOrder(nextOrder)
      setStatus(
        receipt?.txHash
          ? `Metered delta settled on-chain. Transaction: ${receipt.txHash}`
          : 'Metered delta settled and the provider result is released.'
      )
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to claim the metered result.'

      setPaymentError(message)
      setStatus(message)
    } finally {
      setIsClaiming(false)
    }
  }

  if (!order) {
    return (
      <div>
        <p className='font-semibold'>Order not found</p>
        <p className='text-foreground/65 mt-2 text-sm leading-6'>
          The order record is not available in the current browser session.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]'>
        <Card className='space-y-5 p-5 sm:p-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <WalletCards className='text-primary h-5 w-5' aria-hidden />
                <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Payment console
                </p>
              </div>
              <h2 className='mt-3 text-2xl font-semibold'>
                {order.status === 'payment_required'
                  ? 'Pay this API call with your wallet'
                  : 'Payment and provider call'}
              </h2>
            </div>
            <div className='flex flex-col gap-3 sm:items-end'>
              <div className='flex flex-wrap gap-2 sm:justify-end'>
                <Badge className='w-fit'>x402</Badge>
                <Badge className='w-fit'>{paymentTokenSymbol}</Badge>
                <Badge className='w-fit'>Network</Badge>
              </div>
              <div className='flex flex-wrap gap-2 sm:justify-end'>
                <Button
                  onClick={runWithWallet}
                  disabled={order.status !== 'payment_required' || isPaying}
                >
                  {isPaying ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                      Running
                    </>
                  ) : order.status === 'payment_required' ? (
                    <>
                      <WalletCards className='h-4 w-4' aria-hidden />
                      Run
                    </>
                  ) : (
                    <>
                      <BadgeCheck className='h-4 w-4' aria-hidden />
                      Paid
                    </>
                  )}
                </Button>
                <Button
                  variant='outline'
                  onClick={inspectPaymentRequirement}
                  disabled={order.status !== 'payment_required' || isInspecting}
                >
                  {isInspecting ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                      Checking
                    </>
                  ) : (
                    <>
                      <FileJson className='h-4 w-4' aria-hidden />
                      Quote
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <PaymentStepList steps={walletSteps} />

          <div className='border-foreground/10 bg-background/40 rounded-lg border p-4'>
            <div className='min-w-0 space-y-2'>
              <p className='text-foreground/60 text-xs uppercase'>
                Connected signer
              </p>
              <p className='mt-1 font-semibold break-all'>
                {walletAddress ??
                  `Connect a ${walletLabel} to pay from the site`}
              </p>
              <StatusMessage status={status} explorerUrl={order.explorerUrl} />
            </div>
          </div>
        </Card>

        <OrderSnapshotCard order={order} />
      </div>

      {paymentRequirements ? (
        <PaymentRequirementCard inspection={paymentRequirements} />
      ) : null}
      {paymentError ? <PaymentErrorCard message={paymentError} /> : null}

      <ProviderResponsePanel
        order={order}
        isPolling={isPolling}
        onPoll={pollProviderStatus}
        isRetryingProvider={isRetryingProvider}
        onRetryProvider={retryProviderCall}
        isClaiming={isClaiming}
        onClaim={claimMeteredResult}
      />

      <SettlementLinks order={order} />
      <OrderMetadataGrid order={order} />
    </div>
  )
}

function createWalletSteps(activeStep?: WalletStepId): WalletStep[] {
  const steps: Array<Omit<WalletStep, 'status'>> = [
    {
      id: 'requirement',
      title: 'Quote',
      description: 'x402 price'
    },
    {
      id: 'allowance',
      title: 'Approve',
      description: `${paymentTokenSymbol} ready`
    },
    {
      id: 'signature',
      title: 'Sign',
      description: 'Wallet confirms'
    },
    {
      id: 'settlement',
      title: 'Settle',
      description: 'On-chain'
    },
    {
      id: 'result',
      title: 'Result',
      description: 'API output'
    }
  ]

  return steps.map(step => ({
    ...step,
    status: step.id === activeStep ? 'active' : 'idle'
  }))
}

function PaymentStepList({ steps }: { steps: WalletStep[] }) {
  return (
    <div className='border-border bg-background/35 rounded-xl border p-3'>
      <div className='grid gap-3 md:grid-cols-5'>
        {steps.map(step => (
          <div
            key={step.id}
            className={cn(
              'relative rounded-lg p-3 transition',
              step.status === 'active' && 'bg-accent/12',
              step.status === 'complete' && 'bg-emerald-500/10',
              step.status === 'error' && 'bg-destructive/10'
            )}
          >
            <div className='flex gap-3 md:flex-col'>
              <div
                className={cn(
                  'border-border bg-card flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                  step.status === 'active' && 'border-primary/60 bg-primary/10',
                  step.status === 'complete' &&
                    'border-emerald-500/40 bg-emerald-500/10',
                  step.status === 'error' &&
                    'border-destructive/50 bg-destructive/10'
                )}
              >
                <StepIcon id={step.id} status={step.status} />
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-semibold'>{step.title}</p>
                <p className='text-foreground/60 mt-1 text-xs leading-5 break-words'>
                  {step.detail ?? step.description}
                </p>
              </div>
            </div>
            {step.txHash ? (
              <a
                className='text-primary mt-3 inline-flex max-w-full items-center gap-1 text-xs font-semibold break-all underline-offset-4 hover:underline'
                href={
                  getExplorerTransactionUrl(step.txHash, defaultAppChain.id) ??
                  '#'
                }
                target='_blank'
                rel='noreferrer'
              >
                View transaction
                <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function OrderSnapshotCard({ order }: { order: MarketplaceOrder }) {
  const summaryItems = [
    {
      icon: CircleDollarSign,
      label: 'Quote',
      value: order.quotedAmountUsdt ?? order.amountUsdt
    },
    {
      icon: ShieldCheck,
      label: 'Paid',
      value: order.paidAmountUsdt ?? order.reservedAmountUsdt ?? 'Pending'
    },
    {
      icon: Activity,
      label: 'Provider',
      value: order.providerName
    },
    {
      icon: ReceiptText,
      label: 'Request',
      value: shortenHash(order.requestId)
    }
  ]
  const refundUrl =
    order.escrowRefundExplorerUrl ??
    getExplorerTransactionUrl(order.escrowRefundTxHash, defaultAppChain.id)

  return (
    <Card className='space-y-5 p-5 sm:p-6'>
      <div>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          Current state
        </p>
        <div className='mt-3 flex flex-wrap items-center gap-3'>
          <OrderStateIcon status={order.status} />
          <h2 className='text-2xl font-semibold'>
            {orderStatusLabels[order.status]}
          </h2>
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-1'>
        <SummaryTile label='Product' value={order.productName} />
        {summaryItems.map(item => (
          <SummaryTile
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
          />
        ))}
        {order.actualAmountUsdt ? (
          <SummaryTile label='Final usage' value={order.actualAmountUsdt} />
        ) : null}
        {order.deltaAmountUsdt && order.deltaAmountUsdt !== '0.00 USDT' ? (
          <SummaryTile label='Delta' value={order.deltaAmountUsdt} />
        ) : null}
        {order.resultReleaseStatus === 'refunded' && refundUrl ? (
          <SummaryTile
            icon={ReceiptText}
            label='Refund'
            value={shortenHash(order.escrowRefundTxHash ?? refundUrl)}
            href={refundUrl}
          />
        ) : null}
      </div>

      <details className='border-foreground/10 rounded-lg border p-3'>
        <summary className='cursor-pointer text-sm font-semibold'>
          What this means
        </summary>
        <p className='text-foreground/70 mt-3 text-sm leading-6'>
          {orderStatusDetails[order.status]}
        </p>
      </details>
    </Card>
  )
}

function StatusMessage({
  status,
  explorerUrl
}: {
  status: string
  explorerUrl?: string | null
}) {
  if (!status) {
    return (
      <div className='text-foreground/60 mt-3 flex items-center gap-2 text-sm'>
        <ShieldCheck className='h-4 w-4' aria-hidden />
        <span>First run may ask for {paymentTokenSymbol} approval.</span>
      </div>
    )
  }

  return (
    <div className='text-foreground/70 mt-3 space-y-2 text-sm leading-6'>
      <p>{status.replace(/ Transaction: .+$/, '.')}</p>
      {explorerUrl ? (
        <a
          className='text-primary inline-flex max-w-full items-center gap-1 font-semibold break-all underline-offset-4 hover:underline'
          href={explorerUrl}
          target='_blank'
          rel='noreferrer'
        >
          Open settlement transaction
          <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
        </a>
      ) : null}
    </div>
  )
}

function ProviderResponsePanel({
  order,
  isPolling,
  onPoll,
  isRetryingProvider,
  onRetryProvider,
  isClaiming,
  onClaim
}: {
  order: MarketplaceOrder
  isPolling: boolean
  onPoll: () => Promise<void>
  isRetryingProvider: boolean
  onRetryProvider: () => Promise<void>
  isClaiming: boolean
  onClaim: () => Promise<void>
}) {
  const isProviderRetrying =
    order.resultReleaseStatus === 'provider_retrying' ||
    Boolean(order.providerRetry?.retryable && order.status === 'processing')
  const hasAsyncJob = Boolean(order.externalJobId) || isProviderRetrying
  const hasResponse = Boolean(order.responsePayload)
  const hasProjectHandoff =
    Boolean(order.resultUrl) &&
    (stringifyPayloadPath(order.responsePayload, 'result.publicProjectUrl') ||
      stringifyPayloadPath(order.responsePayload, 'publicProjectUrl') ||
      stringifyPayloadPath(order.responsePayload, 'result.cloneUrl') ||
      stringifyPayloadPath(order.responsePayload, 'cloneUrl'))
  const needsDeltaPayment =
    order.status === 'delta_payment_required' ||
    order.resultReleaseStatus === 'delta_payment_required'
  const canRetryProvider = canRetryProviderCall(order)

  return (
    <Card className='space-y-5 p-5 sm:p-6'>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            API response
          </p>
          <h2 className='mt-2 flex items-center gap-2 text-2xl font-semibold'>
            {hasAsyncJob ? (
              <Clock3 className='text-primary h-5 w-5' aria-hidden />
            ) : hasResponse ? (
              <FileJson className='text-primary h-5 w-5' aria-hidden />
            ) : (
              <Circle className='text-foreground/40 h-5 w-5' aria-hidden />
            )}
            {hasProjectHandoff
              ? 'Project handoff ready'
              : isProviderRetrying
                ? 'Provider retrying'
                : hasAsyncJob && order.status !== 'completed'
                  ? order.status === 'failed'
                    ? 'Provider failed'
                    : 'Async job accepted'
                  : hasResponse
                    ? 'Provider response received'
                    : 'No provider response yet'}
          </h2>
        </div>
        {hasAsyncJob ? (
          <Badge className='w-fit'>Async provider job</Badge>
        ) : null}
      </div>

      {hasAsyncJob ? (
        <div className='grid gap-3 md:grid-cols-3'>
          <SummaryTile label='Job ID' value={order.externalJobId ?? ''} />
          <SummaryTile
            label='Job status'
            value={orderStatusLabels[order.status]}
          />
          <div className='border-foreground/10 rounded-lg border p-3'>
            <p className='text-foreground/60 text-xs uppercase'>Result link</p>
            {order.resultUrl ? (
              <a
                className='text-primary mt-1 inline-flex max-w-full items-center gap-1 font-semibold break-all underline-offset-4 hover:underline'
                href={order.resultUrl}
                target='_blank'
                rel='noreferrer'
              >
                {hasProjectHandoff ? 'Open project handoff' : 'Open result'}
                <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
              </a>
            ) : (
              <p className='text-foreground/65 mt-1 font-semibold'>
                Not available yet
              </p>
            )}
          </div>
        </div>
      ) : null}

      {hasAsyncJob ? (
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <Button onClick={onPoll} disabled={isPolling || needsDeltaPayment}>
            {isPolling ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                Polling
              </>
            ) : (
              <>
                <RefreshCw className='h-4 w-4' aria-hidden />
                Poll status
              </>
            )}
          </Button>
          <p className='text-foreground/60 text-sm'>
            {isProviderRetrying
              ? `Auto-refreshes every ${Math.max(
                  ASYNC_JOB_POLL_INTERVAL_MS / 1000,
                  order.providerRetry?.retryAfterSeconds ?? 60
                )}s while the temporary provider outage is retryable.`
              : `Auto-refreshes every ${
                  ASYNC_JOB_POLL_INTERVAL_MS / 1000
                }s until the job finishes.`}
          </p>
        </div>
      ) : null}

      {needsDeltaPayment ? (
        <div className='border-primary/30 bg-primary/10 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <p className='font-semibold'>Metered delta required</p>
            <p className='text-foreground/70 mt-1 text-sm leading-6'>
              Final usage is {order.actualAmountUsdt ?? 'above the quote'}. Pay
              the remaining {order.deltaAmountUsdt ?? paymentTokenSymbol} to
              unlock the completed provider response.
            </p>
          </div>
          <Button onClick={onClaim} disabled={isClaiming}>
            {isClaiming ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                Claiming result
              </>
            ) : (
              'Pay delta and reveal'
            )}
          </Button>
        </div>
      ) : null}

      {isProviderRetrying ? (
        <div className='border-primary/30 bg-primary/10 rounded-lg border p-4'>
          <p className='font-semibold'>Temporary provider outage</p>
          <p className='text-foreground/70 mt-1 text-sm leading-6'>
            the gateway kept the payment reserved in escrow instead of refunding
            immediately. Polling will retry until{' '}
            {order.providerRetry?.retryUntil
              ? new Date(order.providerRetry.retryUntil).toLocaleString()
              : 'the retry window expires'}
            .
          </p>
          {order.providerRetry?.reason ? (
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              Last provider response: {order.providerRetry.reason}
            </p>
          ) : null}
        </div>
      ) : null}

      {order.status === 'failed' ? (
        <div className='border-destructive/35 bg-destructive/10 rounded-lg border p-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <p className='font-semibold'>Provider failed after payment</p>
              <p className='text-foreground/70 mt-1 text-sm leading-6'>
                {order.resultReleaseStatus === 'refunded'
                  ? 'The payment was refunded from escrow. The refund transaction is linked above.'
                  : order.resultReleaseStatus === 'refundable'
                    ? 'The payment settled, but provider work did not finish. Retry the provider after fixing the listing, or inspect the response below.'
                    : 'Inspect the provider response below to see what failed.'}
              </p>
            </div>
            {canRetryProvider ? (
              <Button
                type='button'
                variant='outline'
                onClick={onRetryProvider}
                disabled={isRetryingProvider}
                className='shrink-0'
              >
                {isRetryingProvider ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
                    Retrying
                  </>
                ) : (
                  <>
                    <RefreshCw className='h-4 w-4' aria-hidden />
                    Retry provider
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {order.providerRequest ? (
        <JsonViewer
          title='Provider request trace'
          value={order.providerRequest}
          defaultOpen={false}
          maxHeightClassName='max-h-[28rem]'
          copyLabel='Copy trace'
        />
      ) : null}

      {hasResponse ? (
        <JsonViewer
          title='Response JSON'
          value={order.responsePayload}
          maxHeightClassName='max-h-[32rem]'
          copyLabel='Copy response'
        />
      ) : (
        <div className='border-foreground/10 bg-background/40 flex items-center gap-3 rounded-lg border p-4 text-sm'>
          <FileJson className='text-foreground/45 h-5 w-5' aria-hidden />
          <span>Provider output appears here after payment.</span>
        </div>
      )}
    </Card>
  )
}

function SettlementLinks({ order }: { order: MarketplaceOrder }) {
  if (
    !order.receiptId &&
    !order.explorerUrl &&
    !order.agentRunId &&
    !order.escrowReserveExplorerUrl &&
    !order.escrowReleaseExplorerUrl &&
    !order.escrowRefundExplorerUrl
  ) {
    return null
  }

  const txHash = getTransactionHashFromExplorerUrl(order.explorerUrl)

  return (
    <Card className='grid gap-3 p-5 text-sm md:grid-cols-2 lg:grid-cols-3'>
      {order.receiptId ? (
        <div className='border-foreground/10 rounded-lg border p-4'>
          <p className='text-foreground/60 text-xs uppercase'>Receipt</p>
          <a
            className='text-primary mt-1 block font-semibold break-all underline-offset-4 hover:underline'
            href={`/receipts/${order.receiptId}`}
          >
            {order.receiptId}
          </a>
        </div>
      ) : null}
      {order.explorerUrl ? (
        <div className='border-foreground/10 rounded-lg border p-4'>
          <p className='text-foreground/60 text-xs uppercase'>
            Network transaction
          </p>
          <a
            className='text-primary mt-1 inline-flex max-w-full items-center gap-1 font-semibold break-all underline-offset-4 hover:underline'
            href={order.explorerUrl}
            target='_blank'
            rel='noreferrer'
          >
            {txHash ? shortenHash(txHash) : 'Open on explorer'}
            <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
          </a>
        </div>
      ) : null}
      {order.agentRunId ? (
        <div className='border-foreground/10 rounded-lg border p-4'>
          <p className='text-foreground/60 text-xs uppercase'>Agent run</p>
          <a
            className='text-primary mt-1 block font-semibold break-all underline-offset-4 hover:underline'
            href={`/agents/${order.agentRunId}`}
          >
            {order.agentRunId}
          </a>
        </div>
      ) : null}
      {order.escrowReserveExplorerUrl ? (
        <ExplorerTile
          label='Escrow reserve'
          url={order.escrowReserveExplorerUrl}
        />
      ) : null}
      {order.escrowReleaseExplorerUrl ? (
        <ExplorerTile
          label='Escrow release'
          url={order.escrowReleaseExplorerUrl}
        />
      ) : null}
      {order.escrowRefundExplorerUrl ? (
        <ExplorerTile
          label='Escrow refund'
          url={order.escrowRefundExplorerUrl}
        />
      ) : null}
    </Card>
  )
}

function ExplorerTile({ label, url }: { label: string; url: string }) {
  const txHash = getTransactionHashFromExplorerUrl(url)

  return (
    <div className='border-foreground/10 rounded-lg border p-4'>
      <p className='text-foreground/60 text-xs uppercase'>{label}</p>
      <a
        className='text-primary mt-1 inline-flex max-w-full items-center gap-1 font-semibold break-all underline-offset-4 hover:underline'
        href={url}
        target='_blank'
        rel='noreferrer'
      >
        {txHash ? shortenHash(txHash) : 'Open on explorer'}
        <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
      </a>
    </div>
  )
}

function OrderMetadataGrid({ order }: { order: MarketplaceOrder }) {
  return (
    <Card className='grid gap-3 p-5 text-sm md:grid-cols-2 xl:grid-cols-3'>
      {[
        ['Order ID', order.id],
        ['Request ID', order.requestId],
        ['Provider wallet', order.providerWallet ?? ''],
        ['Buyer wallet', order.buyerWallet],
        ['Pricing source', order.pricingSource ?? 'fixed'],
        ['Result release', order.resultReleaseStatus ?? 'not_applicable'],
        ['Escrow state', order.escrowStatus ?? 'not_applicable'],
        [
          'Retry until',
          order.providerRetry?.retryUntil
            ? new Date(order.providerRetry.retryUntil).toLocaleString()
            : ''
        ],
        [
          'Retry attempts',
          order.providerRetry?.attempts
            ? String(order.providerRetry.attempts)
            : ''
        ],
        ['Refund amount', order.refundAmountUsdt ?? ''],
        ['Created', new Date(order.createdAt).toLocaleString()],
        ['Updated', new Date(order.updatedAt).toLocaleString()]
      ].map(([label, value]) => (
        <SummaryTile key={label} label={label} value={value} />
      ))}
    </Card>
  )
}

function StepIcon({
  id,
  status
}: {
  id: WalletStepId
  status: WalletStepStatus
}) {
  if (status === 'active') {
    return <Loader2 className='text-primary h-5 w-5 animate-spin' aria-hidden />
  }

  if (status === 'complete') {
    return <CheckCircle2 className='h-5 w-5 text-emerald-500' aria-hidden />
  }

  if (status === 'error') {
    return <AlertTriangle className='text-destructive h-5 w-5' aria-hidden />
  }

  const Icon = getWalletStepIcon(id)

  return <Icon className='text-foreground/45 h-5 w-5' aria-hidden />
}

function getWalletStepIcon(id: WalletStepId) {
  if (id === 'requirement') {
    return CircleDollarSign
  }

  if (id === 'allowance') {
    return ShieldCheck
  }

  if (id === 'signature') {
    return WalletCards
  }

  if (id === 'settlement') {
    return BadgeCheck
  }

  return FileJson
}

function OrderStateIcon({ status }: { status: MarketplaceOrder['status'] }) {
  const className = 'h-6 w-6'

  if (status === 'completed' || status === 'paid' || status === 'ready') {
    return <CheckCircle2 className={cn(className, 'text-emerald-500')} />
  }

  if (status === 'failed' || status === 'expired') {
    return <AlertTriangle className={cn(className, 'text-destructive')} />
  }

  if (status === 'processing' || status === 'forwarding') {
    return <Loader2 className={cn(className, 'text-primary animate-spin')} />
  }

  if (status === 'delta_payment_required') {
    return <CircleDollarSign className={cn(className, 'text-amber-500')} />
  }

  return <Clock3 className={cn(className, 'text-primary')} />
}

function PaymentRequirementCard({
  inspection
}: {
  inspection: PaymentRequirementInspection
}) {
  const requirement = inspection.paymentRequired
    ? getPreferredPaymentRequirement(inspection.paymentRequired)
    : undefined
  const tokenSymbol = requirement
    ? getRequirementTokenSymbol(requirement)
    : paymentTokenSymbol
  const tokenDecimals = requirement
    ? getRequirementTokenDecimals(requirement)
    : paymentTokenDecimals

  return (
    <Card className='space-y-4'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Payment quote
          </p>
          <h2 className='mt-2 text-lg font-semibold'>
            {requirement
              ? `${formatPaymentTokenAmount(
                  BigInt(requirement.amount),
                  tokenDecimals
                )} ${tokenSymbol} required`
              : 'x402 payment requirement returned'}
          </h2>
        </div>
        <Badge className='w-fit'>{inspection.status} Payment Required</Badge>
      </div>
      {requirement ? (
        <div className='grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4'>
          <SummaryTile label='Network' value={requirement.network} />
          <SummaryTile label='Scheme' value={requirement.scheme} />
          <SummaryTile label='Asset' value={requirement.asset} />
          <SummaryTile label='Pay to' value={requirement.payTo} />
        </div>
      ) : null}
      <JsonViewer
        title='Raw x402 requirement JSON'
        value={inspection}
        defaultOpen={false}
        maxHeightClassName='max-h-80'
        copyLabel='Copy x402 JSON'
      />
    </Card>
  )
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  href
}: {
  label: string
  value: string
  icon?: typeof Circle
  href?: string | null
}) {
  const content = (
    <>
      {Icon ? (
        <Icon className='text-primary mt-0.5 h-4 w-4 shrink-0' aria-hidden />
      ) : null}
      <div className='min-w-0'>
        <p className='text-foreground/60 text-xs uppercase'>{label}</p>
        <p className='mt-1 flex items-center gap-1 font-semibold break-all'>
          {value}
          {href ? (
            <ExternalLink className='h-3.5 w-3.5 shrink-0' aria-hidden />
          ) : null}
        </p>
      </div>
    </>
  )

  if (href) {
    return (
      <a
        className='border-foreground/10 bg-background/35 hover:border-primary/45 focus-visible:ring-primary flex gap-3 rounded-lg border p-3 transition focus-visible:ring-2 focus-visible:outline-none'
        href={href}
        target='_blank'
        rel='noreferrer'
      >
        {content}
      </a>
    )
  }

  return (
    <div className='border-foreground/10 bg-background/35 flex gap-3 rounded-lg border p-3'>
      {content}
    </div>
  )
}

function PaymentErrorCard({ message }: { message: string }) {
  const title = /not found|404/i.test(message)
    ? 'Product is not available for this request'
    : 'Payment did not settle'

  return (
    <Card className='border-destructive/45 bg-destructive/10 p-5'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex gap-3'>
          <div className='bg-destructive/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full'>
            <AlertTriangle className='text-destructive h-5 w-5' aria-hidden />
          </div>
          <div>
            <p className='font-semibold'>{title}</p>
            <p className='text-foreground/75 mt-2 text-sm leading-6'>
              {message}
            </p>
          </div>
        </div>
        <CopyTextButton
          text={message}
          label='Copy error'
          copiedLabel='Copied'
        />
      </div>
    </Card>
  )
}

function getSettleResponseOrNull(
  httpClient: x402HTTPClient,
  response: Response
) {
  try {
    return httpClient.getPaymentSettleResponse(name =>
      response.headers.get(name)
    )
  } catch {
    return null
  }
}

function buildPaidRequestError(
  response: Response,
  body: {
    error?: string
    message?: string
    reason?: string
    guidance?: string
    details?: unknown
    settlement?: PaidApiErrorBody['settlement']
  },
  paymentResult: x402PaymentResult | null
) {
  const paymentRequired = decodePaymentRequiredHeader(response)

  if (
    response.status === 412 ||
    paymentRequired?.error === 'permit2_allowance_required'
  ) {
    return [
      `${paymentTokenSymbol} settlement still needs Permit2 allowance or sufficient wallet funds.`,
      `Approve the ${paymentTokenSymbol} allowance when prompted, then confirm the wallet has enough ${paymentTokenSymbol} and ${defaultAppChain.nativeCurrency.symbol} gas on ${defaultAppChain.shortName}.`
    ].join(' ')
  }

  if (
    paymentResult?.kind === 'error' &&
    isPaidApiErrorBody(paymentResult.body)
  ) {
    return formatPaidApiError(paymentResult.body, response)
  }

  if (paymentResult?.kind === 'settle_failed') {
    return (
      [
        paymentResult.settleResponse.errorMessage,
        paymentResult.settleResponse.errorReason
      ]
        .filter(Boolean)
        .join(' ') || `${paymentTokenSymbol} settlement failed.`
    )
  }

  if (paymentResult?.kind === 'payment_required') {
    return (
      paymentResult.paymentRequired.error ??
      'Payment was not accepted by the x402 facilitator.'
    )
  }

  const message = formatPaidApiError(body, response)

  return message
    ? message
    : `Paid API request failed (${response.status} ${response.statusText}).`
}

function formatPaidApiError(body: PaidApiErrorBody, response: Response) {
  const details =
    typeof body.details === 'string'
      ? body.details
      : body.details
        ? JSON.stringify(body.details)
        : ''
  const settlementReason =
    body.settlement?.errorMessage ?? body.settlement?.errorReason
  const parts = [
    body.error,
    body.message,
    settlementReason,
    body.reason,
    details,
    body.guidance
  ].filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return ''
  }

  return `${dedupeText(parts).join(' ')} (${response.status} ${
    response.statusText
  }).`
}

function dedupeText(parts: string[]) {
  return parts.filter((part, index) => parts.indexOf(part) === index)
}

function isPaidApiErrorBody(value: unknown): value is PaidApiErrorBody {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function canRetryProviderCall(order: MarketplaceOrder) {
  return (
    order.status === 'failed' &&
    Boolean(order.receiptId) &&
    Boolean(order.requestPayloadJson) &&
    order.resultReleaseStatus !== 'refunded'
  )
}

function isPermit2AllowanceError(
  response: Response,
  body: PaidApiErrorBody,
  paymentResult: x402PaymentResult | null
) {
  const paymentRequired = decodePaymentRequiredHeader(response)
  const text = [
    body.error,
    body.message,
    body.reason,
    paymentRequired?.error,
    paymentResult?.kind === 'payment_required'
      ? paymentResult.paymentRequired.error
      : undefined
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return (
    response.status === 412 ||
    paymentRequired?.error === 'permit2_allowance_required' ||
    text.includes('permit2') ||
    text.includes('allowance')
  )
}

function summarizeStepError(message: string) {
  if (/not found|404/i.test(message)) {
    return 'Product access blocked'
  }

  if (/balance|allowance|permit2/i.test(message)) {
    return 'Approval needed'
  }

  if (/settlement|payment/i.test(message)) {
    return 'Payment failed'
  }

  return 'Needs attention'
}

function sleep(milliseconds: number) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds))
}

type RetryContext = {
  attempt: number
  nextAttempt: number
  maxAttempts: number
  delayMs: number
  reason: string
}

async function withTransientRetries<T>(
  operation: () => Promise<T>,
  options: {
    shouldRetryResult?: (result: T) => boolean
    shouldRetryError?: (error: unknown) => boolean
    onRetry?: (context: RetryContext) => void | Promise<void>
  } = {}
) {
  const shouldRetryError = options.shouldRetryError ?? shouldRetryTransientError

  for (let attempt = 0; attempt < TRANSIENT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const result = await operation()

      if (
        attempt < TRANSIENT_RETRY_ATTEMPTS - 1 &&
        options.shouldRetryResult?.(result)
      ) {
        const delayMs = calculateRetryDelay(attempt)

        await options.onRetry?.({
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          maxAttempts: TRANSIENT_RETRY_ATTEMPTS,
          delayMs,
          reason: 'retryable_response'
        })
        await sleep(delayMs)
        continue
      }

      return result
    } catch (error) {
      if (attempt < TRANSIENT_RETRY_ATTEMPTS - 1 && shouldRetryError(error)) {
        const delayMs = calculateRetryDelay(attempt)

        await options.onRetry?.({
          attempt: attempt + 1,
          nextAttempt: attempt + 2,
          maxAttempts: TRANSIENT_RETRY_ATTEMPTS,
          delayMs,
          reason: error instanceof Error ? error.message : 'retryable_exception'
        })
        await sleep(delayMs)
        continue
      }

      throw error
    }
  }

  throw new Error('Retry attempts were exhausted.')
}

function calculateRetryDelay(attempt: number) {
  return TRANSIENT_RETRY_BASE_DELAY_MS * 2 ** attempt
}

function shouldRetryUnsettledHttpResult({
  response,
  body,
  paymentResult
}: {
  response: Response
  body?: unknown
  paymentResult?: x402PaymentResult | null
}) {
  if (!isRetryableHttpStatus(response.status)) {
    return false
  }

  return !hasSettledPaymentArtifact(body, paymentResult)
}

function isRetryableHttpStatus(status: number) {
  return [408, 429, 500, 502, 503, 504].includes(status)
}

function hasSettledPaymentArtifact(
  body: unknown,
  paymentResult?: x402PaymentResult | null
) {
  if (paymentResult?.kind === 'success') {
    return true
  }

  if (!body || typeof body !== 'object') {
    return false
  }

  const record = body as Record<string, unknown>

  return Boolean(record.receipt || record.x402)
}

function shouldRetryTransientError(error: unknown) {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase()

  if (
    /user rejected|user denied|rejected by user|denied transaction|4001/.test(
      message
    )
  ) {
    return false
  }

  if (
    /insufficient|invalid request|bad request|unauthorized|forbidden|not found|not available|missing|already used with a different request/.test(
      message
    )
  ) {
    return false
  }

  return /500|502|503|504|408|429|timeout|timed out|network|failed to fetch|gateway|rate limit|temporar|internal|socket|connection|rpc/.test(
    message
  )
}

async function requestPaymentRequirement(order: MarketplaceOrder) {
  const response = await fetch(`/api/x402/products/${order.productSlug}/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-App-Order-Id': order.id
    },
    body: order.requestPayloadJson ?? '{}'
  })

  const body = await readResponseBody(response)

  if (response.status !== 402) {
    if (!response.ok) {
      throw new Error(
        buildPaidRequestError(
          response,
          isPaidApiErrorBody(body) ? body : {},
          null
        )
      )
    }

    return null
  }

  const paymentRequired = decodePaymentRequiredHeader(response)

  if (!paymentRequired) {
    throw new Error('the gateway did not return a readable x402 requirement.')
  }

  return {
    status: response.status,
    statusText: response.statusText,
    paymentRequired,
    body
  }
}

async function requestClaimPaymentRequirement(order: MarketplaceOrder) {
  const response = await fetch(`/api/x402/orders/${order.id}/claim`, {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    }
  })
  const body = await readResponseBody(response)

  if (response.status !== 402) {
    if (!response.ok) {
      throw new Error(
        buildPaidRequestError(
          response,
          isPaidApiErrorBody(body) ? body : {},
          null
        )
      )
    }

    return null
  }

  const paymentRequired = decodePaymentRequiredHeader(response)

  if (!paymentRequired) {
    throw new Error(
      'the gateway did not return a readable x402 delta payment requirement.'
    )
  }

  return {
    status: response.status,
    statusText: response.statusText,
    paymentRequired,
    body
  }
}

async function ensurePermit2Allowance(
  paymentRequired: PaymentRequired,
  walletControls: BrowserWalletControls,
  onStatus: (message: string) => void,
  onStep: (id: WalletStepId, update: Partial<WalletStep>) => void
) {
  onStep('allowance', {
    status: 'active',
    detail: `Checking ${paymentTokenSymbol} balance and payment readiness.`
  })
  const requirement = getConfiguredPaymentRequirement(paymentRequired)

  if (!requirement) {
    const mismatchedRequirement =
      getMismatchedPaymentRequirement(paymentRequired)

    if (mismatchedRequirement) {
      throw new Error(
        `The x402 quote is for token ${mismatchedRequirement.asset} on ${
          mismatchedRequirement.network
        }, but this app is configured for ${paymentTokenSymbol} ${paymentTokenAddress} on ${x402Network}. Refresh the page and create a new order so the quote uses the current payment token.`
      )
    }

    onStep('allowance', {
      status: 'complete',
      detail: `No ${paymentTokenSymbol} readiness check is needed for this payment requirement.`
    })
    return
  }

  const tokenAddress = requirement.asset

  if (!isHexAddress(tokenAddress)) {
    throw new Error(
      `The x402 payment requirement did not include a valid ${paymentTokenSymbol} token address.`
    )
  }

  const requiredAmount = BigInt(requirement.amount)

  if (requiredAmount <= 0n) {
    onStep('allowance', {
      status: 'complete',
      detail: `No ${paymentTokenSymbol} allowance is needed for a zero-amount request.`
    })
    return
  }

  onStatus(
    `Checking ${paymentTokenSymbol} balance on ${defaultAppChain.shortName}.`
  )

  const usesPermit2 = isPermit2PaymentRequirement(requirement)

  const [balance, allowance, tokenDecimals] = await withTransientRetries(
    () =>
      Promise.all([
        paymentChainPublicClient.readContract({
          address: tokenAddress,
          abi: usdtBalanceAbi,
          functionName: 'balanceOf',
          args: [walletControls.signer.address]
        }),
        usesPermit2
          ? paymentChainPublicClient.readContract(
              getPermit2AllowanceReadParams({
                tokenAddress,
                ownerAddress: walletControls.signer.address
              })
            )
          : Promise.resolve(requiredAmount),
        paymentChainPublicClient.readContract({
          address: tokenAddress,
          abi: usdtBalanceAbi,
          functionName: 'decimals'
        })
      ]),
    {
      onRetry: ({ nextAttempt, maxAttempts }) =>
        onStatus(
          `Temporary allowance lookup error. Retrying ${nextAttempt} of ${maxAttempts}.`
        )
    }
  )

  if (balance < requiredAmount) {
    throw new Error(
      `Insufficient ${paymentTokenSymbol} balance. This API call needs ${formatPaymentTokenAmount(
        requiredAmount,
        tokenDecimals
      )} ${paymentTokenSymbol}, but the connected wallet has ${formatPaymentTokenAmount(
        balance,
        tokenDecimals
      )} ${paymentTokenSymbol} on ${defaultAppChain.shortName}. Token: ${tokenAddress}.`
    )
  }

  if (!usesPermit2) {
    onStep('allowance', {
      status: 'complete',
      detail: `${paymentTokenSymbol} balance is sufficient. This token uses ${paymentTokenTransferMethod} signatures, so no Permit2 approval is needed.`
    })
    return
  }

  if (allowance >= requiredAmount) {
    onStep('allowance', {
      status: 'complete',
      detail: `${paymentTokenSymbol} Permit2 allowance is already sufficient.`
    })
    return
  }

  onStatus(
    `Approve the one-time ${paymentTokenSymbol} Permit2 allowance in your wallet, then the gateway will continue the paid API run.`
  )

  const approvalTransaction = createPermit2ApprovalTx(tokenAddress)
  const transactionHash = await withTransientRetries(
    () => walletControls.sendTransaction(approvalTransaction),
    {
      onRetry: ({ nextAttempt, maxAttempts }) =>
        onStatus(
          `Temporary approval submission error. Retrying ${nextAttempt} of ${maxAttempts}.`
        )
    }
  )

  onStep('allowance', {
    status: 'active',
    detail: `${paymentTokenSymbol} approval transaction submitted.`,
    txHash: transactionHash
  })
  onStatus(
    `Waiting for ${paymentTokenSymbol} Permit2 approval to confirm: ${transactionHash}`
  )

  const receipt = await withTransientRetries(
    () =>
      paymentChainPublicClient.waitForTransactionReceipt({
        hash: transactionHash
      }),
    {
      onRetry: ({ nextAttempt, maxAttempts }) =>
        onStatus(
          `Temporary approval confirmation error. Retrying ${nextAttempt} of ${maxAttempts}.`
        )
    }
  )

  if (receipt.status !== 'success') {
    throw new Error(
      `${paymentTokenSymbol} Permit2 approval transaction did not succeed.`
    )
  }

  onStep('allowance', {
    status: 'active',
    detail: `Waiting for ${paymentTokenSymbol} allowance to update.`,
    txHash: transactionHash
  })
  onStatus(
    `Confirming the new ${paymentTokenSymbol} Permit2 allowance is readable.`
  )

  await waitForPermit2Allowance({
    tokenAddress,
    ownerAddress: walletControls.signer.address,
    requiredAmount
  })

  onStep('allowance', {
    status: 'complete',
    detail: `${paymentTokenSymbol} Permit2 approval confirmed on-chain.`,
    txHash: transactionHash
  })
}

async function waitForPermit2Allowance({
  tokenAddress,
  ownerAddress,
  requiredAmount
}: {
  tokenAddress: `0x${string}`
  ownerAddress: `0x${string}`
  requiredAmount: bigint
}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const allowance = await paymentChainPublicClient.readContract(
      getPermit2AllowanceReadParams({
        tokenAddress,
        ownerAddress
      })
    )

    if (allowance >= requiredAmount) {
      return
    }

    await sleep(1500)
  }

  throw new Error(
    `${paymentTokenSymbol} Permit2 approval was submitted, but the updated allowance is not readable yet. Wait a moment, then run with wallet again.`
  )
}

type PaymentRequirement = PaymentRequired['accepts'][number]

function getPreferredPaymentRequirement(paymentRequired: PaymentRequired) {
  return (
    paymentRequired.accepts.find(isConfiguredPaymentRequirement) ??
    paymentRequired.accepts[0]
  )
}

function getConfiguredPaymentRequirement(paymentRequired: PaymentRequired) {
  return paymentRequired.accepts.find(isConfiguredPaymentRequirement)
}

function getMismatchedPaymentRequirement(paymentRequired: PaymentRequired) {
  return paymentRequired.accepts.find(
    requirement => !isConfiguredPaymentRequirement(requirement)
  )
}

function isPermit2PaymentRequirement(requirement: PaymentRequirement) {
  return requirement.extra?.assetTransferMethod === 'permit2'
}

function isConfiguredPaymentRequirement(requirement: PaymentRequirement) {
  return (
    requirement.network === x402Network &&
    requirement.asset.toLowerCase() === paymentTokenAddress.toLowerCase()
  )
}

function getRequirementTokenDecimals(requirement: PaymentRequirement) {
  const extraDecimals = Number(requirement.extra?.decimals)

  return Number.isInteger(extraDecimals) && extraDecimals >= 0
    ? extraDecimals
    : paymentTokenDecimals
}

function getRequirementTokenSymbol(requirement: PaymentRequirement) {
  const extraSymbol = requirement.extra?.symbol

  return typeof extraSymbol === 'string' && extraSymbol.length > 0
    ? extraSymbol
    : paymentTokenSymbol
}

function stringifyPayloadPath(data: unknown, path: string) {
  const value = path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined
    }

    return (current as Record<string, unknown>)[segment]
  }, data)

  return value === undefined || value === null ? undefined : String(value)
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isHexTransactionHash(
  value: string | null | undefined
): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value ?? '')
}

function getTransactionHashFromExplorerUrl(value: string | null | undefined) {
  const match = value?.match(/0x[a-fA-F0-9]{64}/)

  return match?.[0] ?? ''
}

function shortenHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`
}

function formatPaymentTokenAmount(
  amount: bigint,
  decimals = paymentTokenDecimals
) {
  return Number(formatUnits(amount, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6
  })
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? ''

  if (
    contentType.includes('application/json') ||
    contentType.includes('+json')
  ) {
    return response.json()
  }

  const text = await response.text()

  return {
    error:
      response.status === 402
        ? `${paymentTokenSymbol} payment required.`
        : 'The server returned a non-JSON response.',
    contentType,
    bodyPreview: text.slice(0, 300)
  }
}

function decodePaymentRequiredHeader(
  response: Response
): PaymentRequired | null {
  const encoded =
    response.headers.get('payment-required') ??
    response.headers.get('PAYMENT-REQUIRED')

  if (!encoded) {
    return null
  }

  try {
    return decodeX402PaymentRequiredHeader(encoded)
  } catch {
    // Some non-standard implementations may send raw JSON instead of base64.
  }

  try {
    return JSON.parse(encoded) as PaymentRequired
  } catch {
    return null
  }
}
