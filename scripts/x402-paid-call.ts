import {
  createPermit2ApprovalTx,
  getPermit2AllowanceReadParams
} from '@x402/evm'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch'
import { config } from 'dotenv'
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

import {
  defaultAppChain,
  paymentTokenAddress,
  paymentTokenDecimals,
  paymentTokenTransferMethod
} from '../src/lib/config/chains'

config({ path: '.env.local' })
config()

type ParsedArgs = {
  slug: string
  payload?: string
  url?: string
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const slug = args.find(arg => !arg.startsWith('--'))
  const payloadIndex = args.indexOf('--payload')
  const urlIndex = args.indexOf('--url')

  if (!slug) {
    throw new Error(
      'Usage: pnpm x402:call <published-product-slug> --payload \'{"key":"value"}\''
    )
  }

  return {
    slug,
    payload: payloadIndex >= 0 ? args[payloadIndex + 1] : undefined,
    url: urlIndex >= 0 ? args[urlIndex + 1] : undefined
  }
}

function getPrivateKey() {
  const privateKey =
    process.env.EVM_PRIVATE_KEY ?? process.env.AGENT_SPENDER_PRIVATE_KEY

  if (!privateKey) {
    throw new Error(
      'Set EVM_PRIVATE_KEY or AGENT_SPENDER_PRIVATE_KEY in your shell or .env.local.'
    )
  }

  return privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
}

const publicClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})
const usdtBalanceAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)'
])

async function ensurePaymentTokenReady(amountUsd: number) {
  const account = privateKeyToAccount(getPrivateKey() as Hex)
  const requiredAmount = parseUnits(
    amountUsd.toFixed(Math.min(paymentTokenDecimals, 6)),
    paymentTokenDecimals
  )

  if (requiredAmount <= 0n) {
    return
  }

  const tokenAddress = paymentTokenAddress as Address
  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: usdtBalanceAbi,
    functionName: 'balanceOf',
    args: [account.address]
  })

  if (balance < requiredAmount) {
    throw new Error(
      `Signer has insufficient USDT. Required ${formatUsdtAmount(
        requiredAmount
      )}, available ${formatUsdtAmount(balance)}.`
    )
  }

  if (paymentTokenTransferMethod !== 'permit2') {
    return
  }

  const allowance = await publicClient.readContract(
    getPermit2AllowanceReadParams({
      tokenAddress,
      ownerAddress: account.address
    })
  )

  if (allowance >= requiredAmount) {
    return
  }

  console.log('Submitting USDT Permit2 approval for this signer...')

  const walletClient = createWalletClient({
    account,
    chain: defaultAppChain.viemChain,
    transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
  })
  const approval = createPermit2ApprovalTx(tokenAddress)
  const txHash = await walletClient.sendTransaction({
    account,
    chain: defaultAppChain.viemChain,
    to: approval.to,
    data: approval.data
  })
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  if (receipt.status !== 'success') {
    throw new Error(`USDT Permit2 approval failed: ${txHash}`)
  }

  await waitForPermit2Allowance({
    tokenAddress,
    ownerAddress: account.address,
    requiredAmount
  })
}

async function waitForPermit2Allowance({
  tokenAddress,
  ownerAddress,
  requiredAmount
}: {
  tokenAddress: Address
  ownerAddress: Address
  requiredAmount: bigint
}) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const allowance = await publicClient.readContract(
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
    'USDT Permit2 approval was submitted, but the updated allowance is not readable yet. Retry the paid call in a moment.'
  )
}

function formatUsdtAmount(amount: bigint) {
  return `${Number(formatUnits(amount, paymentTokenDecimals)).toLocaleString(
    undefined,
    {
      maximumFractionDigits: 6
    }
  )} USDT`
}

async function main() {
  const { slug, payload, url } = parseArgs()
  const product = url ? null : await loadProductBySlug(slug)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const endpointUrl =
    url ??
    new URL(
      product?.endpointPath ?? `/api/x402/products/${slug}/call`,
      appUrl
    ).toString()
  const requestPayload = payload
    ? (JSON.parse(payload) as unknown)
    : (product?.referencePayload ?? {})
  const method = product?.method ?? 'POST'
  const requestUrl = new URL(endpointUrl)

  if (method === 'GET') {
    for (const [key, value] of Object.entries(asRecord(requestPayload))) {
      if (value !== undefined && value !== null) {
        requestUrl.searchParams.set(key, String(value))
      }
    }
  }

  const signer = privateKeyToAccount(getPrivateKey() as `0x${string}`)
  const estimatedPrice = product?.priceUsd ?? 0

  if (estimatedPrice > 0) {
    await ensurePaymentTokenReady(estimatedPrice)
  }

  const client = new x402Client()

  registerExactEvmScheme(client, { signer })

  const httpClient = new x402HTTPClient(client)
  const paidFetch = wrapFetchWithPayment(fetch, httpClient)
  const response = await paidFetch(requestUrl, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: method === 'POST' ? JSON.stringify(requestPayload) : undefined
  })
  const body = await response.json().catch(() => null)
  const paymentResponse = response.ok
    ? httpClient.getPaymentSettleResponse(name => response.headers.get(name))
    : null

  console.log(
    JSON.stringify(
      {
        status: response.status,
        ok: response.ok,
        endpointUrl: requestUrl.toString(),
        body,
        payment: paymentResponse
      },
      null,
      2
    )
  )

  if (!response.ok) {
    process.exit(1)
  }
}

async function loadProductBySlug(slug: string) {
  const { getProductBySlug } = await import(
    '../src/features/marketplace/products'
  )

  return await getProductBySlug(slug)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
