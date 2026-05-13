import { x402Facilitator } from '@x402/core/facilitator'
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type HTTPRequestContext,
  type RouteConfig,
  x402HTTPResourceServer,
  x402ResourceServer
} from '@x402/core/server'
import type { Network } from '@x402/core/types'
import type { FacilitatorEvmSigner } from '@x402/evm'
import { registerExactEvmScheme as registerExactEvmFacilitatorScheme } from '@x402/evm/exact/facilitator'
import { registerExactEvmScheme as registerExactEvmResourceScheme } from '@x402/evm/exact/server'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import { getMarketplaceOrderById } from '@/features/marketplace/orders'
import { resolveProductPrice } from '@/features/marketplace/pricing'
import { getProductBySlug } from '@/features/marketplace/products'
import {
  defaultAppChain,
  defaultX402FacilitatorUrl,
  paymentTokenSymbol,
  toPaymentAssetAmount,
  x402Network
} from '@/lib/config/chains'
import { getAppOrderIdHeader } from '@/lib/config/headers'
import { siteConfig } from '@/lib/config/site'
import { getApiPaymentPayTo } from '@/lib/contracts/api-payment-escrow'
import {
  extractEip7623FloorGasFromError,
  getBufferedContractWriteGasLimit
} from '@/lib/contracts/gas'
import { envServer } from '@/lib/env/env.server'

const paidCallPattern = '/api/x402/products/:slug/call'
const claimPattern = '/api/x402/orders/:orderId/claim'
const x402MaxTimeoutSeconds = 60
const facilitatorTransactionMaxAttempts = 3
const facilitatorTransactionBaseRetryDelayMs = 750
let serverPromise: Promise<x402HTTPResourceServer> | null = null

function getProductSlugFromPath(path: string) {
  const match = path.match(/^\/api\/x402\/products\/([^/]+)\/call$/)

  return match?.[1]
}

function getOrderIdFromClaimPath(path: string) {
  const match = path.match(/^\/api\/x402\/orders\/([^/]+)\/claim$/)

  return match?.[1]
}

async function requireProductFromContext(context: HTTPRequestContext) {
  const slug = getProductSlugFromPath(context.path)
  const product = slug ? await getProductBySlug(slug) : undefined

  if (!product || !(await canPriceProductFromContext(product, context))) {
    throw new Error('Published API product was not found.')
  }

  return product
}

async function canPriceProductFromContext(
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>,
  context: HTTPRequestContext
) {
  if (product.status === 'published') {
    return true
  }

  if (product.status !== 'draft') {
    return false
  }

  const orderId = getAppOrderIdHeader(name => context.adapter.getHeader?.(name))
  const order = orderId ? await getMarketplaceOrderById(orderId) : undefined

  if (!order || order.productSlug !== product.slug) {
    return false
  }

  if (order.isProviderTest) {
    return true
  }

  if (!product.ownerWallet) {
    return true
  }

  return order.buyerWallet.toLowerCase() === product.ownerWallet.toLowerCase()
}

const paidCallRoute: RouteConfig = {
  accepts: {
    scheme: 'exact',
    network: x402Network as Network,
    payTo: async context =>
      getApiPaymentPayTo(await requireProductFromContext(context)),
    price: async context => {
      const product = await requireProductFromContext(context)
      const resolvedPrice = await resolveProductPrice({
        product,
        requestPayload: getRequestPayload(context)
      })

      return toPaymentAssetAmount(resolvedPrice.amountUsd)
    },
    maxTimeoutSeconds: x402MaxTimeoutSeconds
  },
  description: `${paymentTokenSymbol}-settled ${siteConfig.name} API call on the configured app chain through the x402 protocol.`,
  mimeType: 'application/json',
  unpaidResponseBody: async context => {
    const product = await requireProductFromContext(context)
    const requestPayload = getRequestPayload(context)

    const resolvedPrice = await resolveProductPrice({
      product,
      requestPayload
    }).catch(error => ({
      amountUsd: product.priceUsd,
      amountLabel: product.priceLabel,
      model: product.pricing.model,
      source: 'fixed' as const,
      quoteError: error instanceof Error ? error.message : 'Quote failed.'
    }))

    return {
      contentType: 'application/json',
      body: {
        error: `${paymentTokenSymbol} payment required.`,
        product: {
          slug: product.slug,
          name: product.name,
          providerName: product.providerName,
          priceLabel: resolvedPrice.amountLabel,
          endpointPath: product.endpointPath
        },
        pricing: resolvedPrice,
        payment: {
          network: x402Network,
          scheme: 'exact',
          facilitator: getPaymentFacilitatorLabel()
        }
      }
    }
  },
  settlementFailedResponseBody: (_context, settleResult) => ({
    contentType: 'application/json',
    body: {
      error: `${paymentTokenSymbol} payment settlement failed.`,
      reason: settleResult.errorReason,
      message: settleResult.errorMessage
    }
  })
}

