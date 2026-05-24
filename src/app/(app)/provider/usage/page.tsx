import { cookies } from 'next/headers'
import Link from 'next/link'

import { Activity, CircleDollarSign, Clock3, ReceiptText } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getProviderDashboardMetrics,
  getProviderOrders,
  getProviderPublishedProducts
} from '@/features/marketplace/products'
import { orderStatusLabels } from '@/features/marketplace/status'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type ProviderUsagePageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function ProviderUsagePage({
  searchParams
}: ProviderUsagePageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const ownerWallet = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value
  const products = await getProviderPublishedProducts(ownerWallet)
  const metrics = await getProviderDashboardMetrics(ownerWallet)
  const orders = await getProviderOrders(ownerWallet)
  const state = resolveServerTableState(params, {
    defaultSort: 'updated',
    defaultPageSize: 10
  })
  const table = queryServerRows(orders, state, {
    searchText: order =>
      [
        order.id,
        order.requestId,
        order.productName,
        order.providerName,
        order.buyerWallet,
        order.amountUsdt,
        order.status,
        order.agentRunId ?? ''
      ].join(' '),
    sortValues: {
      product: order => order.productName,
      amount: order => parseUsdt(order.amountUsdt),
      status: order => order.status,
      updated: order => order.updatedAt,
      created: order => order.createdAt
    }
  })

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Usage analytics</Badge>
        <div className='mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-4xl'>API calls and revenue</h1>
            <p className='text-foreground/70 text-sm leading-6'>
              Track every payable request across browser checkout, external
              integrations, managed credits, and autonomous agent runs.
            </p>
          </div>
          <Link
            href='/provider/products'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Manage products
          </Link>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Provider earnings',
            value: `${metrics.providerRevenueUsdt} PYUSD`,
            detail: 'Released provider share',
            icon: CircleDollarSign
          },
          {
            label: 'Call history',
            value: metrics.orderCount.toLocaleString(),
            detail: `${metrics.processingCalls} processing`,
            icon: Activity
          },
          {
            label: 'Completed',
            value: metrics.completedCalls.toLocaleString(),
            detail: metrics.successRate,
            icon: ReceiptText
          },
          {
            label: 'Products',
            value: products.length.toLocaleString(),
            detail: 'Published listings',
            icon: Clock3
          }
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label}>
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

      <ServerDataTable
        id='provider-usage'
        rows={table.rows}
        columns={usageColumns()}
        getRowId={order => order.id}
        basePath='/provider/usage'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search request IDs, products, buyers, statuses, or agent runs'
        emptyTitle='No payable API calls yet'
        emptyDescription='Orders from browser checkout, API clients, managed credits, and agents appear here after a payable request is created.'
        enableSelection={false}
      />
    </div>
  )
}

function usageColumns(): ServerDataTableColumn<MarketplaceOrder>[] {
  return [
    {
      key: 'request',
      label: 'Request',
      sortKey: 'created',
      render: order => (
        <div>
          <Link
            href={`/orders/${order.id}`}
            className='font-semibold hover:underline'
          >
            {order.requestId}
          </Link>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {order.id}
          </p>
          {order.agentRunId ? (
            <p className='text-primary mt-2 text-xs font-semibold'>
              Agent-paid action
            </p>
          ) : null}
        </div>
      )
    },
    {
      key: 'product',
      label: 'Product',
      sortKey: 'product',
      render: order => (
        <div>
          <p className='font-semibold'>{order.productName}</p>
          <p className='text-muted-foreground mt-2 text-sm'>
            {order.providerName}
          </p>
        </div>
      )
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: order => (
        <p className='font-mono text-sm break-all'>{order.buyerWallet}</p>
      )
    },
    {
      key: 'amount',
      label: 'Amount',
      sortKey: 'amount',
      render: order => <p className='font-semibold'>{order.amountUsdt}</p>
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: order => (
        <div>
          <p className='font-semibold'>{orderStatusLabels[order.status]}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {new Date(order.updatedAt).toLocaleString()}
          </p>
        </div>
      )
    }
  ]
}

function parseUsdt(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}
