'use client'

import * as React from 'react'

import { encodeFunctionData, isAddress, numberToHex, parseUnits } from 'viem'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import {
  getSubscriptionChainId,
  subscriptionManagerAbi,
  subscriptionNativeTokenSymbol
} from '@/lib/contracts/subscription'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

type AdminSubscriptionActionsProps = {
  contractAddress: `0x${string}` | null
  basePriceNative: string
  plusPriceNative: string
  supportsTreasuryWithdraw: boolean
}

export function AdminSubscriptionActions({
  contractAddress,
  basePriceNative,
  plusPriceNative,
  supportsTreasuryWithdraw
}: AdminSubscriptionActionsProps) {
  const walletRuntimeReady = useWalletRuntimeReady()

  if (!walletRuntimeReady) {
    return (
      <Card>
        <p className='text-foreground/65 text-sm leading-6'>
          Wallet runtime is loading. Connect an admin wallet to update prices or
          withdraw subscription revenue.
        </p>
      </Card>
    )
  }

  return (
    <WalletAddressConsumer>
      {({ address }) => (
        <AdminSubscriptionActionForms
          address={address}
          contractAddress={contractAddress}
          basePriceNative={basePriceNative}
          plusPriceNative={plusPriceNative}
          supportsTreasuryWithdraw={supportsTreasuryWithdraw}
        />
      )}
    </WalletAddressConsumer>
  )
}

function AdminSubscriptionActionForms({
  address,
  contractAddress,
  basePriceNative,
  plusPriceNative,
  supportsTreasuryWithdraw
}: AdminSubscriptionActionsProps & { address: string | null }) {
  const [base, setBase] = React.useState(basePriceNative)
  const [plus, setPlus] = React.useState(plusPriceNative)
  const [recipient, setRecipient] = React.useState(address ?? '')
  const [withdrawAmount, setWithdrawAmount] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [isPending, setIsPending] = React.useState(false)

  React.useEffect(() => {
    setBase(basePriceNative)
  }, [basePriceNative])

  React.useEffect(() => {
    setPlus(plusPriceNative)
  }, [plusPriceNative])

  React.useEffect(() => {
    if (address && !recipient) {
      setRecipient(address)
    }
  }, [address, recipient])

  async function sendContractTransaction(data: `0x${string}`) {
    if (!address || !isAddress(address)) {
      throw new Error('Connect a valid admin wallet first.')
    }

    if (!contractAddress || !isAddress(contractAddress)) {
      throw new Error(
        'Configure NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS first.'
      )
    }

    const provider = (window as Window & { ethereum?: EthereumProvider })
      .ethereum

    if (!provider) {
      throw new Error('Open this page in a wallet-enabled browser.')
    }

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: numberToHex(getSubscriptionChainId()) }]
      })
    } catch {
      // Some wallets cannot switch programmatically.
    }

    return provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: address,
          to: contractAddress,
          data
        }
      ]
    })
  }

  async function updatePlanPrices(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setStatus('Waiting for admin wallet confirmation...')

    try {
      const nextBase = parseNativeTokenAmount(base)
      const nextPlus = parseNativeTokenAmount(plus)
      const currentBase = basePriceNative
        ? parseNativeTokenAmount(basePriceNative)
        : null
      const currentPlus = plusPriceNative
        ? parseNativeTokenAmount(plusPriceNative)
        : null

      const updates: Array<{ planKey: 1 | 2; priceWei: bigint }> = []

      if (currentBase !== nextBase) {
        updates.push({ planKey: 1, priceWei: nextBase })
      }

      if (currentPlus !== nextPlus) {
        updates.push({ planKey: 2, priceWei: nextPlus })
      }

      if (updates.length === 0) {
        setStatus('No plan price changes to submit.')
        return
      }

      for (const update of updates) {
        await sendContractTransaction(
          encodeFunctionData({
            abi: subscriptionManagerAbi,
            functionName: 'setPlanPrice',
            args: [update.planKey, update.priceWei]
          })
        )
      }

      setStatus('Plan price transaction submitted.')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Transaction rejected.'
      )
    } finally {
      setIsPending(false)
    }
  }

  async function withdrawTreasury(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsPending(true)
    setStatus('Waiting for withdrawal confirmation...')

    try {
      if (!supportsTreasuryWithdraw) {
        throw new Error(
          'Deploy the current SubscriptionManager before withdrawing.'
        )
      }

      if (!recipient || !isAddress(recipient)) {
        throw new Error('Enter a valid withdrawal recipient.')
      }

      const amount = withdrawAmount.trim()
        ? parseNativeTokenAmount(withdrawAmount)
        : 0n

      await sendContractTransaction(
        encodeFunctionData({
          abi: subscriptionManagerAbi,
          functionName: 'withdraw',
          args: [recipient, amount]
        })
      )

      setStatus('Treasury withdrawal transaction submitted.')
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Transaction rejected.'
      )
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className='grid gap-5 xl:grid-cols-2'>
      <Card className='space-y-5'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Plan pricing
          </p>
          <h2 className='font-display mt-2 text-2xl'>Update on-chain prices</h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Price updates call `setPlanPrice` from the connected admin wallet.
          </p>
        </div>

        <form onSubmit={updatePlanPrices} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='space-y-2'>
              <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Base price ({subscriptionNativeTokenSymbol})
              </span>
              <Input
                type='number'
                min='0'
                step='0.000000000000000001'
                value={base}
                onChange={event => setBase(event.target.value)}
                required
              />
            </label>
            <label className='space-y-2'>
              <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Plus price ({subscriptionNativeTokenSymbol})
              </span>
              <Input
                type='number'
                min='0'
                step='0.000000000000000001'
                value={plus}
                onChange={event => setPlus(event.target.value)}
                required
              />
            </label>
          </div>
          <Button type='submit' disabled={isPending || !address}>
            {isPending ? 'Submitting...' : 'Update prices'}
          </Button>
        </form>
      </Card>

      <Card className='space-y-5'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Treasury
          </p>
          <h2 className='font-display mt-2 text-2xl'>Withdraw earnings</h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Withdraw available subscription revenue to an admin-controlled
            wallet. Leave amount blank to withdraw the full balance.
          </p>
        </div>

        <form onSubmit={withdrawTreasury} className='space-y-4'>
          <label className='space-y-2'>
            <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Recipient
            </span>
            <Input
              value={recipient}
              onChange={event => setRecipient(event.target.value)}
              required
            />
          </label>
          <label className='space-y-2'>
            <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Amount ({subscriptionNativeTokenSymbol})
            </span>
            <Input
              type='number'
              min='0'
              step='0.000000000000000001'
              value={withdrawAmount}
              onChange={event => setWithdrawAmount(event.target.value)}
            />
          </label>
          <Button
            type='submit'
            disabled={isPending || !address || !supportsTreasuryWithdraw}
          >
            {isPending ? 'Submitting...' : 'Withdraw earnings'}
          </Button>
        </form>
      </Card>

      {status ? (
        <p className='text-foreground/60 text-sm xl:col-span-2' role='status'>
          {status}
        </p>
      ) : null}
    </div>
  )
}

function parseNativeTokenAmount(value: string) {
  return parseUnits(value, 18)
}