const claimRoute: RouteConfig = {
  accepts: {
    scheme: 'exact',
    network: x402Network as Network,
    payTo: async context => {
      const order = await requireClaimOrderFromContext(context)
      const product = await getProductBySlug(order.productSlug)

      if (!product) {
        throw new Error('Claim product was not found.')
      }

      return product.providerWallet
    },
    price: async context => {
      const order = await requireClaimOrderFromContext(context)
      const amount = parseUsdtAmount(order.deltaAmountUsdt)

      if (amount <= 0) {
        throw new Error('Order does not have a payable metered delta.')
      }

      return toPaymentAssetAmount(amount)
    },
    maxTimeoutSeconds: x402MaxTimeoutSeconds
  },
  description: `${paymentTokenSymbol}-settled result claim for credit-metered API usage that exceeded the prepaid quote.`,
  mimeType: 'application/json',
  unpaidResponseBody: async context => {
    const order = await requireClaimOrderFromContext(context)

    return {
      contentType: 'application/json',
      body: {
        error: `${paymentTokenSymbol} delta payment required.`,
        order: {
          id: order.id,
          productSlug: order.productSlug,
          productName: order.productName,
          deltaAmountUsdt: order.deltaAmountUsdt,
          resultReleaseStatus: order.resultReleaseStatus
        },
        payment: {
          network: x402Network,
          scheme: 'exact',
          facilitator: getPaymentFacilitatorLabel()
        }
      }
    }
  },
  settlementFailedResponseBody: (_context, settleResult) => ({
    contentType: 'application/json',
    body: {
      error: `${paymentTokenSymbol} delta settlement failed.`,
      reason: settleResult.errorReason,
      message: settleResult.errorMessage
    }
  })
}

async function requireClaimOrderFromContext(context: HTTPRequestContext) {
  const orderId = getOrderIdFromClaimPath(context.path)
  const order = orderId ? await getMarketplaceOrderById(orderId) : undefined

  if (
    !order ||
    order.status !== 'delta_payment_required' ||
    order.resultReleaseStatus !== 'delta_payment_required'
  ) {
    throw new Error('Order does not require a result claim payment.')
  }

  return order
}

function getRequestPayload(context: HTTPRequestContext) {
  return context.adapter.getBody?.() ?? context.adapter.getQueryParams?.() ?? {}
}

export async function getPaymentX402Server() {
  if (!serverPromise) {
    serverPromise = (async () => {
      const facilitator = createPaymentFacilitator()
      const resourceServer = new x402ResourceServer(facilitator)

      registerExactEvmResourceScheme(resourceServer, {
        networks: [x402Network as Network]
      })

      const httpServer = new x402HTTPResourceServer(resourceServer, {
        [`GET ${paidCallPattern}`]: paidCallRoute,
        [`POST ${paidCallPattern}`]: paidCallRoute,
        [`POST ${claimPattern}`]: claimRoute
      })

      await httpServer.initialize()

      return httpServer
    })()
  }

  return serverPromise
}

