'use client'

import { ThirdwebProvider } from 'thirdweb/react'

export function ThirdwebWalletRuntimeProvider({
  children
}: {
  children: React.ReactNode
}) {
  return <ThirdwebProvider>{children}</ThirdwebProvider>
}
