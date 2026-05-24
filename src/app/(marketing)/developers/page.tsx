import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  defaultAppChain,
  defaultX402FacilitatorUrl,
  paymentTokenSymbol,
  x402Network
} from '@/lib/config/chains'

export default function DevelopersPage() {
  const steps = [
    {
      title: 'List an API',
      detail: 'Add metadata, schemas, price, and upstream endpoint.'
    },
    {
      title: 'Protect the call',
      detail: 'Return HTTP 402 until the PYUSD payment is valid.'
    },
    {
      title: 'Use x402 directly',
      detail: 'Call the hosted endpoint with an x402 buyer client.'
    },
    {
      title: 'Use credits',
      detail: 'Top up once, then debit usage from a managed balance.'
    },
    {
      title: 'Forward the request',
      detail: 'Forward paid requests and return provider responses.'
    },
    {
      title: 'Serve agents',
      detail: 'Let agents select, pay for, and prove tool calls.'
    },
    {
      title: 'Record the receipt',
      detail: 'Store wallet, amount, transaction, and request details.'
    }
  ]

  return (
    <div className='bg-app-grid min-h-screen'>
      <section className='mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_0.8fr] lg:items-center'>
        <div className='space-y-6'>
          <Badge>Developers</Badge>
          <h1 className='font-display max-w-3xl text-4xl leading-tight sm:text-5xl'>
            Build paid tools for agents.
          </h1>
          <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
            Add a listing, protect it with x402, forward requests, and keep
            receipts on Kite.
          </p>
          <div className='flex flex-col gap-3 sm:flex-row'>
            <Link href='/marketplace' className={buttonClasses({ size: 'sm' })}>
              Explore APIs
            </Link>
            <Link
              href='/agents'
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Agents
            </Link>
            <Link
              href='/developers/docs'
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Docs
            </Link>
          </div>
        </div>
        <Card className='space-y-4'>
          {[
            ['Network', x402Network],
            ['Stablecoin', paymentTokenSymbol],
            ['Gas currency', defaultAppChain.nativeCurrency.symbol],
            ['Facilitator', defaultX402FacilitatorUrl]
          ].map(([label, value]) => (
            <div key={label}>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                {label}
              </p>
              <p className='mt-1 text-sm font-semibold break-words'>{value}</p>
            </div>
          ))}
        </Card>
      </section>

      <section className='mx-auto w-full max-w-6xl px-6 pb-16'>
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {steps.map(step => (
            <Card key={step.title} className='min-h-52'>
              <h2 className='font-display text-xl'>{step.title}</h2>
              <p className='text-foreground/65 mt-4 text-sm leading-6'>
                {step.detail}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
