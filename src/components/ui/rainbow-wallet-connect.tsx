'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'

import { buttonClasses } from '@/components/ui/button'
import { envClient } from '@/lib/env/env.client'
import { cn } from '@/lib/utils/cn'
import { rainbowConfig } from '@/lib/wallet/rainbow'

export function RainbowWalletConnect({ className }: { className?: string }) {
  if (!envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || !rainbowConfig) {
    return (
      <button
        type='button'
        className={buttonClasses({ variant: 'outline', size: 'sm' })}
        disabled
      >
        WalletConnect missing
      </button>
    )
  }

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        mounted,
        openAccountModal,
        openChainModal,
        openConnectModal
      }) => {
        const ready = mounted
        const connected = ready && account && chain

        if (!connected) {
          return (
            <button
              type='button'
              className={cn(
                buttonClasses({ variant: 'outline', size: 'md' }),
                'border-accent/40 bg-accent text-accent-foreground shadow-brand-cyan/20 hover:bg-accent/90 min-w-[11rem] px-5 whitespace-nowrap shadow-sm hover:shadow-md',
                className
              )}
              onClick={openConnectModal}
            >
              Connect Wallet
            </button>
          )
        }

        if (chain.unsupported) {
          return (
            <button
              type='button'
              className={cn(
                buttonClasses({ variant: 'outline', size: 'md' }),
                'border-accent/40 bg-accent text-accent-foreground shadow-brand-cyan/20 hover:bg-accent/90 min-w-[11rem] px-5 whitespace-nowrap shadow-sm',
                className
              )}
              onClick={openChainModal}
            >
              Switch Network
            </button>
          )
        }

        return (
          <button
            type='button'
            className={cn(
              buttonClasses({ variant: 'outline', size: 'md' }),
              'max-w-[12rem] whitespace-nowrap',
              className
            )}
            onClick={openAccountModal}
          >
            {account.displayName}
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}
