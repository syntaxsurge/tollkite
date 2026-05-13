'use client'

import { useEffect, useState } from 'react'

import { ExternalLink, Power, RefreshCw, RotateCcw } from 'lucide-react'
import {
  createPublicClient,
  encodeFunctionData,
  http,
  isAddress,
  numberToHex
} from 'viem'

import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { useUserSettings } from '@/hooks/use-user-settings'
import {
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  getSubscriptionChain
} from '@/lib/config/chains'
import {
  getSubscriptionChainId,
  getSubscriptionManagerAddress,
  subscriptionManagerAbi,
  subscriptionPlans
} from '@/lib/contracts/subscription'
import {
  UserSettings,
  defaultUserSettings,
  saveUserSettings
} from '@/lib/settings/user-settings'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type SubscriptionState = {
  planKey: number
  paidUntil: bigint
  active: boolean
  autoRenew: boolean
  canceledAt: bigint
}

const subscriptionChain = getSubscriptionChain()
const publicClient = createPublicClient({
  chain: subscriptionChain.viemChain,
  transport: http()
})

export function SubscriptionStatus() {
  return (
    <WalletAddressConsumer>
      {({ address }) => <SubscriptionStatusContent address={address} />}
    </WalletAddressConsumer>
  )
}

function SubscriptionStatusContent({ address }: { address: string | null }) {
  const { settings: persistedSettings } = useUserSettings(address)
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings)
  const [subscription, setSubscription] = useState<SubscriptionState | null>(
    null
  )
  const [status, setStatus] = useState('')
  const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const contractAddress = getSubscriptionManagerAddress()
  const contractExplorerUrl = getExplorerAddressUrl(contractAddress)
  const paymentHistoryUrl = getExplorerAddressUrl(address)
  const submittedTxUrl = getExplorerTransactionUrl(submittedTxHash)
  const selectedPlan =
    subscriptionPlans.find(plan => plan.key === settings.plan) ??
    subscriptionPlans[0]

  useEffect(() => {
    setSettings(persistedSettings)
  }, [persistedSettings])

  useEffect(() => {
    if (
      !address ||
      !isAddress(address) ||
      !contractAddress ||
      !isAddress(contractAddress)
    ) {
      setSubscription(null)
      return
    }

    let isMounted = true
    const subscriptionAddress = contractAddress
    const teamAddress = address

    async function loadSubscription() {
      try {
        const result = await publicClient.readContract({
          address: subscriptionAddress,
          abi: subscriptionManagerAbi,
          functionName: 'subscriptionOf',
          args: [teamAddress]
        })

        if (!isMounted) {
          return
        }

        setSubscription({
          planKey: Number(result[0]),
          paidUntil: result[1],
          active: result[2],
          autoRenew: result[3],
          canceledAt: result[4]
        })
      } catch {
        if (isMounted) {
          setSubscription(null)
        }
      }
    }

    void loadSubscription()

    return () => {
      isMounted = false
    }
  }, [address, contractAddress])

  async function sendContractTransaction(
    data: `0x${string}`,
    value = 0n,
    planToPersist?: UserSettings['plan']
  ) {
    if (!address || !isAddress(address)) {
      setStatus('Connect a valid wallet first.')
      return
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      setStatus('Configure NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS first.')
      return
    }

    const fromAddress = address
    const subscriptionAddress = contractAddress
    const provider = (window as Window & { ethereum?: EthereumProvider })
      .ethereum

    if (!provider) {
      setStatus('Open this page in a wallet-enabled browser.')
      return
    }

    setIsPending(true)
    setStatus('Waiting for wallet confirmation...')
    setSubmittedTxHash(null)

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToHex(getSubscriptionChainId()) }]
      })
    } catch {
      // Some wallets cannot switch programmatically.
    }

    try {
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: fromAddress,
            to: subscriptionAddress,
            value: numberToHex(value),
            data
          }
        ]
      })

      const hash = String(txHash)
      setSubmittedTxHash(hash.startsWith('0x') ? hash : null)
      if (planToPersist) {
        await saveUserSettings({ ...settings, plan: planToPersist }, address)
      }
      setStatus(`Transaction submitted: ${hash}`)
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Transaction rejected.'
      )
    } finally {
      setIsPending(false)
    }
  }

  function updateSelectedPlan(plan: UserSettings['plan']) {
    const nextSettings = { ...settings, plan }
    setSettings(nextSettings)

    if (plan === 'free') {
      void saveUserSettings(nextSettings, address).catch(error => {
        setStatus(
          error instanceof Error ? error.message : 'Could not save plan.'
        )
      })
    }
  }

  const paidUntilDate =
    subscription && subscription.paidUntil > 0n
      ? new Date(Number(subscription.paidUntil) * 1000)
      : null

  return (
    <Card className='space-y-5'>
      <div>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          Subscription
        </p>
        <h2 className='font-display mt-2 text-2xl'>Plan controls</h2>
        <p className='text-foreground/65 mt-2 text-sm leading-6'>
          Read the live subscription state from SubscriptionManager, renew the
          selected plan, toggle renewal preference, or cancel the current
          subscription.
        </p>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Metric
          label='Status'
          value={subscription?.active ? 'Active' : 'Inactive'}
        />
        <Metric
          label='Paid until'
          value={paidUntilDate ? paidUntilDate.toLocaleString() : 'Not paid'}
        />
        <Metric
          label='Auto renew'
          value={subscription?.autoRenew ? 'Enabled' : 'Disabled'}
        />
      </div>

      <div className='bg-muted grid gap-3 rounded-lg p-4 sm:grid-cols-2'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Network
          </p>
          <p className='mt-2 text-sm font-semibold'>
            {subscriptionChain.shortName} ·{' '}
            {subscriptionChain.nativeCurrency.symbol}
          </p>
        </div>
        <div className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
          {paymentHistoryUrl ? (
            <a
              href={paymentHistoryUrl}
              target='_blank'
              rel='noreferrer'
              className={buttonClasses({
                variant: 'outline',
                size: 'sm',
                className: 'gap-2'
              })}
            >
              Payment history
              <ExternalLink className='h-4 w-4' aria-hidden />
            </a>
          ) : null}
          {contractExplorerUrl ? (
            <a
              href={contractExplorerUrl}
              target='_blank'
              rel='noreferrer'
              className={buttonClasses({
                variant: 'outline',
                size: 'sm',
                className: 'gap-2'
              })}
            >
              Contract
              <ExternalLink className='h-4 w-4' aria-hidden />
            </a>
          ) : null}
        </div>
      </div>

      <label className='space-y-2'>
        <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          Selected plan
        </span>
        <select
          value={settings.plan}
          onChange={event =>
            updateSelectedPlan(event.target.value as UserSettings['plan'])
          }
          className='border-foreground/15 bg-background text-foreground focus-visible:ring-foreground/30 h-11 w-full rounded-2xl border px-4 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
        >
          <option value='free'>Free</option>
          <option value='base'>Base</option>
          <option value='plus'>Plus</option>
        </select>
      </label>

      <div className='grid gap-3 sm:grid-cols-3'>
        <Button
          type='button'
          disabled={isPending || selectedPlan.key === 'free'}
          onClick={() =>
            sendContractTransaction(
              encodeFunctionData({
                abi: subscriptionManagerAbi,
                functionName: 'renewSubscription',
                args: [selectedPlan.planKey]
              }),
              BigInt(selectedPlan.priceWei),
              selectedPlan.key
            )
          }
        >
          <RefreshCw className='h-4 w-4' aria-hidden />
          Renew
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={isPending || !subscription?.active}
          onClick={() =>
            sendContractTransaction(
              encodeFunctionData({
                abi: subscriptionManagerAbi,
                functionName: 'setAutoRenew',
                args: [!subscription?.autoRenew]
              })
            )
          }
        >
          <Power className='h-4 w-4' aria-hidden />
          {subscription?.autoRenew ? 'Disable renewal' : 'Enable renewal'}
        </Button>
        <Button
          type='button'
          variant='outline'
          disabled={isPending || !subscription?.active}
          onClick={() =>
            sendContractTransaction(
              encodeFunctionData({
                abi: subscriptionManagerAbi,
                functionName: 'cancelSubscription'
              })
            )
          }
        >
          <RotateCcw className='h-4 w-4' aria-hidden />
          Cancel
        </Button>
      </div>

      {status ? (
        <div
          className='text-foreground/60 space-y-2 text-sm leading-6'
          role='status'
        >
          <p>{status}</p>
          {submittedTxUrl ? (
            <a
              href={submittedTxUrl}
              target='_blank'
              rel='noreferrer'
              className='text-foreground inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline'
            >
              View transaction on {subscriptionChain.explorer.name}
              <ExternalLink className='h-4 w-4' aria-hidden />
            </a>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted rounded-lg p-4'>
      <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {label}
      </p>
      <p className='mt-2 text-sm font-semibold'>{value}</p>
    </div>
  )
}
