import {
  Coins,
  CreditCard,
  ExternalLink,
  Network,
  Users,
  WalletCards
} from 'lucide-react'

import { AdminSubscriptionActions } from '@/components/admin/admin-subscription-actions'
import { AdminSubscriptionsTable } from '@/components/admin/admin-subscriptions-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  AdminSubscriptionQuery,
  formatNativePriceInput,
  getAdminSubscriptionSnapshot
} from '@/lib/contracts/subscription-admin'

export const dynamic = 'force-dynamic'

export default async function AdminSubscriptionsPage({
  searchParams
}: {
  searchParams: Promise<AdminSubscriptionQuery>
}) {
  const params = await searchParams
  const snapshot = await getAdminSubscriptionSnapshot(params)

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Subscriptions</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Subscription manager</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Monitor contract revenue, review on-chain subscribers, update plan
            pricing, and withdraw earnings from the SubscriptionManager admin
            surface.
          </p>
        </div>
      </section>

      {snapshot.readError ? (
        <Card className='border-amber-500/35 bg-amber-500/10'>
          <p className='text-sm leading-6'>{snapshot.readError}</p>
        </Card>
      ) : null}

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        <AdminMetric
          icon={WalletCards}
          label='Contract balance'
          value={snapshot.contractBalanceLabel}
        />
        <AdminMetric
          icon={Users}
          label='Tracked subscribers'
          value={`${snapshot.subscriberCount}`}
        />
        <AdminMetric
          icon={CreditCard}
          label='Base price'
          value={snapshot.basePriceLabel}
        />
        <AdminMetric
          icon={Coins}
          label='Plus price'
          value={snapshot.plusPriceLabel}
        />
        <AdminMetric
          icon={Network}
          label='Network'
          value={snapshot.chainName}
        />
      </section>

      <Card className='space-y-4'>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          Contract
        </p>
        <div className='grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center'>
          <div>
            <h2 className='font-display text-2xl'>Runtime address</h2>
            <p className='text-foreground/65 mt-2 font-mono text-xs break-all'>
              {snapshot.contractAddress ?? 'Not configured'}
            </p>
            <p className='text-foreground/55 mt-2 text-xs'>
              Chain ID {snapshot.chainId} · {snapshot.nativeTokenSymbol} ·{' '}
              {snapshot.explorerName}
            </p>
          </div>
          <div className='space-y-3'>
            {snapshot.contractExplorerUrl ? (
              <a
                href={snapshot.contractExplorerUrl}
                target='_blank'
                rel='noreferrer'
                className={buttonClasses({
                  variant: 'outline',
                  size: 'sm',
                  className: 'w-full gap-2 whitespace-nowrap'
                })}
              >
                View contract
                <ExternalLink className='h-4 w-4' aria-hidden />
              </a>
            ) : null}
            <div className='bg-muted rounded-lg p-4 text-sm'>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Admin methods
              </p>
              <p className='mt-2 font-semibold'>
                {snapshot.supportsTreasuryWithdraw
                  ? 'Subscriber registry and withdrawals ready'
                  : 'Deployment upgrade required'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <AdminSubscriptionActions
        contractAddress={snapshot.contractAddress}
        basePriceNative={formatNativePriceInput(snapshot.basePriceWei)}
        plusPriceNative={formatNativePriceInput(snapshot.plusPriceWei)}
        supportsTreasuryWithdraw={snapshot.supportsTreasuryWithdraw}
      />

      <AdminSubscriptionsTable
        subscribers={snapshot.subscribers}
        total={snapshot.subscriberCount}
        page={snapshot.page}
        pageSize={snapshot.pageSize}
        pageCount={snapshot.pageCount}
      />
    </div>
  )
}

function AdminMetric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof WalletCards
  label: string
  value: string
}) {
  return (
    <Card className='relative overflow-hidden'>
      <div className='bg-accent absolute top-0 left-0 h-1 w-full' />
      <Icon className='text-accent h-5 w-5' aria-hidden />
      <p className='text-foreground/60 mt-4 text-xs tracking-[0.16em] uppercase'>
        {label}
      </p>
      <p className='mt-2 text-2xl font-semibold break-words'>{value}</p>
    </Card>
  )
}
