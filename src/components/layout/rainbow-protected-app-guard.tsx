'use client'

import { useAccount } from 'wagmi'

import { ProtectedWalletGuardFrame } from '@/components/layout/protected-app-guard'

export function RainbowProtectedAppGuard({
  children
}: {
  children: React.ReactNode
}) {
  const { isConnected, isConnecting, isReconnecting } = useAccount()

  return (
    <ProtectedWalletGuardFrame
      isChecking={isConnecting || isReconnecting}
      isConnected={isConnected}
    >
      {children}
    </ProtectedWalletGuardFrame>
  )
}
