import { getPublishedProducts } from '@/features/marketplace/products'
import { listSettlementReceipts } from '@/features/marketplace/receipt-store'
import {
  defaultAppChain,
  defaultX402FacilitatorUrl,
  x402Network
} from '@/lib/config/chains'
import { envClient } from '@/lib/env/env.client'
import { envServer } from '@/lib/env/env.server'

export type ReadinessState = 'ready' | 'attention'

export type ReadinessItem = {
  label: string
  value: string
  state: ReadinessState
  detail: string
}

export async function getOperationalReadiness() {
  const [products, settlementReceipts] = await Promise.all([
    getPublishedProducts(),
    listSettlementReceipts()
  ])
  const facilitatorUrl =
    envServer.X402_FACILITATOR_URL ?? defaultX402FacilitatorUrl

  const items: ReadinessItem[] = [
    {
      label: 'Payment network',
      value: x402Network,
      state:
        x402Network === `eip155:${defaultAppChain.id}` ? 'ready' : 'attention',
      detail: 'Paid API routes settle USDT on the configured x402 network.'
    },
    {
      label: 'x402 facilitator',
      value: facilitatorUrl,
      state: facilitatorUrl.length > 0 ? 'ready' : 'attention',
      detail: 'The gateway verifies and settles signed payment payloads here.'
    },
    {
      label: 'Wallet onboarding',
      value: envClient.NEXT_PUBLIC_WALLET_PROVIDER ?? 'rainbowkit',
      state: envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
        ? 'ready'
        : 'attention',
      detail:
        'WalletConnect project configuration enables the production wallet modal.'
    },
    {
      label: 'External HTTP adapter',
      value: 'Configured per listing',
      state: 'ready',
      detail:
        'Provider-created listings store upstream endpoint, auth, and polling mappings for paid forwarding.'
    },
    {
      label: 'Marketplace listings',
      value: products.length.toString(),
      state: products.length > 0 ? 'ready' : 'attention',
      detail: 'Published listings are available for paid buyer and agent calls.'
    },
    {
      label: 'Receipt records',
      value: settlementReceipts.length.toString(),
      state: settlementReceipts.length > 0 ? 'ready' : 'attention',
      detail:
        'Receipt pages show USDT amount, fee split, tx hash, and explorer.'
    },
    {
      label: 'Agent spender',
      value: envServer.AGENT_SPENDER_PRIVATE_KEY
        ? 'Configured'
        : 'Local execution only',
      state: envServer.AGENT_SPENDER_PRIVATE_KEY ? 'ready' : 'attention',
      detail:
        'Server-side agent runs use this signer for autonomous x402 USDT payments.'
    },
    {
      label: 'Agent budget vault',
      value:
        envClient.NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS ??
        'Contract not configured',
      state: envClient.NEXT_PUBLIC_AGENT_RUN_VAULT_ADDRESS
        ? 'ready'
        : 'attention',
      detail:
        'Production agent runs require a user-funded USDT budget vault before spending.'
    },
    {
      label: 'Agent attestor',
      value:
        envClient.NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS ??
        'Contract not configured',
      state: envClient.NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS
        ? 'ready'
        : 'attention',
      detail:
        'Completed agent runs write proof hashes to the configured attestor contract.'
    },
    {
      label: 'Agent proof pages',
      value: '/proofs/[proofId]',
      state: 'ready',
      detail:
        'Public audit pages expose non-sensitive run summaries, receipts, and attestation links.'
    }
  ]

  return {
    items,
    readyCount: items.filter(item => item.state === 'ready').length,
    attentionCount: items.filter(item => item.state === 'attention').length
  }
}
