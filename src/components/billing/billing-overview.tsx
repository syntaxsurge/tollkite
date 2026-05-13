'use client'

import Link from 'next/link'

import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { useUserSettings } from '@/hooks/use-user-settings'
import {
  formatBpsPercent,
  subscriptionPlans
} from '@/lib/contracts/subscription'

export function BillingOverview({
  subscriptionConfigured
}: {
  subscriptionConfigured: boolean
}) {
  return (
    <WalletAddressConsumer>
      {({ address }) => (
        <BillingOverviewContent
          address={address}
          subscriptionConfigured={subscriptionConfigured}
        />
      )}
    </WalletAddressConsumer>
  )
}

function BillingOverviewContent({
  address,
  subscriptionConfigured
}: {
  address: string | null
  subscriptionConfigured: boolean
}) {
  const { settings } = useUserSettings(address)

  const plan =
    subscriptionPlans.find(item => item.key === settings.plan) ??
    subscriptionPlans[0]

  return (
    <section className='grid gap-5 lg:grid-cols-[0.9fr_1.1fr]'>
      <Card className='space-y-5'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Current plan
          </p>
          <h2 className='font-display mt-2 text-3xl'>{plan.name}</h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            {plan.description}
          </p>
        </div>
        <div className='bg-muted rounded-lg p-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Contract price
          </p>
          <p className='mt-2 text-4xl font-semibold'>{plan.priceLabel}</p>
        </div>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='border-foreground/10 rounded-lg border p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Provider share
            </p>
            <p className='mt-2 text-2xl font-semibold'>
              {formatBpsPercent(plan.providerShareBps)}
            </p>
          </div>
          <div className='border-foreground/10 rounded-lg border p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Platform fee
            </p>
            <p className='mt-2 text-2xl font-semibold'>
              {formatBpsPercent(plan.platformFeeBps)}
            </p>
          </div>
        </div>
        <div className='grid gap-3 text-sm'>
          <div className='border-foreground/10 rounded-lg border p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Billing wallet
            </p>
            <p className='mt-2 font-semibold break-all'>
              {address ?? 'Connect a wallet to assign billing ownership'}
            </p>
          </div>
          <div className='border-foreground/10 rounded-lg border p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Subscription manager
            </p>
            <p className='mt-2 font-semibold'>
              {subscriptionConfigured ? 'Configured' : 'Not configured'}
            </p>
          </div>
        </div>
        <Link
          href='/pricing'
          className={buttonClasses({
            variant: 'outline',
            className:
              'w-full text-center whitespace-normal sm:whitespace-nowrap'
          })}
        >
          Upgrade or compare plans
          <ArrowRight className='h-4 w-4' aria-hidden />
        </Link>
      </Card>

      <Card className='space-y-5'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Plan access
          </p>
          <h2 className='font-display mt-2 text-2xl'>Included features</h2>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Provider revenue share and platform fee are calculated from this
            plan on successful paid receipts.
          </p>
        </div>
        <div className='grid gap-3 text-sm'>
          {plan.included.map(feature => (
            <div key={feature} className='flex gap-3'>
              <CheckCircle2
                className='mt-0.5 h-4 w-4 shrink-0 text-emerald-400'
                aria-hidden
              />
              <span className='text-foreground/80'>{feature}</span>
            </div>
          ))}
        </div>
        <div className='border-foreground/10 rounded-lg border p-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Not included
          </p>
          {plan.excluded.length > 0 ? (
            <div className='mt-3 grid gap-3 text-sm'>
              {plan.excluded.map(feature => (
                <div key={feature} className='flex gap-3'>
                  <XCircle
                    className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0'
                    aria-hidden
                  />
                  <span className='text-muted-foreground'>{feature}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-muted-foreground mt-3 text-sm leading-6'>
              All current provider features are included in this plan.
            </p>
          )}
        </div>
      </Card>
    </section>
  )
}
