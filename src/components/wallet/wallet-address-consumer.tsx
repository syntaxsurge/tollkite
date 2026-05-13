'use client'

import * as React from 'react'

import { useActiveAccount } from 'thirdweb/react'
import { useAccount } from 'wagmi'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { walletProvider } from '@/lib/config/wallet'

type WalletAddressConsumerProps = {
  children: (wallet: {
    address: string | null
    isConnected: boolean
  }) => React.ReactNode
}

export function WalletAddressConsumer({
  children
}: WalletAddressConsumerProps) {
  const walletRuntimeReady = useWalletRuntimeReady()

  if (!walletRuntimeReady) {
    return children({ address: null, isConnected: false })
  }

  if (walletProvider === 'rainbow-kit') {
    return (
      <RainbowWalletAddressConsumer>{children}</RainbowWalletAddressConsumer>
    )
  }

  return (
    <ThirdwebWalletAddressConsumer>{children}</ThirdwebWalletAddressConsumer>
  )
}

function RainbowWalletAddressConsumer({
  children
}: WalletAddressConsumerProps) {
  const { address, isConnected } = useAccount()

  return children({ address: address ?? null, isConnected })
}

function ThirdwebWalletAddressConsumer({
  children
}: WalletAddressConsumerProps) {
  const account = useActiveAccount()
  const address = account?.address ?? null

  return children({ address, isConnected: Boolean(address) })
}
