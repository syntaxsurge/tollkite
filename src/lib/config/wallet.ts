import { envClient } from '@/lib/env/env.client'

export type WalletProvider = 'thirdweb' | 'rainbow-kit'

const resolvedProvider = envClient.NEXT_PUBLIC_WALLET_PROVIDER

export const walletProvider: WalletProvider =
  resolvedProvider === 'rainbowkit'
    ? 'rainbow-kit'
    : (resolvedProvider ?? 'thirdweb')
