'use client'

import * as React from 'react'

import {
  RainbowKitProvider,
  darkTheme,
  lightTheme
} from '@rainbow-me/rainbowkit'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { WagmiProvider } from 'wagmi'

import { defaultAppChain } from '@/lib/config/chains'
import { rainbowConfig } from '@/lib/wallet/rainbow'

export function RainbowWalletRuntimeProvider({
  children
}: {
  children: React.ReactNode
}) {
  const [queryClient] = React.useState(() => new QueryClient())
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!rainbowConfig) {
    return <>{children}</>
  }

  const rainbowTheme =
    mounted && resolvedTheme === 'dark'
      ? darkTheme({
          accentColor: '#1BE500',
          accentColorForeground: '#060906',
          borderRadius: 'medium',
          fontStack: 'system',
          overlayBlur: 'small'
        })
      : lightTheme({
          accentColor: '#0F7F00',
          accentColorForeground: '#FFFFFF',
          borderRadius: 'medium',
          fontStack: 'system',
          overlayBlur: 'small'
        })

  return (
    <WagmiProvider config={rainbowConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          initialChain={defaultAppChain.viemChain}
          theme={rainbowTheme}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
