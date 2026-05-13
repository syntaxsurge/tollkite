import { getDefaultConfig } from '@rainbow-me/rainbowkit'

import { supportedViemChains } from '@/lib/config/chains'
import { siteConfig } from '@/lib/config/site'
import { envClient } from '@/lib/env/env.client'

export const rainbowConfig = envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
  ? getDefaultConfig({
      appName: siteConfig.name,
      appDescription: siteConfig.description,
      appUrl: siteConfig.url,
      projectId: envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
      chains: supportedViemChains,
      multiInjectedProviderDiscovery: false,
      ssr: true
    })
  : null
