import Link from 'next/link'

import { Activity, Bot, CircleDollarSign, TriangleAlert } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listMarketplaceOrders } from '@/features/marketplace/orders'
import { orderStatusLabels } from '@/features/marketplace/status'
import type { MarketplaceOrder } from '@/features/marketplace/types'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type AdminOrdersPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function AdminOrdersPage({
  searchParams
}: AdminOrdersPageProps) {
  const params = await searchParams
  const state = resolveServerTableState(params, {
    defaultSort: 'updated',
    defaultPageSize: 10
  })
  const marketplaceOrders = await listMarketplaceOrders()
  const table = queryServerRows(marketplaceOrders, state, {
    searchText: order =>
      [
        order.id,
        order.requestId,
        order.productName,
        order.providerName,
        order.buyerWallet,
        order.providerWallet ?? '',
        order.status,
        order.amountUsdt,
        order.agentRunId ?? ''
      ].join(' '),
    sortValues: {
      product: order => order.productName,
      provider: order => order.providerName,
      amount: order => parseUsdt(order.amountUsdt),
      status: order => order.status,
      updated: order => order.updatedAt,
      created: order => order.createdAt
    }
  })
  const agentOrders = marketplaceOrders.filter(order => order.agentRunId).length
  const failedOrders = marketplaceOrders.filter(
    order => order.status === 'failed'
  ).length
  const volume = marketplaceOrders.reduce(
    (sum, order) => sum + parseUsdt(order.amountUsdt),
    0
  )

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Order operations</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>API request supervision</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Inspect buyer and agent-created requests, provider routing,
            settlement amounts, request IDs, and current lifecycle states.
          </p>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Total orders',
            value: marketplaceOrders.length.toLocaleString(),
            detail: 'All gateway requests',
            icon: Activity
          },
          {
            label: 'Agent orders',
            value: agentOrders.toLocaleString(),
            detail: 'Autonomous paid actions',
            icon: Bot
          },
          {
            label: 'Quoted volume',
            value: `${volume.toFixed(2)} USDT`,
            detail: 'Order amounts',
            icon: CircleDollarSign
          },
          {
            label: 'Failures',
            value: failedOrders.toLocaleString(),
            detail: 'Provider or payment failures',
            icon: TriangleAlert
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
        id='admin-orders'
        rows={table.rows}
        columns={orderColumns()}
        getRowId={order => order.id}
        basePath='/admin/orders'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search orders, request IDs, products, providers, wallets, statuses, or agent runs'
        emptyTitle='No gateway orders yet'
        emptyDescription='Buyer, API-key, and autonomous agent orders appear here.'
        enableSelection
        bulkActions={[
          {
            label: 'Delete selected',
            endpoint: '/api/admin/orders/bulk-delete',
            confirmMessage:
              'Delete the selected order records from the admin ledger?'
          }
        ]}
      />
    </div>
  )
}

function orderColumns(): ServerDataTableColumn<MarketplaceOrder>[] {
  return [
    {
      key: 'order',
      label: 'Order',
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
              Agent run {shorten(order.agentRunId)}
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
          <p className='text-muted-foreground mt-2 text-xs'>
            {order.providerName}
          </p>
        </div>
      )
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: order => (
        <p className='font-mono text-xs break-all'>{order.buyerWallet}</p>
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
    },
    {
      key: 'actions',
      label: 'Actions',
      render: order => (
        <Link
          href={`/orders/${order.id}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          Inspect
        </Link>
      )
    }
  ]
}

function parseUsdt(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function shorten(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`
}
