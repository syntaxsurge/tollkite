'use client'

import * as React from 'react'

import { createPublicClient, formatUnits, http, parseAbi } from 'viem'

import {
  defaultAppChain,
  getExplorerAddressUrl,
  paymentTokenAddress,
  paymentTokenDecimals,
  paymentTokenLabel,
  paymentTokenSymbol
} from '@/lib/config/chains'

const stablecoinAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
])

const walletBalanceClient = createPublicClient({
  chain: defaultAppChain.viemChain,
  transport: http(defaultAppChain.viemChain.rpcUrls.default.http[0])
})

export type WalletAssetBalance = {
  label: string
  symbol: string
  formattedBalance: string
  rawBalance: bigint | null
  decimals: number
  explorerUrl: string | null
  error: string
}

export type WalletBalancesState = {
  native: WalletAssetBalance
  stablecoin: WalletAssetBalance
  chainName: string
  isLoading: boolean
  refresh: () => Promise<void>
}

export function useWalletBalances(
  walletAddress: string | null | undefined
): WalletBalancesState {
  const normalizedWallet = walletAddress?.trim() || null
  const [nativeBalance, setNativeBalance] = React.useState<bigint | null>(null)
  const [stablecoinBalance, setStablecoinBalance] = React.useState<
    bigint | null
  >(null)
  const [stablecoinDecimals, setStablecoinDecimals] =
    React.useState(paymentTokenDecimals)
  const [nativeError, setNativeError] = React.useState('')
  const [stablecoinError, setStablecoinError] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(Boolean(normalizedWallet))

  const refresh = React.useCallback(async () => {
    if (!normalizedWallet || !isHexAddress(normalizedWallet)) {
      setNativeBalance(null)
      setStablecoinBalance(null)
      setStablecoinDecimals(paymentTokenDecimals)
      setNativeError('')
      setStablecoinError('')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setNativeError('')
    setStablecoinError('')

    const [nativeResult, stablecoinResult] = await Promise.allSettled([
      walletBalanceClient.getBalance({
        address: normalizedWallet
      }),
      readStablecoinBalance(normalizedWallet)
    ])

    if (nativeResult.status === 'fulfilled') {
      setNativeBalance(nativeResult.value)
    } else {
      setNativeBalance(null)
      setNativeError('Could not load the network token balance.')
    }

    if (stablecoinResult.status === 'fulfilled') {
      setStablecoinBalance(stablecoinResult.value.balance)
      setStablecoinDecimals(stablecoinResult.value.decimals)
    } else {
      setStablecoinBalance(null)
      setStablecoinDecimals(paymentTokenDecimals)
      setStablecoinError('Could not load the stablecoin balance.')
    }

    setIsLoading(false)
  }, [normalizedWallet])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    native: {
      label: 'Network token',
      symbol: defaultAppChain.nativeCurrency.symbol,
      formattedBalance:
        nativeBalance === null
          ? '0'
          : formatTokenAmount(
              nativeBalance,
              defaultAppChain.nativeCurrency.decimals
            ),
      rawBalance: nativeBalance,
      decimals: defaultAppChain.nativeCurrency.decimals,
      explorerUrl: null,
      error: nativeError
    },
    stablecoin: {
      label: paymentTokenLabel,
      symbol: paymentTokenSymbol,
      formattedBalance:
        stablecoinBalance === null
          ? '0'
          : formatTokenAmount(stablecoinBalance, stablecoinDecimals),
      rawBalance: stablecoinBalance,
      decimals: stablecoinDecimals,
      explorerUrl: getExplorerAddressUrl(
        paymentTokenAddress,
        defaultAppChain.id
      ),
      error: stablecoinError
    },
    chainName: defaultAppChain.shortName,
    isLoading,
    refresh
  }
}

async function readStablecoinBalance(ownerAddress: `0x${string}`) {
  if (!isHexAddress(paymentTokenAddress)) {
    throw new Error('Invalid payment token address.')
  }

  const [balance, decimals] = await Promise.all([
    walletBalanceClient.readContract({
      address: paymentTokenAddress,
      abi: stablecoinAbi,
      functionName: 'balanceOf',
      args: [ownerAddress]
    }),
    walletBalanceClient.readContract({
      address: paymentTokenAddress,
      abi: stablecoinAbi,
      functionName: 'decimals'
    })
  ])

  return {
    balance,
    decimals: Number(decimals)
  }
}

function formatTokenAmount(amount: bigint, decimals: number) {
  return Number(formatUnits(amount, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: 6
  })
}

function isHexAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}
