import { cookies } from 'next/headers'
import Link from 'next/link'

import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  PackageSearch,
  Plus,
  Receipt,
  TrendingUp
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAgentMetrics } from '@/features/agents/store'
import {
  getProviderDashboardMetrics,
  getProviderOrders,
  getProviderPublishedProducts
} from '@/features/marketplace/products'
import { resolveProviderFeeSplit } from '@/features/marketplace/provider-fees'
import { orderStatusLabels } from '@/features/marketplace/status'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'

export default async function ProviderPage() {
  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const products = await getProviderPublishedProducts(ownerWallet)
  const feeSplit = await resolveProviderFeeSplit({
    ownerWallet,
    providerWallet: ownerWallet ?? ''
  })
  const providerMetrics = await getProviderDashboardMetrics(ownerWallet)
  const agentMetrics = await getAgentMetrics()
  const orders = await getProviderOrders(ownerWallet)
  const topProduct = products
    .slice()
    .sort((a, b) => Number(b.revenueUsdt) - Number(a.revenueUsdt))[0]

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 overflow-hidden rounded-lg border p-6'>
        <div className='grid gap-6 lg:grid-cols-[1fr_320px] lg:items-end'>
          <div className='space-y-4'>
            <Badge>Provider dashboard</Badge>
            <h1 className='font-display text-4xl'>
              Sell APIs with USDT settlement.
            </h1>
            <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
              Manage listings, usage, revenue, and gateway health.
            </p>
            <div className='flex flex-col gap-3 pt-2 sm:flex-row'>
              <Link
                href='/provider/products'
                className={buttonClasses({ variant: 'primary', size: 'sm' })}
              >
                <PackageSearch className='h-4 w-4' aria-hidden />
                Products
              </Link>
              <Link
                href='/provider/usage'
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <BarChart3 className='h-4 w-4' aria-hidden />
                Usage
              </Link>
              <Link
                href='/provider/products/new'
                className={buttonClasses({ variant: 'outline', size: 'sm' })}
              >
                <Plus className='h-4 w-4' aria-hidden />
                Create product
              </Link>
            </div>
          </div>
          <Card className='bg-background/85'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Top product
            </p>
            <p className='mt-2 text-xl font-semibold'>
              {topProduct?.name ?? 'No published APIs'}
            </p>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              {topProduct
                ? `${topProduct.revenueUsdt} USDT recorded across ${topProduct.calls} calls.`
                : 'Publish a product to start earning.'}
            </p>
          </Card>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Provider earnings',
            value: `${providerMetrics.providerRevenueUsdt} USDT`,
            detail: 'Released provider payout share',
            icon: CircleDollarSign
          },
          {
            label: 'Total API calls',
            value: providerMetrics.orderCount.toLocaleString(),
            detail: `${providerMetrics.completedCalls} completed, ${providerMetrics.processingCalls} in progress`,
            icon: Activity
          },
          {
            label: 'Agent runs',
            value: agentMetrics.totalRuns.toString(),
            detail: `${agentMetrics.totalSpendUsdt} USDT agent spend`,
            icon: Receipt
          },
          {
            label: 'Success rate',
            value: providerMetrics.successRate,
            detail: `${providerMetrics.failedCalls} failed calls tracked`,
            icon: TrendingUp
          }
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className='relative overflow-hidden'>
            <div className='bg-accent absolute top-0 left-0 h-1 w-full' />
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  {label}
                </p>
                <p className='mt-3 text-2xl font-semibold'>{value}</p>
                <p className='text-foreground/60 mt-2 text-sm'>{detail}</p>
              </div>
              <span className='bg-primary/10 text-primary rounded-lg p-2'>
                <Icon className='h-5 w-5' aria-hidden />
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className='grid gap-5 xl:grid-cols-[1.15fr_0.85fr]'>
        <Card className='space-y-5'>
          <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
            <div>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                API products
              </p>
              <h2 className='font-display mt-2 text-2xl'>
                Listings and revenue
              </h2>
            </div>
            <Link
              href='/provider/products'
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Manage all
              <ArrowRight className='h-4 w-4' aria-hidden />
            </Link>
          </div>
          <div className='grid gap-3'>
            {products.length === 0 ? (
              <div className='bg-muted rounded-lg p-4'>
                <p className='font-semibold'>No API listings yet</p>
                <p className='text-foreground/65 mt-2 text-sm leading-6'>
                  Add an external API from product management to make it
                  discoverable in the marketplace.
                </p>
              </div>
            ) : null}
            {products.map(product => (
              <Link
                key={product.slug}
                href={`/marketplace/${product.slug}`}
                className='border-foreground/10 hover:border-foreground/25 grid gap-4 rounded-lg border p-4 transition lg:grid-cols-[1fr_100px_130px_110px]'
              >
                <div>
                  <p className='font-semibold'>{product.name}</p>
                  <p className='text-foreground/60 mt-1 text-sm'>
                    {product.providerName} - {product.priceLabel}
                  </p>
                </div>
                <div>
                  <p className='text-foreground/60 text-xs uppercase'>Calls</p>
                  <p className='font-semibold'>{product.calls}</p>
                </div>
                <div>
                  <p className='text-foreground/60 text-xs uppercase'>
                    Earnings
                  </p>
                  <p className='font-semibold'>{product.revenueUsdt} USDT</p>
                </div>
                <div>
                  <p className='text-foreground/60 text-xs uppercase'>
                    Success
                  </p>
                  <p className='font-semibold'>{product.successRate}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className='space-y-5'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Settlement ledger
            </p>
            <h2 className='font-display mt-2 text-2xl'>Revenue split</h2>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              Paid calls and agent actions roll into the same provider ledger.
            </p>
          </div>
          <div className='grid gap-3'>
            {[
              ['Gross volume', `${providerMetrics.grossVolumeUsdt} USDT`],
              [
                'Provider earned',
                `${providerMetrics.providerRevenueUsdt} USDT`
              ],
              ['Platform fees', `${providerMetrics.platformFeeUsdt} USDT`],
              ['Current split', feeSplit.providerShareLabel]
            ].map(([label, value]) => (
              <div key={label} className='bg-muted rounded-lg p-4'>
                <p className='text-foreground/60 text-xs uppercase'>{label}</p>
                <p className='mt-1 font-semibold'>{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <Card className='space-y-5'>
          <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
            <div>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Recent orders
              </p>
              <h2 className='font-display mt-2 text-2xl'>
                Paid request activity
              </h2>
            </div>
            <Link
              href='/provider/usage'
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              View usage
              <ArrowRight className='h-4 w-4' aria-hidden />
            </Link>
          </div>
          <div className='grid gap-3'>
            {orders.length > 0 ? (
              orders.slice(0, 5).map(order => (
                <Link
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className='border-foreground/10 hover:border-foreground/25 grid gap-4 rounded-lg border p-4 transition md:grid-cols-[1fr_140px_130px]'
                >
                  <div>
                    <p className='font-semibold'>{order.productName}</p>
                    <div className='text-foreground/60 mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs'>
                      <span>{order.requestId}</span>
                      {order.agentRunId ? <span>Agent run</span> : null}
                    </div>
                  </div>
                  <div>
                    <p className='text-foreground/60 text-xs uppercase'>
                      Amount
                    </p>
                    <p className='font-semibold'>{order.amountUsdt}</p>
                  </div>
                  <div>
                    <p className='text-foreground/60 text-xs uppercase'>
                      Status
                    </p>
                    <p className='font-semibold'>
                      {orderStatusLabels[order.status]}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className='bg-muted rounded-lg p-4'>
                <p className='font-semibold'>No paid requests yet</p>
                <p className='text-foreground/65 mt-2 text-sm leading-6'>
                  Settled x402 orders will appear here after buyers or agents
                  call provider listings.
                </p>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  )
}
