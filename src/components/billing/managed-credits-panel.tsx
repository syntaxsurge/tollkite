'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'

type PublicManagedCreditAccount = {
  wallet: string
  apiKey: string
  balanceUsdt: string
  topUps: Array<{
    id: string
    amountUsdt: number
    settlementTxHash: string
    createdAt: string
  }>
  debits: Array<{
    id: string
    productName: string
    amountUsdt: number
    receiptId: string
    createdAt: string
  }>
}

export function ManagedCreditsPanel({
  initialAccount = null
}: {
  initialAccount?: PublicManagedCreditAccount | null
}) {
  return (
    <WalletAddressConsumer>
      {({ address }) => (
        <ManagedCreditsPanelContent
          address={address}
          initialAccount={initialAccount}
        />
      )}
    </WalletAddressConsumer>
  )
}

function ManagedCreditsPanelContent({
  address,
  initialAccount
}: {
  address: string | null
  initialAccount: PublicManagedCreditAccount | null
}) {
  const router = useRouter()
  const [account, setAccount] = useState<PublicManagedCreditAccount | null>(
    initialAccount
  )
  const [status, setStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function createAccount() {
    if (!address) {
      setStatus('Connect a wallet before creating a managed credit account.')
      return
    }

    setIsLoading(true)
    setStatus('')

    try {
      const response = await fetch('/api/credits/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: address })
      })
      const body = (await response.json()) as {
        account?: PublicManagedCreditAccount
        error?: string
      }

      if (!response.ok || !body.account) {
        throw new Error(body.error ?? 'Unable to create credit account.')
      }

      setAccount(body.account)
      setStatus('Managed credit account ready.')
      router.refresh()
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create credit account.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function recordTopUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!address) {
      setStatus('Connect a wallet before recording a top-up.')
      return
    }

    const formData = new FormData(event.currentTarget)

    setIsLoading(true)
    setStatus('')

    try {
      const response = await fetch('/api/credits/top-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: address,
          amountUsdt: formData.get('amountUsdt'),
          settlementTxHash: formData.get('settlementTxHash')
        })
      })
      const body = (await response.json()) as {
        account?: PublicManagedCreditAccount
        error?: string
      }

      if (!response.ok || !body.account) {
        throw new Error(body.error ?? 'Unable to record top-up.')
      }

      setAccount(body.account)
      setStatus('USDT top-up recorded for managed API-key usage.')
      event.currentTarget.reset()
      router.refresh()
    } catch (caughtError) {
      setStatus(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to record top-up.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className='space-y-5'>
      <div className='flex flex-col justify-between gap-3 lg:flex-row lg:items-start'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Managed credits
          </p>
          <h2 className='font-display mt-2 text-2xl'>API-key path for teams</h2>
          <p className='text-foreground/65 mt-2 max-w-2xl text-sm leading-6'>
            x402 remains the native payment path. Managed credits let a team top
            up USDT once, receive a managed-credit API key, and debit usage from
            the saved balance before provider work starts.
          </p>
        </div>
        <Button onClick={createAccount} disabled={isLoading || !address}>
          {account ? 'Refresh account' : 'Create API key'}
        </Button>
      </div>

      <div className='grid gap-3 text-sm md:grid-cols-3'>
        <Metric
          label='Wallet'
          value={address ?? 'Connect wallet to create account'}
        />
        <Metric
          label='Credit balance'
          value={`${account?.balanceUsdt ?? '0.00'} USDT`}
        />
        <Metric
          label='Usage debits'
          value={(account?.debits.length ?? 0).toString()}
        />
      </div>

      <form
        onSubmit={recordTopUp}
        className='grid gap-3 lg:grid-cols-[160px_1fr_auto]'
      >
        <Input
          name='amountUsdt'
          type='number'
          min='0.01'
          step='0.01'
          placeholder='25.00'
          required
          aria-label='Top-up amount in USDT'
        />
        <Input
          name='settlementTxHash'
          placeholder='0x... payment-token top-up transaction hash'
          required
          aria-label='payment-token top-up transaction hash'
        />
        <Button type='submit' disabled={isLoading || !address}>
          Record top-up
        </Button>
      </form>

      {status ? (
        <p className='text-foreground/65 text-sm' role='status'>
          {status}
        </p>
      ) : null}
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted rounded-lg p-4'>
      <p className='text-foreground/60 text-xs uppercase'>{label}</p>
      <p className='mt-1 font-semibold break-all'>{value}</p>
    </div>
  )
}