function createPaymentFacilitator(): FacilitatorClient {
  const privateKey = getLocalFacilitatorPrivateKey()

  if (!privateKey) {
    return new HTTPFacilitatorClient({
      url: envServer.X402_FACILITATOR_URL ?? defaultX402FacilitatorUrl
    })
  }

  const facilitator = new x402Facilitator()

  registerExactEvmFacilitatorScheme(facilitator, {
    networks: [x402Network as Network],
    signer: buildLocalFacilitatorSigner(privateKey)
  })

  return {
    getSupported: () =>
      Promise.resolve(
        facilitator.getSupported() as unknown as Awaited<
          ReturnType<FacilitatorClient['getSupported']>
        >
      ),
    verify: (paymentPayload, paymentRequirements) =>
      facilitator.verify(paymentPayload, paymentRequirements),
    settle: (paymentPayload, paymentRequirements) =>
      facilitator.settle(paymentPayload, paymentRequirements)
  }
}

function getLocalFacilitatorPrivateKey() {
  const privateKey =
    envServer.AGENT_SPENDER_PRIVATE_KEY ??
    envServer.API_ESCROW_OPERATOR_PRIVATE_KEY ??
    envServer.AGENT_RUN_VAULT_OPERATOR_PRIVATE_KEY

  if (!privateKey) {
    return null
  }

  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
}

function getPaymentFacilitatorLabel() {
  return getLocalFacilitatorPrivateKey()
    ? 'local floor-safe facilitator'
    : (envServer.X402_FACILITATOR_URL ?? defaultX402FacilitatorUrl)
}

function buildLocalFacilitatorSigner(privateKey: string): FacilitatorEvmSigner {
  const account = privateKeyToAccount(privateKey as Hex)
  const publicClient = createPublicClient({
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })
  const walletClient = createWalletClient({
    account,
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })

  async function sendFloorSafeTransaction({
    to,
    data,
    estimatedGas
  }: {
    to: Address
    data: Hex
    estimatedGas?: bigint
  }) {
    let retryMinimumGas: bigint | undefined

    for (
      let attempt = 1;
      attempt <= facilitatorTransactionMaxAttempts;
      attempt += 1
    ) {
      let txHash: Hex | null = null
      const gas = getBufferedContractWriteGasLimit({
        data,
        estimatedGas,
        minimumGas: retryMinimumGas
      })

      try {
        txHash = await walletClient.sendTransaction({
          account,
          chain: defaultAppChain.viemChain,
          to,
          data,
          gas
        })

        return txHash
      } catch (error) {
        const message = describeFacilitatorTransactionError(error)
        retryMinimumGas =
          extractEip7623FloorGasFromError(error) ?? retryMinimumGas
        const shouldRetry =
          !txHash &&
          attempt < facilitatorTransactionMaxAttempts &&
          isRetryableFacilitatorTransactionError(message)

        if (!shouldRetry) {
          throw new Error(message)
        }

        await wait(getFacilitatorRetryDelayMs(attempt))
      }
    }

    throw new Error(
      `x402 facilitator transaction failed after ${facilitatorTransactionMaxAttempts} attempts.`
    )
  }

  return {
    getAddresses: () => [account.address],
    readContract: args => publicClient.readContract(args),
    verifyTypedData: args =>
      publicClient.verifyTypedData(
        args as Parameters<typeof publicClient.verifyTypedData>[0]
      ),
    writeContract: async args => {
      const data = encodeFunctionData({
        abi: args.abi,
        functionName: args.functionName,
        args: args.args
      })

      return sendFloorSafeTransaction({
        to: args.address,
        data,
        estimatedGas: args.gas
      })
    },
    sendTransaction: args =>
      sendFloorSafeTransaction({
        to: args.to,
        data: args.data
      }),
    waitForTransactionReceipt: args =>
      publicClient.waitForTransactionReceipt(args),
    getCode: args => publicClient.getCode(args)
  }
}

function isRetryableFacilitatorTransactionError(message: string) {
  const lower = message.toLowerCase()

  if (
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
    lower.includes('out of gas') ||
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

function getFacilitatorRetryDelayMs(attempt: number) {
  return facilitatorTransactionBaseRetryDelayMs * 2 ** (attempt - 1)
}

function describeFacilitatorTransactionError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return typeof error === 'string'
    ? error
    : 'x402 facilitator transaction failed.'
}

function wait(delayMs: number) {
  return new Promise<void>(resolve => setTimeout(resolve, delayMs))
}

function parseUsdtAmount(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

export function getPaymentPaywallConfig(currentUrl: string) {
  return {
    appName: siteConfig.name,
    currentUrl,
    testnet: true
  }
}
