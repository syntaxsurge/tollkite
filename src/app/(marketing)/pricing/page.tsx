import Link from 'next/link'

import {
  BadgePercent,
  CheckCircle2,
  CircleDollarSign,
  ReceiptText,
  WalletCards,
  XCircle
} from 'lucide-react'

import { SubscriptionCheckout } from '@/components/billing/subscription-checkout'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  formatBpsPercent,
  subscriptionPlans
} from '@/lib/contracts/subscription'

const splitSteps = [
  {
    icon: WalletCards,
    title: 'Buyer pays the listed price',
    description:
      'The API card shows the USDT amount before the buyer or agent runs the call.'
  },
  {
    icon: ReceiptText,
    title: 'the gateway records the receipt',
    description:
      'Successful paid calls store the amount, provider plan, platform fee, provider amount, and transaction link.'
  },
  {
    icon: CircleDollarSign,
    title: 'Provider keeps the tier share',
    description:
      'Free keeps 95%, Base keeps 97%, and Plus keeps 99% of successful paid calls.'
  }
]

const faqs = [
  {
    question: 'Who are paid plans for?',
    answer:
      'Paid plans are mainly for providers. Buyers can browse, pay per API call, and use receipts without subscribing.'
  },
  {
    question: 'Do failed calls count as provider earnings?',
    answer:
      'No. Failed, unpaid, refunded, and unsettled calls are excluded from provider earnings and platform fee totals.'
  },
  {
    question: 'Do autonomous agent calls use the same split?',
    answer:
      'Yes. Agent runs pay the same listed API price, and successful receipts use the provider plan tied to that API owner.'
  },
  {
    question: 'How are provider payouts calculated?',
    answer:
      'the gateway reads the provider plan, applies the tier fee split to successful receipts, and shows provider amount plus platform fee in the ledger.'
  }
]

export default function PricingPage() {
  return (
    <div className='bg-app-grid'>
      <section className='mx-auto w-full max-w-6xl px-6 py-16 sm:py-20'>
        <div className='max-w-3xl space-y-5'>
          <Badge className='w-fit'>
            <BadgePercent className='h-3.5 w-3.5' aria-hidden />
            Provider pricing
          </Badge>
          <h1 className='font-display text-4xl leading-tight font-semibold text-balance sm:text-5xl lg:text-6xl'>
            Earn more as your API business grows.
          </h1>
          <p className='text-muted-foreground max-w-2xl text-base leading-7'>
            List APIs for free, then upgrade when lower platform fees, stronger
            analytics, and better provider visibility matter. Buyers still pay
            the listed USDT price. Your plan controls the provider share after
            successful settlement.
          </p>
          <div className='flex flex-wrap gap-3'>
            <Link href='/provider/products/new' className={buttonClasses({})}>
              List an API
            </Link>
            <Link
              href='/marketplace'
              className={buttonClasses({ variant: 'outline' })}
            >
              Browse paid APIs
            </Link>
          </div>
        </div>
      </section>

      <section className='mx-auto grid w-full max-w-6xl gap-5 px-6 pb-14 lg:grid-cols-3'>
        {subscriptionPlans.map(plan => (
          <Card
            key={plan.key}
            className={
              plan.key === 'base'
                ? 'border-accent bg-panel-sheen relative overflow-hidden'
                : 'bg-card'
            }
          >
            {plan.key === 'base' ? (
              <span className='bg-accent text-accent-foreground absolute top-4 right-4 rounded-md px-2.5 py-1 text-xs font-semibold'>
                Popular
              </span>
            ) : null}
            <div className='space-y-5'>
              <div>
                <p className='text-lg font-semibold'>{plan.name}</p>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {plan.description}
                </p>
              </div>

              <div>
                <p className='font-display text-4xl'>{plan.priceLabel}</p>
                <p className='text-muted-foreground mt-2 text-sm'>
                  Best for {plan.bestFor.toLowerCase()}
                </p>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='border-border rounded-lg border p-3'>
                  <p className='text-muted-foreground text-xs tracking-[0.14em] uppercase'>
                    Provider keeps
                  </p>
                  <p className='mt-2 text-2xl font-semibold'>
                    {formatBpsPercent(plan.providerShareBps)}
                  </p>
                </div>
                <div className='border-border rounded-lg border p-3'>
                  <p className='text-muted-foreground text-xs tracking-[0.14em] uppercase'>
                    Platform fee
                  </p>
                  <p className='mt-2 text-2xl font-semibold'>
                    {formatBpsPercent(plan.platformFeeBps)}
                  </p>
                </div>
              </div>

              <SubscriptionCheckout planKey={plan.key} />
            </div>

            <div className='mt-7 grid gap-5'>
              <div>
                <p className='text-muted-foreground text-xs tracking-[0.16em] uppercase'>
                  Included
                </p>
                <ul className='mt-3 space-y-3 text-sm'>
                  {plan.included.map(feature => (
                    <li key={feature} className='flex gap-3'>
                      <CheckCircle2
                        className='mt-0.5 h-4 w-4 shrink-0 text-emerald-400'
                        aria-hidden
                      />
                      <span className='text-foreground/80'>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <p className='text-muted-foreground text-xs tracking-[0.16em] uppercase'>
                  Excluded
                </p>
                {plan.excluded.length > 0 ? (
                  <ul className='mt-3 space-y-3 text-sm'>
                    {plan.excluded.map(feature => (
                      <li key={feature} className='flex gap-3'>
                        <XCircle
                          className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0'
                          aria-hidden
                        />
                        <span className='text-muted-foreground'>{feature}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className='text-muted-foreground mt-3 text-sm leading-6'>
                    All current provider features are included.
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className='mx-auto w-full max-w-6xl px-6 pb-14'>
        <Card className='space-y-6'>
          <div className='max-w-2xl'>
            <Badge className='w-fit'>Fee split</Badge>
            <h2 className='font-display mt-4 text-3xl font-semibold'>
              Simple receipt math for every successful call.
            </h2>
            <p className='text-muted-foreground mt-3 text-sm leading-6'>
              The buyer sees one listed USDT price. the gateway records the
              provider plan on the receipt, then calculates platform fee and
              provider amount from that plan.
            </p>
          </div>

          <div className='grid gap-4 lg:grid-cols-3'>
            {splitSteps.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className='border-border bg-background/70 rounded-lg border p-4'
              >
                <Icon className='text-primary h-5 w-5' aria-hidden />
                <h3 className='mt-4 font-semibold'>{title}</h3>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className='mx-auto grid w-full max-w-6xl gap-6 px-6 pb-16 lg:grid-cols-[0.8fr_1.2fr]'>
        <div className='space-y-3'>
          <Badge className='w-fit'>FAQ</Badge>
          <h2 className='font-display text-3xl font-semibold'>
            Billing, payouts, and agent calls.
          </h2>
          <p className='text-muted-foreground text-sm leading-6'>
            the gateway only records revenue on successful paid API calls.
            Everything else stays out of provider earnings.
          </p>
        </div>
        <div className='grid gap-4'>
          {faqs.map(item => (
            <Card key={item.question} className='space-y-2'>
              <h3 className='font-semibold'>{item.question}</h3>
              <p className='text-muted-foreground text-sm leading-6'>
                {item.answer}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
