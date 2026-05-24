import Link from 'next/link'

import { Bot, ExternalLink, Play, Sparkles } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { ServerDataTableNavButton } from '@/components/data-display/server-data-table-nav-button'
import { WalletOwnerCard } from '@/components/data-display/wallet-owner-card'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import {
  type ApiProduct,
  getMarketplaceMetrics,
  getPublishedProducts
} from '@/features/marketplace/products'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

type MarketplacePageProps = {
  searchParams?: Promise<{
    category?: string
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function MarketplacePage({
  searchParams
}: MarketplacePageProps) {
  const params = await searchParams
  const products = await getPublishedProducts()
  const metrics = await getMarketplaceMetrics()
  const categories = Array.from(
    new Set(products.map(product => product.category))
  )
  const category = params?.category?.trim() ?? ''
  const state = resolveServerTableState(params, {
    defaultSort: 'name',
    defaultDir: 'asc',
    defaultPageSize: 10
  })
  const filteredProducts = category
    ? products.filter(product => product.category === category)
    : products
  const table = queryServerRows(filteredProducts, state, {
    searchText: product =>
      [
        product.name,
        product.providerName,
        product.description,
        product.category,
        product.priceLabel,
        product.executionMode,
        product.resultDelivery
      ].join(' '),
    sortValues: {
      name: product => product.name,
      provider: product => product.providerName,
      category: product => product.category,
      price: product => product.priceUsd,
      calls: product => product.calls
    }
  })

  return (
    <div className='space-y-6'>
      <section className='border-foreground/10 bg-card/90 overflow-hidden rounded-lg border p-5 shadow-sm'>
        <div className='flex flex-col justify-between gap-5 xl:flex-row xl:items-start'>
          <div className='min-w-0 space-y-3'>
            <Badge>Marketplace</Badge>
            <div className='space-y-2'>
              <h1 className='font-display text-3xl leading-tight sm:text-4xl'>
                Find paid APIs faster.
              </h1>
              <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
                Shop paid APIs from real creators, developers, and provider
                teams. Every listing shows the creator identity, wallet, price,
                and payment flow before you run it.
              </p>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-3 xl:w-[34rem]'>
            {[
              ['APIs', metrics.productCount.toString()],
              ['Calls', metrics.totalCalls.toLocaleString()],
              ['PYUSD', metrics.totalRevenueUsdt]
            ].map(([label, value]) => (
              <div
                key={label}
                className='border-border bg-background/70 rounded-lg border p-4'
              >
                <p className='text-foreground/60 text-xs font-semibold uppercase'>
                  {label}
                </p>
                <p className='mt-1 text-2xl font-semibold'>{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className='mt-5 flex flex-wrap gap-2'>
          <CategoryLink active={!category} href='/marketplace'>
            <Sparkles className='h-4 w-4' aria-hidden />
            All
          </CategoryLink>
          {categories.map(categoryName => (
            <CategoryLink
              key={categoryName}
              active={category === categoryName}
              href={`/marketplace?category=${encodeURIComponent(categoryName)}`}
            >
              {categoryName}
            </CategoryLink>
          ))}
        </div>
      </section>

      <ServerDataTable
        id='marketplace-products'
        rows={table.rows}
        columns={productColumns}
        getRowId={product => product.slug}
        basePath='/marketplace'
        preserveParams={{ category }}
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search APIs, providers, categories, or delivery modes'
        emptyTitle='No APIs match this view'
        emptyDescription='Clear the search or choose another category.'
      />
    </div>
  )
}

const productColumns: ServerDataTableColumn<ApiProduct>[] = [
  {
    key: 'product',
    label: 'Product',
    sortKey: 'name',
    render: product => (
      <div>
        <div className='flex flex-wrap items-center gap-2'>
          <Link
            href={`/marketplace/${product.slug}`}
            className='font-semibold hover:underline'
          >
            {product.name}
          </Link>
          {product.isAgentReady ? <Badge>Agent-ready</Badge> : null}
        </div>
        <p className='text-muted-foreground mt-1 line-clamp-2 max-w-2xl text-sm leading-6'>
          {product.description}
        </p>
      </div>
    )
  },
  {
    key: 'provider',
    label: 'Creator',
    sortKey: 'provider',
    render: product => (
      <WalletOwnerCard
        walletAddress={product.ownerWallet ?? product.providerWallet}
        displayName={product.providerName}
        compact
      />
    )
  },
  {
    key: 'price',
    label: 'Price',
    sortKey: 'price',
    render: product => <p className='font-semibold'>{product.priceLabel}</p>
  },
  {
    key: 'mode',
    label: 'Mode',
    render: product => (
      <div className='text-sm'>
        <p className='font-semibold capitalize'>{product.executionMode}</p>
        <p className='text-muted-foreground mt-1 capitalize'>
          {product.resultDelivery.replaceAll('_', ' ')}
        </p>
      </div>
    )
  },
  {
    key: 'actions',
    label: 'Actions',
    render: product => (
      <div className='flex flex-wrap gap-2'>
        <Link
          href={`/orders/new?product=${product.slug}`}
          className={buttonClasses({ size: 'sm' })}
        >
          <Play className='h-4 w-4' aria-hidden />
          Run
        </Link>
        <Link
          href={`/agents/new?tool=${product.slug}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          <Bot className='h-4 w-4' aria-hidden />
          Agent
        </Link>
        <Link
          href={`/marketplace/${product.slug}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          <ExternalLink className='h-4 w-4' aria-hidden />
          Details
        </Link>
      </div>
    )
  }
]

function CategoryLink({
  href,
  active,
  children
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <ServerDataTableNavButton
      href={href}
      className={cn(
        'border-border bg-card hover:border-brand-cyan/60 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition',
        active && 'border-primary bg-primary text-primary-foreground'
      )}
    >
      {children}
    </ServerDataTableNavButton>
  )
}
