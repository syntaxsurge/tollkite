import { cookies } from 'next/headers'
import Link from 'next/link'

import { ExternalLink, Plus, Settings } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import {
  type ApiProduct,
  type ApiProductStatus,
  getProviderOwnedProducts
} from '@/features/marketplace/products'
import { productStatusLabels } from '@/features/marketplace/status'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

type ProviderProductsPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function ProviderProductsPage({
  searchParams
}: ProviderProductsPageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const products = await getProviderOwnedProducts(ownerWallet)
  const state = resolveServerTableState(params, {
    defaultSort: 'updated',
    defaultPageSize: 10
  })
  const table = queryServerRows(products, state, {
    searchText: product =>
      [
        product.name,
        product.providerName,
        product.endpointPath,
        product.status,
        product.priceLabel,
        product.category
      ].join(' '),
    sortValues: {
      name: product => product.name,
      provider: product => product.providerName,
      status: product => product.status,
      price: product => product.priceUsd,
      calls: product => product.calls,
      updated: product => product.slug
    }
  })

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Provider products</Badge>
        <div className='mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-4xl'>API product management</h1>
            <p className='text-foreground/70 text-sm leading-6'>
              Publish, pause, test, inspect, and bulk-manage provider-created
              listings from one paginated table.
            </p>
          </div>
          <Link
            href='/provider/products/new'
            className={buttonClasses({ size: 'sm' })}
          >
            <Plus className='h-4 w-4' aria-hidden />
            Create product
          </Link>
        </div>
      </section>

      <ServerDataTable
        id='provider-products'
        rows={table.rows}
        columns={productColumns()}
        getRowId={product => product.slug}
        basePath='/provider/products'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search listings, providers, endpoints, statuses, or categories'
        emptyTitle='No API products yet'
        emptyDescription='Create a listing to expose an external API through the gateway.'
        bulkActions={[
          {
            label: 'Delete selected',
            endpoint: '/api/providers/self/products/bulk-delete',
            confirmMessage:
              'Delete selected provider-created products? Default admin-owned products remain available unless removed by an admin.'
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
          <div className='flex flex-wrap items-center gap-2'>
            <Link
              href={`/provider/products/${product.slug}`}
              className='font-semibold hover:underline'
            >
              {product.name}
            </Link>
            <StatusPill status={product.status} />
          </div>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {product.endpointPath}
          </p>
          <p className='text-muted-foreground mt-2 text-sm leading-6'>
            {getProductNextStep(product.status)}
          </p>
        </div>
      )
    },
    {
      key: 'price',
      label: 'Price',
      sortKey: 'price',
      render: product => <p className='font-semibold'>{product.priceLabel}</p>
    },
    {
      key: 'calls',
      label: 'Calls',
      sortKey: 'calls',
      render: product => <p className='font-semibold'>{product.calls}</p>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: product => (
        <div className='flex flex-wrap gap-2'>
          <Link
            href={`/provider/products/${product.slug}`}
            className={buttonClasses({ size: 'sm' })}
          >
            <Settings className='h-4 w-4' aria-hidden />
            Manage
          </Link>
          <Link
            href={`/marketplace/${product.slug}`}
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink className='h-4 w-4' aria-hidden />
            Listing
          </Link>
        </div>
      )
    }
  ]
}

function StatusPill({ status }: { status: ApiProductStatus }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold',
        status === 'published' &&
          'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        status === 'draft' &&
          'border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
        status === 'paused' &&
          'border-foreground/15 bg-muted text-foreground/70'
      )}
    >
      {productStatusLabels[status]}
    </span>
  )
}

function getProductNextStep(status: ApiProductStatus) {
  if (status === 'published') {
    return 'Live for marketplace buyers. Open management to run a paid test or pause the listing.'
  }

  if (status === 'paused') {
    return 'Hidden from buyers. Open management to republish when the provider endpoint is ready.'
  }

  return 'Drafts are private. Open management, run a payable test, then publish when the flow works.'
}
