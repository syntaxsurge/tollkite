import { createThirdwebClient } from 'thirdweb'
import { defineChain } from 'thirdweb/chains'

import { getSubscriptionChain } from '@/lib/config/chains'
import { envClient } from '@/lib/env/env.client'

export const thirdwebClient = envClient.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
  ? createThirdwebClient({
      clientId: envClient.NEXT_PUBLIC_THIRDWEB_CLIENT_ID
    })
  : null

export const thirdwebActiveChain = defineChain(getSubscriptionChain().id)
