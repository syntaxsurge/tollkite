'use client'

import * as React from 'react'

import { WalletSessionBridge } from '@/components/providers/wallet-session-bridge'
import { walletProvider } from '@/lib/config/wallet'
import { envClient } from '@/lib/env/env.client'

type WalletRuntimeProvider = React.ComponentType<{
  children: React.ReactNode
}>

const WalletRuntimeContext = React.createContext(false)

export function useWalletRuntimeReady() {
  return React.useContext(WalletRuntimeContext)
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [RuntimeProvider, setRuntimeProvider] =
    React.useState<WalletRuntimeProvider | null>(null)

  const walletRuntimeEnabled =
    walletProvider === 'rainbow-kit'
      ? Boolean(envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID)
      : Boolean(envClient.NEXT_PUBLIC_THIRDWEB_CLIENT_ID)

  React.useEffect(() => {
    if (!walletRuntimeEnabled) {
      return
    }

    let isMounted = true

    async function loadRuntimeProvider() {
      const Provider =
        walletProvider === 'rainbow-kit'
          ? (
              await import(
                '@/components/providers/rainbow-wallet-runtime-provider'
              )
            ).RainbowWalletRuntimeProvider
          : (
              await import(
                '@/components/providers/thirdweb-wallet-runtime-provider'
              )
            ).ThirdwebWalletRuntimeProvider

      if (!isMounted) {
        return
      }

      setRuntimeProvider(() => Provider)
    }

    void loadRuntimeProvider()

    return () => {
      isMounted = false
    }
  }, [walletRuntimeEnabled])

  if (!walletRuntimeEnabled || !RuntimeProvider) {
    return (
      <WalletRuntimeContext.Provider value={false}>
        {children}
      </WalletRuntimeContext.Provider>
    )
  }

  return (
    <RuntimeProvider>
      <WalletRuntimeContext.Provider value>
        <WalletSessionBridge />
        {children}
      </WalletRuntimeContext.Provider>
    </RuntimeProvider>
  )
}
