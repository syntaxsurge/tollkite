import 'server-only'

import {
  defaultSubscriptionPlanKey,
  formatBpsPercent,
  getPlatformFeeBps,
  getProviderShareBps,
  getSubscriptionPlan,
  type SubscriptionPlanKey
} from '@/lib/contracts/subscription'
import { getConvexClient } from '@/lib/db/convex/client'

import { api } from '../../../convex/_generated/api'

export type ProviderFeeSplit = {
  planKey: SubscriptionPlanKey
  planName: string
  providerShareBps: number
  platformFeeBps: number
  providerShareLabel: string
  platformFeeLabel: string
}

type ProviderFeeProduct = {
  ownerWallet?: string | null
  providerWallet?: string | null
}

export async function resolveProviderFeeSplit(
  product: ProviderFeeProduct
): Promise<ProviderFeeSplit> {
  const wallet = product.ownerWallet ?? product.providerWallet
  const planKey = await resolveProviderPlanKey(wallet)
  const plan = getSubscriptionPlan(planKey)

  return {
    planKey: plan.key,
    planName: plan.name,
    providerShareBps: getProviderShareBps(plan.key),
    platformFeeBps: getPlatformFeeBps(plan.key),
    providerShareLabel: formatBpsPercent(plan.providerShareBps),
    platformFeeLabel: formatBpsPercent(plan.platformFeeBps)
  }
}

async function resolveProviderPlanKey(
  wallet?: string | null
): Promise<SubscriptionPlanKey> {
  if (!wallet) {
    return defaultSubscriptionPlanKey
  }

  try {
    const profile = await getConvexClient().query(api.users.getByWallet, {
      walletAddress: wallet
    })
    const plan = profile?.plan

    if (plan === 'base' || plan === 'plus') {
      return plan
    }
  } catch {
    return defaultSubscriptionPlanKey
  }

  return defaultSubscriptionPlanKey
}
