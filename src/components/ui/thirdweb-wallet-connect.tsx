'use client'

import { ConnectButton } from 'thirdweb/react'

import { buttonClasses } from '@/components/ui/button'
import { siteConfig } from '@/lib/config/site'
import { envClient } from '@/lib/env/env.client'
import { thirdwebActiveChain, thirdwebClient } from '@/lib/wallet/thirdweb'

export function ThirdwebWalletConnect() {
  if (!thirdwebClient || !envClient.NEXT_PUBLIC_THIRDWEB_CLIENT_ID) {
    return (
      <button
        type='button'
        className={buttonClasses({ variant: 'outline', size: 'sm' })}
        disabled
      >
        Thirdweb ID missing
      </button>
    )
  }

  return (
    <ConnectButton
      client={thirdwebClient}
      chain={thirdwebActiveChain}
      appMetadata={{
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description
      }}
    />
  )
}
