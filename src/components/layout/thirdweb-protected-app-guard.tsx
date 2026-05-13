'use client'

import {
  useActiveAccount,
  useActiveWalletConnectionStatus
} from 'thirdweb/react'

import { ProtectedWalletGuardFrame } from '@/components/layout/protected-app-guard'

export function ThirdwebProtectedAppGuard({
  children
}: {
  children: React.ReactNode
}) {
  const activeAccount = useActiveAccount()
  const connectionStatus = useActiveWalletConnectionStatus()

  return (
    <ProtectedWalletGuardFrame
      isChecking={
        connectionStatus === 'connecting' || connectionStatus === 'unknown'
      }
      isConnected={Boolean(activeAccount?.address)}
    >
      {children}
    </ProtectedWalletGuardFrame>
  )
}
