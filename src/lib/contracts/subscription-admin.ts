import 'server-only'

import { Address, createPublicClient, formatUnits, http, isAddress } from 'viem'

import {
  getExplorerAddressUrl,
  getSubscriptionChain
} from '@/lib/config/chains'
import {
  formatNativeAmount,
  getSubscriptionManagerAddress,
  subscriptionManagerAbi,
  subscriptionPlans
} from '@/lib/contracts/subscription'

export type AdminSubscriptionQuery = {
  page?: string
  pageSize?: string
}

export type AdminSubscriptionRecord = {
  walletAddress: Address
  planKey: number
  planName: string
  paidUntil: string | null
  active: boolean
  autoRenew: boolean
  canceledAt: string | null
  walletExplorerUrl: string
}

export type AdminSubscriptionSnapshot = {
  contractAddress: Address | null
  contractExplorerUrl: string | null
  contractConfigured: boolean
  chainId: number
  chainName: string
  explorerName: string
  nativeTokenSymbol: string
  contractBalanceWei: bigint
  contractBalanceLabel: string
  basePriceWei: bigint | null
  plusPriceWei: bigint | null
  basePriceLabel: string
  plusPriceLabel: string
  subscriberCount: number
  subscribers: AdminSubscriptionRecord[]
  page: number
  pageSize: number
  pageCount: number
  supportsSubscriberRegistry: boolean
  supportsTreasuryWithdraw: boolean
  readError: string | null
}

const subscriptionChain = getSubscriptionChain()
const publicClient = createPublicClient({
  chain: subscriptionChain.viemChain,
  transport: http()
})

const defaultPageSize = 10

export async function getAdminSubscriptionSnapshot(
  query: AdminSubscriptionQuery
): Promise<AdminSubscriptionSnapshot> {
  const configuredAddress = getSubscriptionManagerAddress()
  const contractAddress =
    configuredAddress && isAddress(configuredAddress) ? configuredAddress : null
  const pageSize = Math.min(
    clampPositiveInt(query.pageSize, defaultPageSize),
    50
  )
  const requestedPage = clampPositiveInt(query.page, 1)

  if (!contractAddress) {
    return {
      contractAddress,
      contractExplorerUrl: null,
      contractConfigured: false,
      chainId: subscriptionChain.id,
      chainName: subscriptionChain.shortName,
      explorerName: subscriptionChain.explorer.name,
      nativeTokenSymbol: subscriptionChain.nativeCurrency.symbol,
      contractBalanceWei: 0n,
      contractBalanceLabel: formatNativeAmount(0n),
      basePriceWei: null,
      plusPriceWei: null,
      basePriceLabel: 'Unavailable',
      plusPriceLabel: 'Unavailable',
      subscriberCount: 0,
      subscribers: [],
      page: 1,
      pageSize,
      pageCount: 1,
      supportsSubscriberRegistry: false,
      supportsTreasuryWithdraw: false,
      readError: 'Configure NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS first.'
    }
  }

  const [
    contractBalanceWei,
    basePriceWei,
    plusPriceWei,
    subscriberCountResult
  ] = await Promise.all([
    readOrDefault(
      () => publicClient.getBalance({ address: contractAddress }),
      0n
    ),
    readOrNull(() => readPlanPrice(contractAddress, 1)),
    readOrNull(() => readPlanPrice(contractAddress, 2)),
    readOrNull(() =>
      publicClient.readContract({
        address: contractAddress,
        abi: subscriptionManagerAbi,
        functionName: 'subscriberCount'
      })
    )
  ])

  const supportsSubscriberRegistry = subscriberCountResult !== null
  const subscriberCount = supportsSubscriberRegistry
    ? Number(subscriberCountResult)
    : 0
  const pageCount = Math.max(Math.ceil(subscriberCount / pageSize), 1)
  const page = Math.min(requestedPage, pageCount)
  const offset = (page - 1) * pageSize
  const subscriberWallets = supportsSubscriberRegistry
    ? await readSubscriberPage(contractAddress, offset, pageSize)
    : []
  const subscribers = await readSubscriptionRows(
    contractAddress,
    subscriberWallets
  )

  return {
    contractAddress,
    contractExplorerUrl: getExplorerAddressUrl(contractAddress),
    contractConfigured: true,
    chainId: subscriptionChain.id,
    chainName: subscriptionChain.shortName,
    explorerName: subscriptionChain.explorer.name,
    nativeTokenSymbol: subscriptionChain.nativeCurrency.symbol,
    contractBalanceWei,
    contractBalanceLabel: formatNativeAmount(contractBalanceWei),
    basePriceWei,
    plusPriceWei,
    basePriceLabel: basePriceWei
      ? formatNativeAmount(basePriceWei)
      : 'Unreadable',
    plusPriceLabel: plusPriceWei
      ? formatNativeAmount(plusPriceWei)
      : 'Unreadable',
    subscriberCount,
    subscribers,
    page,
    pageSize,
    pageCount,
    supportsSubscriberRegistry,
    supportsTreasuryWithdraw: supportsSubscriberRegistry,
    readError: supportsSubscriberRegistry
      ? null
      : 'The configured contract does not expose the admin subscriber registry. Deploy the current SubscriptionManager before using withdrawals or subscriber pagination.'
  }
}

