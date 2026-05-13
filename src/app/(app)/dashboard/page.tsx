import Link from 'next/link'

import { Bot, Gauge, Store } from 'lucide-react'

import { AccountSummary } from '@/components/dashboard/account-summary'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAgentMetrics, listAgentRuns } from '@/features/agents/store'
import {
  getFeaturedProduct,
  getMarketplaceMetrics,
  getPublishedProducts
} from '@/features/marketplace/products'
import { defaultAppChain } from '@/lib/config/chains'

export default async function DashboardPage() {
  const products = await getPublishedProducts()
  const featuredProduct = await getFeaturedProduct()
  const metrics = await getMarketplaceMetrics()
  const agentMetrics = await getAgentMetrics()
  const recentAgentRun = (await listAgentRuns())[0]

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 overflow-hidden rounded-lg border p-6'>
        <div className='grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end'>
          <div className='space-y-4'>
            <Badge>Buyer dashboard</Badge>
            <h1 className='font-display text-4xl'>Your USDT API workspace</h1>
            <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
              Browse APIs, launch agents, and track receipts from one place.
            </p>
            <div className='flex flex-col gap-3 pt-2 sm:flex-row'>
              <Link
                href='/marketplace'
                className={buttonClasses({ variant: 'primary', size: 'sm' })}
              >
                <Store className='h-4 w-4' aria-hidden />
                Browse APIs
              </Link>
              <Link
                href='/agents/new'
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <Bot className='h-4 w-4' aria-hidden />
                New agent
              </Link>
              <Link
                href='/provider'
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <Gauge className='h-4 w-4' aria-hidden />
                Provider
              </Link>
            </div>
          </div>
          <Card className='bg-background/85'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Featured API
            </p>
            <p className='mt-2 text-xl font-semibold'>
              {featuredProduct?.name ?? 'No published APIs'}
            </p>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              {featuredProduct
                ? `${featuredProduct.priceLabel} per request.`
                : 'Publish a product to make it available.'}
            </p>
          </Card>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          ['Published APIs', metrics.productCount.toString()],
          ['Recorded calls', metrics.totalCalls.toLocaleString()],
          ['USDT volume', metrics.totalRevenueUsdt],
          ['Network', defaultAppChain.shortName]
        ].map(([label, value]) => (
          <Card key={label} className='relative overflow-hidden'>
            <div className='bg-accent absolute top-0 left-0 h-1 w-full' />
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              {label}
            </p>
            <p className='mt-3 text-2xl font-semibold'>{value}</p>
          </Card>
        ))}
      </section>

      <section className='grid gap-5 xl:grid-cols-[1fr_0.8fr]'>
        <Card className='space-y-5'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Marketplace shortcuts
            </p>
            <h2 className='font-display mt-2 text-2xl'>Available APIs</h2>
          </div>
          <div className='grid gap-3'>
            {products.map(product => (
              <Link
                key={product.slug}
                href={`/marketplace/${product.slug}`}
                className='border-foreground/10 hover:border-foreground/25 rounded-lg border p-4 transition'
              >
                <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
                  <div>
                    <span className='block font-semibold'>{product.name}</span>
                    <span className='text-foreground/60 mt-1 block text-sm leading-6'>
                      {product.providerName} - {product.category}
                    </span>
                  </div>
                  <span className='text-sm font-semibold'>
                    {product.priceLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <AccountSummary />
      </section>
      <section>
        <Card className='space-y-4'>
          <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
            <div>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Autonomous agent runs
              </p>
              <h2 className='font-display mt-2 text-2xl'>
                Spend, deliver, and prove
              </h2>
            </div>
            <Link
              href='/agents/new'
              className={buttonClasses({ variant: 'primary', size: 'sm' })}
            >
              Create agent run
            </Link>
          </div>
          <div className='grid gap-3 md:grid-cols-4'>
            {[
              ['Runs', agentMetrics.totalRuns.toString()],
              ['Completed', agentMetrics.completedRuns.toString()],
              ['Proofs', agentMetrics.proofCount.toString()],
              ['Spend', `${agentMetrics.totalSpendUsdt} USDT`]
            ].map(([label, value]) => (
              <div key={label} className='bg-muted rounded-lg p-4'>
                <p className='text-foreground/60 text-xs uppercase'>{label}</p>
                <p className='mt-1 font-semibold'>{value}</p>
              </div>
            ))}
          </div>
          {recentAgentRun ? (
            <Link
              href={`/agents/${recentAgentRun.id}`}
              className='border-foreground/10 hover:border-foreground/25 block rounded-lg border p-4 transition'
            >
              <span className='block font-semibold'>
                {recentAgentRun.title}
              </span>
              <span className='text-foreground/60 mt-1 block text-sm leading-6'>
                {recentAgentRun.summary}
              </span>
            </Link>
          ) : null}
        </Card>
      </section>
    </div>
  )
}
