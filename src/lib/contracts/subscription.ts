import { parseAbi } from 'viem'

import { getSubscriptionChain } from '@/lib/config/chains'
import { envClient } from '@/lib/env/env.client'

export const subscriptionManagerAbi = parseAbi([
  'function paySubscription(address team, uint8 planKey) payable',
  'function renewSubscription(uint8 planKey) payable',
  'function cancelSubscription()',
  'function cancelSubscriptionFor(address team)',
  'function setAutoRenew(bool enabled)',
  'function setPlanPrice(uint8 planKey, uint256 newPriceWei)',
  'function withdraw(address payable recipient, uint256 amount)',
  'function paidUntil(address team) view returns (uint256)',
  'function isSubscriptionActive(address team) view returns (bool)',
  'function contractBalance() view returns (uint256)',
  'function subscriberCount() view returns (uint256)',
  'function subscriberAt(uint256 index) view returns (address)',
  'function subscribers(uint256 offset, uint256 limit) view returns (address[] wallets, uint256 total)',
  'function subscriptionOf(address team) view returns (uint8 planKey, uint256 paidUntilValue, bool active, bool autoRenew, uint256 canceledAt)',
  'function planPriceWei(uint8 planKey) view returns (uint256)'
])

export const subscriptionNativeTokenSymbol =
  getSubscriptionChain().nativeCurrency.symbol

function formatNativePrice(priceWei: string) {
  const whole = BigInt(priceWei) / 1_000_000_000_000_000_000n
  const remainder = BigInt(priceWei) % 1_000_000_000_000_000_000n

  if (remainder === 0n) {
    return `${whole.toString()} ${subscriptionNativeTokenSymbol}`
  }

  const decimals = remainder.toString().padStart(18, '0').replace(/0+$/, '')
  return `${whole.toString()}.${decimals} ${subscriptionNativeTokenSymbol}`
}

export function formatNativeAmount(priceWei: string | bigint) {
  return formatNativePrice(priceWei.toString())
}

export const defaultSubscriptionPlanKey = 'free'

export const subscriptionPlans = [
  {
    key: 'free',
    planKey: 0,
    name: 'Free',
    priceLabel: '$0',
    priceWei: '0',
    description: 'Start listing and testing paid APIs without a subscription.',
    bestFor: 'New providers validating one or two paid APIs.',
    providerShareBps: 9500,
    platformFeeBps: 500,
    features: [
      'Wallet profile and marketplace browsing',
      'List paid APIs in the marketplace',
      'Browser Run and Pay testing',
      'Public receipts for successful calls'
    ],
    included: [
      'Wallet profile and marketplace browsing',
      'List paid APIs',
      'Run and Pay testing',
      'Public receipts'
    ],
    excluded: [
      'Reduced platform fee',
      'Advanced provider analytics',
      'Priority agent-tool visibility',
      'Premium support'
    ]
  },
  {
    key: 'base',
    planKey: 1,
    name: 'Base',
    priceWei:
      envClient.NEXT_PUBLIC_SUBSCRIPTION_BASE_PRICE_WEI ?? '1000000000000000',
    get priceLabel() {
      return formatNativePrice(this.priceWei)
    },
    description: 'Grow a paid API business with a lower platform fee.',
    bestFor: 'Active providers growing recurring paid usage.',
    providerShareBps: 9700,
    platformFeeBps: 300,
    features: [
      'Everything in Free',
      'Lower 3% platform fee',
      'Provider revenue analytics',
      'Agent-ready listing support'
    ],
    included: [
      'Everything in Free',
      '97% provider share',
      'Provider revenue analytics',
      'Agent-ready listing support',
      'More prominent provider positioning'
    ],
    excluded: ['99% provider share', 'Highest-priority provider support']
  },
  {
    key: 'plus',
    planKey: 2,
    name: 'Plus',
    priceWei:
      envClient.NEXT_PUBLIC_SUBSCRIPTION_PLUS_PRICE_WEI ?? '2000000000000000',
    get priceLabel() {
      return formatNativePrice(this.priceWei)
    },
    description: 'Maximize payout and visibility for high-volume providers.',
    bestFor: 'High-volume API sellers and agent-tool providers.',
    providerShareBps: 9900,
    platformFeeBps: 100,
    features: [
      'Everything in Base',
      'Lowest 1% platform fee',
      'Highest provider payout',
      'Advanced payout and usage reporting'
    ],
    included: [
      'Everything in Base',
      '99% provider share',
      'Priority agent-tool visibility',
      'Advanced payout and usage reporting',
      'Highest support priority for provider issues'
    ],
    excluded: []
  }
] as const

export type SubscriptionPlanKey = (typeof subscriptionPlans)[number]['key']

export function getSubscriptionPlan(planKey?: string | null) {
  return (
    subscriptionPlans.find(plan => plan.key === planKey) ??
    subscriptionPlans.find(plan => plan.key === defaultSubscriptionPlanKey)!
  )
}

export function getProviderShareBps(planKey?: string | null) {
  return getSubscriptionPlan(planKey).providerShareBps
}

export function getPlatformFeeBps(planKey?: string | null) {
  return getSubscriptionPlan(planKey).platformFeeBps
}

export function formatBpsPercent(bps: number) {
  return `${bps / 100}%`
}

export function getSubscriptionManagerAddress() {
  return envClient.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS
}

export function getSubscriptionChainId() {
  return getSubscriptionChain().id
}
