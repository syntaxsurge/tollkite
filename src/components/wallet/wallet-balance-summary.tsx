'use client'

import { ExternalLink, RefreshCw, WalletCards } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useWalletBalances } from '@/hooks/use-wallet-balances'
import { cn } from '@/lib/utils/cn'

type WalletBalanceSummaryProps = {
  walletAddress: string | null
  variant?: 'profile' | 'menu'
}

export function WalletBalanceSummary({
  walletAddress,
  variant = 'profile'
}: WalletBalanceSummaryProps) {
  const balances = useWalletBalances(walletAddress)
  const isConnected = Boolean(walletAddress)

  if (variant === 'menu') {
    return (
      <div className='border-border mt-3 border-t pt-3'>
        <div className='mb-2 flex items-center justify-between gap-3'>
          <p className='text-muted-foreground text-xs font-semibold'>
            Balances
          </p>
          <button
            type='button'
            className='text-muted-foreground hover:text-foreground inline-flex h-7 w-7 items-center justify-center rounded-md transition disabled:opacity-50'
            onClick={() => void balances.refresh()}
            disabled={!isConnected || balances.isLoading}
            aria-label='Refresh wallet balances'
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5',
                balances.isLoading && 'animate-spin'
              )}
              aria-hidden
            />
          </button>
        </div>
        <div className='grid gap-2'>
          <CompactBalanceRow balance={balances.native} />
          <CompactBalanceRow balance={balances.stablecoin} />
        </div>
        <p className='text-muted-foreground mt-2 text-[0.7rem]'>
          {balances.chainName}
        </p>
      </div>
    )
  }

  return (
    <Card className='bg-panel-sheen space-y-5'>
      <div className='flex items-start justify-between gap-4'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Wallet balances
          </p>
          <h2 className='font-display mt-2 text-2xl'>
            {balances.stablecoin.formattedBalance} {balances.stablecoin.symbol}
          </h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            {balances.chainName}
          </p>
        </div>
        <div className='bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-lg'>
          <WalletCards className='h-5 w-5' aria-hidden />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2'>
        <LargeBalanceTile balance={balances.native} />
        <LargeBalanceTile balance={balances.stablecoin} />
      </div>

      <div className='flex flex-col gap-3 sm:flex-row'>
        <button
          type='button'
          className={cn(
            buttonClasses({ variant: 'outline', className: 'flex-1' }),
            'disabled:pointer-events-none disabled:opacity-60'
          )}
          onClick={() => void balances.refresh()}
          disabled={!isConnected || balances.isLoading}
        >
          <RefreshCw
            className={cn('h-4 w-4', balances.isLoading && 'animate-spin')}
            aria-hidden
          />
          Refresh
        </button>
        {balances.stablecoin.explorerUrl ? (
          <a
            href={balances.stablecoin.explorerUrl}
            target='_blank'
            rel='noreferrer'
            className={buttonClasses({
              variant: 'outline',
              className: 'flex-1'
            })}
          >
            <ExternalLink className='h-4 w-4' aria-hidden />
            Stablecoin
          </a>
        ) : null}
      </div>
    </Card>
  )
}

function CompactBalanceRow({
  balance
}: {
  balance: ReturnType<typeof useWalletBalances>['native']
}) {
  return (
    <div className='border-border/80 bg-background/35 rounded-md border px-3 py-2'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-muted-foreground text-xs'>{balance.label}</span>
        <span className='text-xs font-semibold'>
          {balance.formattedBalance} {balance.symbol}
        </span>
      </div>
      {balance.error ? (
        <p className='text-destructive mt-1 text-[0.7rem]'>{balance.error}</p>
      ) : null}
    </div>
  )
}

function LargeBalanceTile({
  balance
}: {
  balance: ReturnType<typeof useWalletBalances>['native']
}) {
  return (
    <div className='bg-muted rounded-lg p-4'>
      <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {balance.label}
      </p>
      <p className='mt-2 text-sm font-semibold'>
        {balance.formattedBalance} {balance.symbol}
      </p>
      {balance.error ? (
        <p className='text-destructive mt-2 text-xs'>{balance.error}</p>
      ) : null}
    </div>
  )
}