export function formatNativePriceInput(value: bigint | null) {
  return value === null ? '' : formatUnits(value, 18)
}

async function readPlanPrice(contractAddress: Address, planKey: 1 | 2) {
  return publicClient.readContract({
    address: contractAddress,
    abi: subscriptionManagerAbi,
    functionName: 'planPriceWei',
    args: [planKey]
  })
}

async function readSubscriberPage(
  contractAddress: Address,
  offset: number,
  pageSize: number
) {
  const pageResult = await readOrNull(() =>
    publicClient.readContract({
      address: contractAddress,
      abi: subscriptionManagerAbi,
      functionName: 'subscribers',
      args: [BigInt(offset), BigInt(pageSize)]
    })
  )

  if (pageResult) {
    return Array.from(pageResult[0])
  }

  const wallets = await Promise.all(
    Array.from({ length: pageSize }, (_, index) =>
      readOrNull(() =>
        publicClient.readContract({
          address: contractAddress,
          abi: subscriptionManagerAbi,
          functionName: 'subscriberAt',
          args: [BigInt(offset + index)]
        })
      )
    )
  )

  return wallets.filter((wallet): wallet is Address => wallet !== null)
}

async function readSubscriptionRows(
  contractAddress: Address,
  wallets: Address[]
) {
  const rows = await Promise.all(
    wallets.map(async walletAddress => {
      const result = await readOrNull(() =>
        publicClient.readContract({
          address: contractAddress,
          abi: subscriptionManagerAbi,
          functionName: 'subscriptionOf',
          args: [walletAddress]
        })
      )

      if (!result) {
        return null
      }

      const planKey = Number(result[0])
      const paidUntil = result[1] > 0n ? Number(result[1]) * 1000 : null
      const canceledAt = result[4] > 0n ? Number(result[4]) * 1000 : null

      const row: AdminSubscriptionRecord = {
        walletAddress,
        planKey,
        planName:
          subscriptionPlans.find(plan => plan.planKey === planKey)?.name ??
          `Plan ${planKey}`,
        paidUntil: paidUntil ? new Date(paidUntil).toISOString() : null,
        active: result[2],
        autoRenew: result[3],
        canceledAt: canceledAt ? new Date(canceledAt).toISOString() : null,
        walletExplorerUrl: getExplorerAddressUrl(walletAddress) ?? '#'
      }

      return row
    })
  )

  return rows.filter((row): row is AdminSubscriptionRecord => row !== null)
}

async function readOrNull<T>(reader: () => Promise<T>) {
  try {
    return await reader()
  } catch {
    return null
  }
}

async function readOrDefault<T>(reader: () => Promise<T>, fallback: T) {
  try {
    return await reader()
  } catch {
    return fallback
  }
}

function clampPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}
