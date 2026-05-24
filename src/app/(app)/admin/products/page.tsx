import Link from 'next/link'

import { Boxes, CircleDollarSign, PlugZap, Users } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { WalletOwnerCard } from '@/components/data-display/wallet-owner-card'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type ApiProduct,
  getAllProducts
} from '@/features/marketplace/products'
import { productStatusLabels } from '@/features/marketplace/status'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type AdminProductsPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function AdminProductsPage({
  searchParams
}: AdminProductsPageProps) {
  const params = await searchParams
  const products = await getAllProducts()
  const state = resolveServerTableState(params, {
    defaultSort: 'calls',
    defaultPageSize: 10
  })
  const table = queryServerRows(products, state, {
    searchText: product =>
      [
        product.name,
        product.providerName,
        product.ownerWallet ?? '',
        product.providerWallet,
        product.status,
        product.category,
        product.priceLabel,
        product.endpointPath
      ].join(' '),
    sortValues: {
      name: product => product.name,
      provider: product => product.providerName,
      owner: product => product.ownerWallet ?? '',
      status: product => product.status,
      price: product => product.priceUsd,
      calls: product => product.calls,
      revenue: product => Number(product.revenueUsdt)
    }
  })
  const publishedCount = products.filter(
    product => product.status === 'published'
  ).length
  const ownerCount = new Set(
    products.map(product => product.ownerWallet).filter(Boolean)
  ).size
  const totalRevenue = products.reduce(
    (sum, product) => sum + Number(product.revenueUsdt),
    0
  )
  const totalCalls = products.reduce((sum, product) => sum + product.calls, 0)

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Product moderation</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>API listing control</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Review every admin-owned and provider-created API, who owns it,
            where payouts go, usage volume, revenue, status, and agent
            readiness.
          </p>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Total products',
            value: products.length.toLocaleString(),
            detail: `${publishedCount} published`,
            icon: Boxes
          },
          {
            label: 'Product owners',
            value: ownerCount.toLocaleString(),
            detail: 'Wallet-owned listings',
            icon: Users
          },
          {
            label: 'Gateway calls',
            value: totalCalls.toLocaleString(),
            detail: 'Buyer and agent requests',
            icon: PlugZap
          },
          {
            label: 'Provider revenue',
            value: `${totalRevenue.toFixed(2)} PYUSD`,
            detail: 'Released provider share',
            icon: CircleDollarSign
          }
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
            <Icon className='text-primary h-5 w-5' aria-hidden />
            <p className='text-foreground/60 mt-4 text-xs tracking-[0.16em] uppercase'>
              {label}
            </p>
            <p className='mt-2 text-2xl font-semibold'>{value}</p>
            <p className='text-foreground/60 mt-1 text-sm'>{detail}</p>
          </Card>
        ))}
      </section>

      <ServerDataTable
        id='admin-products'
        rows={table.rows}
        columns={productColumns()}
        getRowId={product => product.slug}
        basePath='/admin/products'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search products, owners, providers, endpoints, statuses, or categories'
        emptyTitle='No API listings found'
        emptyDescription='Admin-owned and provider-created API products appear here.'
        enableSelection
        bulkActions={[
          {
            label: 'Delete selected',
            endpoint: '/api/admin/products/bulk-delete',
            confirmMessage:
              'Delete selected provider-created products? Built-in public data APIs are ignored.'
          }
        ]}
      />
    </div>
  )
}

function productColumns(): ServerDataTableColumn<ApiProduct>[] {
  return [
    {
      key: 'product',
      label: 'Product',
      sortKey: 'name',
      render: product => (
        <div>
          <Link
            href={`/provider/products/${product.slug}`}
            className='font-semibold hover:underline'
          >
            {product.name}
          </Link>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {product.endpointPath}
          </p>
        </div>
      )
    },
    {
      key: 'owner',
      label: 'Owner',
      sortKey: 'owner',
      render: product => (
        <div className='space-y-2'>
          <WalletOwnerCard
            walletAddress={product.ownerWallet ?? product.providerWallet}
            displayName={product.providerName}
            compact
          />
          <p className='text-muted-foreground text-xs'>
            Payout {shorten(product.providerWallet)}
          </p>
        </div>
      )
    },
    {
      key: 'provider',
      label: 'Provider',
      sortKey: 'provider',
      render: product => (
        <div>
          <p className='font-semibold'>{product.providerName}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {product.category} - {product.priceLabel}
          </p>
        </div>
      )
    },
    {
      key: 'usage',
      label: 'Usage',
      sortKey: 'calls',
      render: product => (
        <div>
          <p className='font-semibold'>{product.calls} calls</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {product.revenueUsdt} PYUSD earned
          </p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: product => (
        <div>
          <p className='font-semibold'>{productStatusLabels[product.status]}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {product.isAgentReady ? 'Agent-ready' : 'Manual only'}
          </p>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: product => (
        <Link
          href={`/marketplace/${product.slug}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          View listing
        </Link>
      )
    }
  ]
}

function shorten(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}
