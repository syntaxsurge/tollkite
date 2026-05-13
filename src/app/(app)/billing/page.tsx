import { cookies } from 'next/headers'
import Link from 'next/link'

import {
  Bot,
  KeyRound,
  ReceiptText,
  ShieldCheck,
  WalletCards
} from 'lucide-react'

import { BillingOverview } from '@/components/billing/billing-overview'
import { ManagedCreditsPanel } from '@/components/billing/managed-credits-panel'
import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getAgentMetrics } from '@/features/agents/store'
import {
  getManagedCreditAccountByWallet,
  toPublicManagedCreditAccount
} from '@/features/billing/managed-credits'
import { CopyTextButton } from '@/features/marketplace/copy-endpoint-button'
import { listSettlementReceipts } from '@/features/marketplace/receipt-store'
import type { MarketplaceReceipt } from '@/features/marketplace/receipts'
import { WALLET_ADDRESS_COOKIE } from '@/lib/auth/wallet-session'
import { getProjectSnapshot } from '@/lib/config/project'
import {
  formatBpsPercent,
  subscriptionPlans
} from '@/lib/contracts/subscription'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type BillingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type BillingApiKeyRow = ReturnType<typeof toPublicManagedCreditAccount> & {
  id: string
  createdTimestamp: number
  updatedTimestamp: number
}

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = await searchParams
  const cookieStore = await cookies()
  const walletAddress = cookieStore.get(WALLET_ADDRESS_COOKIE)?.value ?? null
  const snapshot = await getProjectSnapshot()
  const agentMetrics = await getAgentMetrics()
  const managedCreditAccount = walletAddress
    ? await getManagedCreditAccountByWallet(walletAddress)
    : null
  const publicCreditAccount = managedCreditAccount
    ? toPublicManagedCreditAccount(managedCreditAccount)
    : null
  const apiKeyRows = publicCreditAccount
    ? [
        {
          ...publicCreditAccount,
          id: publicCreditAccount.wallet,
          createdTimestamp: Date.parse(publicCreditAccount.createdAt),
          updatedTimestamp: Date.parse(publicCreditAccount.updatedAt)
        }
      ]
    : []
  const keyState = resolveServerTableState(params, {
    defaultSort: 'updated',
    defaultPageSize: 5,
    paramPrefix: 'keys'
  })
  const keyTable = queryServerRows(apiKeyRows, keyState, {
    searchText: row =>
      [
        row.wallet,
        row.apiKey,
        row.balanceUsdt,
        row.topUps.length,
        row.debits.length
      ].join(' '),
    sortValues: {
      key: row => row.apiKey,
      balance: row => Number(row.balanceUsdt),
      topUps: row => row.topUps.length,
      debits: row => row.debits.length,
      updated: row => row.updatedTimestamp
    }
  })
  const settlementReceipts = await listSettlementReceipts()
  const walletReceipts = walletAddress
    ? settlementReceipts.filter(
        receipt =>
          receipt.buyerWallet.toLowerCase() === walletAddress.toLowerCase() ||
          receipt.providerWallet.toLowerCase() === walletAddress.toLowerCase()
      )
    : []
  const receiptState = resolveServerTableState(params, {
    defaultSort: 'created',
    defaultPageSize: 10,
    paramPrefix: 'receipts'
  })
  const receiptTable = queryServerRows(walletReceipts, receiptState, {
    searchText: receipt =>
      [
        receipt.id,
        receipt.orderId,
        receipt.requestId,
        receipt.productName,
        receipt.providerName,
        receipt.buyerWallet,
        receipt.providerWallet,
        receipt.txHash,
        receipt.providerPlan ?? ''
      ].join(' '),
    sortValues: {
      product: receipt => receipt.productName,
      amount: receipt => parseUsdt(receipt.amountUsdt),
      providerAmount: receipt => parseUsdt(receipt.providerAmountUsdt),
      platformFee: receipt => parseUsdt(receipt.platformFeeUsdt),
      plan: receipt => receipt.providerPlan ?? 'free',
      created: receipt => receipt.createdAt
    }
  })
  const currentPlan = subscriptionPlans[0]

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Billing</Badge>
        <div className='mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-4xl'>Plan and usage</h1>
            <p className='text-foreground/70 text-sm leading-6'>
              Review plan state, managed credits, and paid API spend.
            </p>
          </div>
          <Link
            href='/pricing'
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className: 'whitespace-nowrap'
            })}
          >
            <ReceiptText className='h-4 w-4' aria-hidden />
            Upgrade plan
          </Link>
        </div>
      </section>

      <BillingOverview
        subscriptionConfigured={Boolean(snapshot.subscriptionManagerAddress)}
      />

      <ManagedCreditsPanel />

      <Card className='space-y-4'>
        <div className='flex flex-col justify-between gap-3 sm:flex-row sm:items-center'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Agent spend
            </p>
            <h2 className='font-display mt-2 text-2xl'>
              Autonomous workflow usage
            </h2>
          </div>
          <Link
            href='/agents'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <Bot className='h-4 w-4' aria-hidden />
            Agents
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
      </Card>

      <Card className='space-y-4'>
        <div className='flex flex-col justify-between gap-3 lg:flex-row lg:items-start'>
          <div className='max-w-2xl'>
            <div className='flex items-center gap-2'>
              <KeyRound className='text-primary h-5 w-5' aria-hidden />
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Managed API keys
              </p>
            </div>
            <h2 className='font-display mt-2 text-2xl'>Saved credit access</h2>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              API keys are for teams that prefer prepaid usage instead of
              signing every request. the gateway reserves credits before
              provider work starts and records receipts when usage settles.
            </p>
          </div>
          <div className='border-foreground/10 bg-muted/40 rounded-lg border p-4 text-sm'>
            <div className='flex gap-3'>
              <ShieldCheck
                className='text-primary mt-0.5 h-4 w-4 shrink-0'
                aria-hidden
              />
              <p className='text-foreground/70 leading-6'>
                Native x402 remains available for every listed API. Managed
                credits are an optional API-key workflow.
              </p>
            </div>
          </div>
        </div>
        <ServerDataTable
          id='billing-api-keys'
          rows={keyTable.rows}
          columns={apiKeyColumns()}
          getRowId={row => row.id}
          basePath='/billing'
          paramPrefix='keys'
          preserveParams={pickParams(params, 'receipts')}
          query={keyState.q}
          sort={keyState.sort}
          dir={keyState.dir}
          page={keyTable.page}
          pageSize={keyTable.pageSize}
          totalRows={keyTable.totalRows}
          totalPages={keyTable.totalPages}
          searchPlaceholder='Search API keys, wallets, or balances'
          emptyTitle='No managed API key yet'
          emptyDescription='Create an API key from the managed credits panel above when you want prepaid API-key usage.'
          enableSelection={false}
        />
      </Card>

      <Card className='space-y-4'>
        <div className='flex flex-col justify-between gap-3 lg:flex-row lg:items-start'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              USDT receipts
            </p>
            <h2 className='font-display mt-2 text-2xl'>Recent settlements</h2>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              Successful browser, API-key, and agent calls appear in this
              wallet-scoped ledger with the provider share and platform fee.
            </p>
          </div>
          <div className='border-foreground/10 bg-muted/40 rounded-lg border p-4 text-sm'>
            <div className='flex items-start gap-3'>
              <WalletCards
                className='text-primary mt-0.5 h-4 w-4 shrink-0'
                aria-hidden
              />
              <p className='text-foreground/70 leading-6'>
                Free providers keep{' '}
                {formatBpsPercent(currentPlan.providerShareBps)}. Paid plans
                reduce the platform fee on successful settlements.
              </p>
            </div>
          </div>
        </div>
        <ServerDataTable
          id='billing-settlements'
          rows={receiptTable.rows}
          columns={receiptColumns()}
          getRowId={receipt => receipt.id}
          basePath='/billing'
          paramPrefix='receipts'
          preserveParams={pickParams(params, 'keys')}
          query={receiptState.q}
          sort={receiptState.sort}
          dir={receiptState.dir}
          page={receiptTable.page}
          pageSize={receiptTable.pageSize}
          totalRows={receiptTable.totalRows}
          totalPages={receiptTable.totalPages}
          searchPlaceholder='Search receipts, products, wallets, or transactions'
          emptyTitle='No settlements for this wallet yet'
          emptyDescription='Successful paid API calls, managed-credit calls, and agent actions appear here after settlement.'
          enableSelection={false}
        />
      </Card>
    </div>
  )
}

