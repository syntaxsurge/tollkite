import { ExternalLink } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { type AdminSubscriptionRecord } from '@/lib/contracts/subscription-admin'

type AdminSubscriptionsTableProps = {
  subscribers: AdminSubscriptionRecord[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export function AdminSubscriptionsTable({
  subscribers,
  total,
  page,
  pageSize,
  pageCount
}: AdminSubscriptionsTableProps) {
  return (
    <Card className='space-y-5'>
      <div>
        <Badge>Subscribers</Badge>
        <h2 className='font-display mt-4 text-3xl'>Subscribed users</h2>
        <p className='text-foreground/65 mt-2 max-w-2xl text-sm leading-6'>
          The table reads a single on-chain subscriber page on the server, then
          resolves each row&apos;s live SubscriptionManager state.
        </p>
      </div>

      <ServerDataTable
        id='admin-subscriptions'
        rows={subscribers}
        columns={subscriptionColumns()}
        getRowId={subscriber => subscriber.walletAddress}
        basePath='/admin/subscriptions'
        query=''
        sort='wallet'
        dir='asc'
        page={page}
        pageSize={pageSize}
        totalRows={total}
        totalPages={pageCount}
        emptyTitle='No subscribers found'
        emptyDescription='No on-chain subscribers are available for this contract page.'
        showSearch={false}
        enableSelection={false}
      />
    </Card>
  )
}

function subscriptionColumns(): ServerDataTableColumn<AdminSubscriptionRecord>[] {
  return [
    {
      key: 'wallet',
      label: 'Wallet',
      className: 'min-w-[260px]',
      render: subscriber => (
        <p className='font-mono text-xs break-all'>
          {subscriber.walletAddress}
        </p>
      )
    },
    {
      key: 'plan',
      label: 'Plan',
      render: subscriber => subscriber.planName
    },
    {
      key: 'status',
      label: 'Status',
      render: subscriber => (
        <span className='bg-muted text-foreground rounded-full px-2.5 py-1 text-xs font-semibold'>
          {subscriber.active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'paidUntil',
      label: 'Paid until',
      className: 'min-w-[180px]',
      render: subscriber => formatDate(subscriber.paidUntil)
    },
    {
      key: 'autoRenew',
      label: 'Auto renew',
      render: subscriber => (subscriber.autoRenew ? 'Enabled' : 'Disabled')
    },
    {
      key: 'canceled',
      label: 'Canceled',
      className: 'min-w-[180px]',
      render: subscriber => formatDate(subscriber.canceledAt)
    },
    {
      key: 'explorer',
      label: 'Explorer',
      render: subscriber => (
        <a
          href={subscriber.walletExplorerUrl}
          target='_blank'
          rel='noreferrer'
          className={buttonClasses({
            variant: 'outline',
            size: 'sm',
            className: 'gap-2 whitespace-nowrap'
          })}
        >
          View wallet
          <ExternalLink className='h-4 w-4' aria-hidden />
        </a>
      )
    }
  ]
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Never'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}
