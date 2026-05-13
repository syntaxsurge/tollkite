'use client'

import dynamic from 'next/dynamic'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { walletProvider } from '@/lib/config/wallet'

const RainbowChainSelector = dynamic(
  () =>
    import('@/components/ui/rainbow-chain-selector').then(
      mod => mod.RainbowChainSelector
    ),
  { ssr: false }
)

export function ChainSelectorButton() {
  const walletRuntimeReady = useWalletRuntimeReady()

  if (!walletRuntimeReady || walletProvider !== 'rainbow-kit') {
    return null
  }

  return <RainbowChainSelector />
}
