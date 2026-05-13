import Link from 'next/link'

import { Bot, ExternalLink } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import {
  getOrderMetrics,
  listMarketplaceOrders
} from '@/features/marketplace/orders'
import { orderStatusLabels } from '@/features/marketplace/status'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type OrdersPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams
  const metrics = await getOrderMetrics()
  const marketplaceOrders = await listMarketplaceOrders()
  const state = resolveServerTableState(params, {
    defaultSort: 'updatedAt',
    defaultPageSize: 10
  })
  const table = queryServerRows(marketplaceOrders, state, {
    searchText: order =>
      [
        order.id,
        order.requestId,
        order.productName,
        order.providerName,
        order.buyerWallet,
        order.status,
        order.amountUsdt
      ].join(' '),
    sortValues: {
      product: order => order.productName,
      provider: order => order.providerName,
      status: order => order.status,
      amount: order => Number(order.amountUsdt.replace(/[^0-9.]/g, '')),
      updatedAt: order => new Date(order.updatedAt)
    }
  })

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Orders</Badge>
        <div className='mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-4xl'>Orders</h1>
            <p className='text-foreground/70 text-sm leading-6'>
              Track paid API requests, provider status, and receipts with
              server-side search, sorting, and pagination.
            </p>
          </div>
          <Link
            href='/agents'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <Bot className='h-4 w-4' aria-hidden />
            Agents
          </Link>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-4'>
        {[
          ['Total orders', metrics.total.toString()],
          ['Completed', metrics.completed.toString()],
          ['Processing', metrics.processing.toString()],
          ['Payment required', metrics.paymentRequired.toString()]
        ].map(([label, value]) => (
          <div
            key={label}
            className='border-border bg-card/90 rounded-lg border p-5 shadow-sm'
          >
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              {label}
            </p>
            <p className='mt-3 text-2xl font-semibold'>{value}</p>
          </div>
        ))}
      </section>

      <ServerDataTable
        id='orders'
        rows={table.rows}
        columns={orderColumns}
        getRowId={order => order.id}
        basePath='/orders'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search orders, wallets, products, providers, or statuses'
        emptyTitle='No paid API orders have been created'
        emptyDescription='Create an order from the marketplace or run an agent.'
      />
    </div>
  )
}

const orderColumns: ServerDataTableColumn<MarketplaceOrder>[] = [
  {
    key: 'order',
    label: 'Order',
    sortKey: 'product',
    render: order => (
      <div>
        <p className='text-muted-foreground text-xs tracking-[0.14em] uppercase'>
          {order.providerName}
        </p>
        <Link
          href={`/orders/${order.id}`}
          className='mt-1 block font-semibold hover:underline'
        >
          {order.productName}
        </Link>
        <p className='text-muted-foreground mt-1 font-mono text-xs'>
          {order.requestId}
        </p>
      </div>
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
    render: order => <Badge>{orderStatusLabels[order.status]}</Badge>
  },
  {
    key: 'updated',
    label: 'Updated',
    sortKey: 'updatedAt',
    render: order => (
      <time className='text-sm' dateTime={order.updatedAt}>
        {new Date(order.updatedAt).toLocaleString()}
      </time>
    )
  },
  {
    key: 'action',
    label: 'Action',
    render: order => (
      <Link
        href={`/orders/${order.id}`}
        className={buttonClasses({ variant: 'outline', size: 'sm' })}
      >
        <ExternalLink className='h-4 w-4' aria-hidden />
        Open
      </Link>
    )
  }
]
