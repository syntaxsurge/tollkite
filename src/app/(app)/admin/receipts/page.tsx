import Link from 'next/link'

import { CircleDollarSign, FileText, Receipt, Split } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listSettlementReceipts } from '@/features/marketplace/receipt-store'
import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type AdminReceiptsPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function AdminReceiptsPage({
  searchParams
}: AdminReceiptsPageProps) {
  const params = await searchParams
  const state = resolveServerTableState(params, {
    defaultSort: 'created',
    defaultPageSize: 10
  })
  const settlementReceipts = await listSettlementReceipts()
  const table = queryServerRows(settlementReceipts, state, {
    searchText: receipt =>
      [
        receipt.id,
        receipt.orderId,
        receipt.requestId,
        receipt.productName,
        receipt.providerName,
        receipt.buyerWallet,
        receipt.providerWallet,
        receipt.txHash ?? ''
      ].join(' '),
    sortValues: {
      product: receipt => receipt.productName,
      provider: receipt => receipt.providerName,
      amount: receipt => parseUsdt(receipt.amountUsdt),
      providerAmount: receipt => parseUsdt(receipt.providerAmountUsdt),
      platformFee: receipt => parseUsdt(receipt.platformFeeUsdt),
      created: receipt => receipt.createdAt
    }
  })
  const gross = settlementReceipts.reduce(
    (sum, receipt) => sum + parseUsdt(receipt.amountUsdt),
    0
  )
  const providerShare = settlementReceipts.reduce(
    (sum, receipt) => sum + parseUsdt(receipt.providerAmountUsdt),
    0
  )
  const platformFees = settlementReceipts.reduce(
    (sum, receipt) => sum + parseUsdt(receipt.platformFeeUsdt),
    0
  )

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Settlement ledger</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Receipts and payouts</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Audit every recorded PYUSD receipt, provider share, platform fee,
            buyer wallet, payout wallet, and explorer transaction.
          </p>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Receipts',
            value: settlementReceipts.length.toLocaleString(),
            detail: 'Recorded settlements',
            icon: Receipt
          },
          {
            label: 'Gross volume',
            value: `${gross.toFixed(2)} PYUSD`,
            detail: 'Total paid amount',
            icon: CircleDollarSign
          },
          {
            label: 'Provider share',
            value: `${providerShare.toFixed(2)} PYUSD`,
            detail: 'Released to providers',
            icon: Split
          },
          {
            label: 'Platform fees',
            value: `${platformFees.toFixed(2)} PYUSD`,
            detail: 'Platform fee share',
            icon: FileText
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
        id='admin-receipts'
        rows={table.rows}
        columns={receiptColumns()}
        getRowId={receipt => receipt.id}
        basePath='/admin/receipts'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search receipts, orders, products, providers, wallets, or transactions'
        emptyTitle='No settlement receipts yet'
        emptyDescription='Receipts appear after paid x402, managed-credit, or agent actions settle.'
        enableSelection={false}
      />
    </div>
  )
}

function receiptColumns(): ServerDataTableColumn<MarketplaceReceipt>[] {
  return [
    {
      key: 'receipt',
      label: 'Receipt',
      sortKey: 'created',
      render: receipt => (
        <div>
          <Link
            href={`/receipts/${receipt.id}`}
            className='font-semibold hover:underline'
          >
            {receipt.id}
          </Link>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {receipt.requestId}
          </p>
        </div>
      )
    },
    {
      key: 'product',
      label: 'Product',
      sortKey: 'product',
      render: receipt => (
        <div>
          <p className='font-semibold'>{receipt.productName}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {receipt.providerName}
          </p>
        </div>
      )
    },
    {
      key: 'buyer',
      label: 'Buyer',
      render: receipt => (
        <p className='font-mono text-xs break-all'>{receipt.buyerWallet}</p>
      )
    },
    {
      key: 'amount',
      label: 'Amount',
      sortKey: 'amount',
      render: receipt => (
        <div>
          <p className='font-semibold'>{receipt.amountUsdt}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            Provider {receipt.providerAmountUsdt}
          </p>
        </div>
      )
    },
    {
      key: 'fee',
      label: 'Fee',
      sortKey: 'platformFee',
      render: receipt => (
        <p className='font-semibold'>{receipt.platformFeeUsdt}</p>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: receipt => (
        <Link
          href={`/receipts/${receipt.id}`}
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
