'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ChevronDown } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button'
import { envClient } from '@/lib/env/env.client'
import { rainbowConfig } from '@/lib/wallet/rainbow'

export function RainbowChainSelector() {
  if (!envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || !rainbowConfig) {
    return null
  }

  return (
    <ConnectButton.Custom>
      {({ chain, mounted, openChainModal }) => {
        if (!mounted || !chain) {
          return null
        }

        return (
          <button
            type='button'
            onClick={openChainModal}
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className: 'gap-2 whitespace-nowrap'
            })}
          >
            {chain.hasIcon && chain.iconUrl ? (
              <span
                className='h-4 w-4 rounded-full bg-cover bg-center'
                style={{ backgroundImage: `url(${chain.iconUrl})` }}
                aria-hidden
              />
            ) : null}
            <span className='hidden sm:inline'>
              {chain.unsupported ? 'Wrong network' : chain.name}
            </span>
            <ChevronDown className='h-4 w-4' aria-hidden />
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}
