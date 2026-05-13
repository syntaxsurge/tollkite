'use client'

import { useState } from 'react'

import { Check, CreditCard } from 'lucide-react'
import { encodeFunctionData, isAddress, numberToHex } from 'viem'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { Button } from '@/components/ui/button'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import {
  getSubscriptionChainId,
  getSubscriptionManagerAddress,
  subscriptionManagerAbi,
  subscriptionPlans
} from '@/lib/contracts/subscription'
import {
  readUserSettings,
  saveUserSettings
} from '@/lib/settings/user-settings'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export function SubscriptionCheckout({
  planKey
}: {
  planKey: 'free' | 'base' | 'plus'
}) {
  const walletRuntimeReady = useWalletRuntimeReady()

  if (!walletRuntimeReady) {
    return (
      <Button type='button' className='w-full' disabled>
        Connect wallet
      </Button>
    )
  }

  return (
    <WalletAddressConsumer>
      {({ address }) => (
        <SubscriptionCheckoutButton planKey={planKey} address={address} />
      )}
    </WalletAddressConsumer>
  )
}

function SubscriptionCheckoutButton({
  planKey,
  address
}: {
  planKey: 'free' | 'base' | 'plus'
  address: string | null
}) {
  const [status, setStatus] = useState('')
  const [isPending, setIsPending] = useState(false)
  const plan = subscriptionPlans.find(item => item.key === planKey)
  const contractAddress = getSubscriptionManagerAddress()

  if (!plan) {
    return null
  }

  async function selectFreePlan() {
    if (!address || !isAddress(address)) {
      setStatus('Connect a wallet first.')
      return
    }

    try {
      const settings = readUserSettings(address)
      await saveUserSettings({ ...settings, plan: 'free' }, address)
      setStatus('Free plan selected.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save plan.')
    }
  }

  async function paySubscription() {
    if (!address || !plan || plan.key === 'free') {
      return
    }

    if (!address || !isAddress(address)) {
      setStatus('Connect a valid wallet address first.')
      return
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      setStatus('Configure NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS first.')
      return
    }

    const provider = (window as Window & { ethereum?: EthereumProvider })
      .ethereum

    if (!provider) {
      setStatus('Open this page in a wallet-enabled browser.')
      return
    }

    setIsPending(true)
    setStatus('Waiting for wallet confirmation...')

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToHex(getSubscriptionChainId()) }]
      })
    } catch {
      // Wallets that cannot switch still get the transaction request below.
    }

    try {
      const data = encodeFunctionData({
        abi: subscriptionManagerAbi,
        functionName: 'paySubscription',
        args: [address, plan.planKey]
      })

      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: address,
            to: contractAddress,
            value: numberToHex(BigInt(plan.priceWei)),
            data
          }
        ]
      })

      const settings = readUserSettings(address)
      await saveUserSettings({ ...settings, plan: plan.key }, address)
      setStatus(`Transaction submitted: ${String(txHash)}`)
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Transaction rejected.'
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className='space-y-2'>
      <Button
        type='button'
        className='w-full text-center whitespace-normal sm:whitespace-nowrap'
        disabled={isPending || !address}
        onClick={plan.key === 'free' ? selectFreePlan : paySubscription}
      >
        {plan.key === 'free' ? (
          <Check className='h-4 w-4' aria-hidden />
        ) : (
          <CreditCard className='h-4 w-4' aria-hidden />
        )}
        {isPending
          ? 'Confirming...'
          : plan.key === 'free'
            ? 'Use free plan'
            : 'Pay subscription'}
      </Button>
      {status ? (
        <p className='text-foreground/60 text-xs leading-5' role='status'>
          {status}
        </p>
      ) : null}
    </div>
  )
}