function apiKeyColumns(): ServerDataTableColumn<BillingApiKeyRow>[] {
  return [
    {
      key: 'key',
      label: 'API key',
      sortKey: 'key',
      render: row => (
        <div className='min-w-[260px]'>
          <p className='font-mono text-xs break-all'>{row.apiKey}</p>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {row.wallet}
          </p>
        </div>
      )
    },
    {
      key: 'balance',
      label: 'Balance',
      sortKey: 'balance',
      render: row => <p className='font-semibold'>{row.balanceUsdt} USDT</p>
    },
    {
      key: 'activity',
      label: 'Activity',
      sortKey: 'debits',
      render: row => (
        <div className='text-sm'>
          <p>{row.debits.length} debit(s)</p>
          <p className='text-muted-foreground mt-1'>
            {row.topUps.length} top-up(s)
          </p>
        </div>
      )
    },
    {
      key: 'updated',
      label: 'Updated',
      sortKey: 'updated',
      render: row => formatDate(row.updatedAt)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: row => <CopyTextButton text={row.apiKey} label='Copy key' />
    }
  ]
}

function receiptColumns(): ServerDataTableColumn<MarketplaceReceipt>[] {
  return [
    {
      key: 'product',
      label: 'Product',
      sortKey: 'product',
      render: receipt => (
        <div className='min-w-[220px]'>
          <p className='font-semibold'>{receipt.productName}</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {receipt.providerName}
          </p>
          <p className='text-muted-foreground mt-2 font-mono text-xs break-all'>
            {receipt.id}
          </p>
        </div>
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
      label: 'Platform fee',
      sortKey: 'platformFee',
      render: receipt => (
        <p className='font-semibold'>{receipt.platformFeeUsdt}</p>
      )
    },
    {
      key: 'plan',
      label: 'Provider plan',
      sortKey: 'plan',
      render: receipt => (
        <span className='bg-muted rounded-full px-3 py-1 text-xs font-semibold capitalize'>
          {receipt.providerPlan ?? 'free'}
        </span>
      )
    },
    {
      key: 'created',
      label: 'Created',
      sortKey: 'created',
      render: receipt => formatDate(receipt.createdAt)
    },
    {
      key: 'actions',
      label: 'Actions',
      render: receipt => (
        <Link
          href={`/receipts/${receipt.id}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          Open receipt
        </Link>
      )
    }
  ]
}

function parseUsdt(value: string | undefined) {
  const amount = Number((value ?? '').replace(/[^0-9.]/g, ''))

  return Number.isFinite(amount) ? amount : 0
}

function formatDate(value: string) {
  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return 'Not recorded'
  }

  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp))
}

function pickParams(
  params: Record<string, string | string[] | undefined> | undefined,
  prefix: string
) {
  const picked: Record<string, string | undefined> = {}

  for (const key of ['q', 'sort', 'dir', 'page', 'pageSize']) {
    const prefixed = `${prefix}${key[0].toUpperCase()}${key.slice(1)}`
    const value = params?.[prefixed]
    picked[prefixed] = Array.isArray(value) ? value[0] : value
  }

  return picked
}
