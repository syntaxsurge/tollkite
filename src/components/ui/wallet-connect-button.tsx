'use client'

import dynamic from 'next/dynamic'
import * as React from 'react'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { buttonClasses } from '@/components/ui/button'
import { walletProvider } from '@/lib/config/wallet'

const RainbowWalletConnect = dynamic(
  () =>
    import('@/components/ui/rainbow-wallet-connect').then(
      mod => mod.RainbowWalletConnect
    ),
  { ssr: false, loading: () => <WalletCheckingButton /> }
)

const ThirdwebWalletConnect = dynamic(
  () =>
    import('@/components/ui/thirdweb-wallet-connect').then(
      mod => mod.ThirdwebWalletConnect
    ),
  { ssr: false, loading: () => <WalletCheckingButton /> }
)

function WalletCheckingButton({
  className,
  variant = 'outline'
}: {
  className?: string
  variant?: 'primary' | 'outline' | 'ghost'
}) {
  return (
    <button
      type='button'
      className={buttonClasses({
        variant,
        size: 'md',
        className: `border-accent/40 bg-accent text-accent-foreground shadow-brand-cyan/20 hover:bg-accent/90 min-w-[11rem] px-5 whitespace-nowrap shadow-sm ${className ?? ''}`
      })}
      disabled
    >
      Connect Wallet
    </button>
  )
}

export function WalletConnectButton({
  className,
  variant = 'outline'
}: {
  className?: string
  variant?: 'primary' | 'outline' | 'ghost'
}) {
  const [mounted, setMounted] = React.useState(false)
  const walletRuntimeReady = useWalletRuntimeReady()

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !walletRuntimeReady) {
    return <WalletCheckingButton className={className} variant={variant} />
  }

  if (walletProvider === 'rainbow-kit') {
    return <RainbowWalletConnect className={className} />
  }

  return <ThirdwebWalletConnect />
}
