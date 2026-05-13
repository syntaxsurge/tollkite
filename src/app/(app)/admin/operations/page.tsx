import { ExternalLink } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type ApiProduct,
  getPublishedProducts
} from '@/features/marketplace/products'
import { getProjectSnapshot } from '@/lib/config/project'
import { getOperationalReadiness } from '@/lib/operations/readiness'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

const deploymentSteps = [
  'Set NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_CONVEX_URL, and wallet provider values in the root environment.',
  'Set NEXT_PUBLIC_X402_NETWORK and X402_FACILITATOR_URL for USDT-paid API calls; provider fee splits are resolved from subscription tiers.',
  'Set AGENT_SPENDER_PRIVATE_KEY, AGENT_ATTESTER_PRIVATE_KEY, and NEXT_PUBLIC_AGENT_ATTESTOR_ADDRESS for production agent runs.',
  'Run pnpm typecheck and pnpm build before deployment.',
  'Deploy the Next.js app with the same EVM chain and x402 values used for the verified local build.',
  'Confirm /api/health, /api/openapi.json, /api/reference, /agents, /proofs/[proofId], and an unpaid x402 product call return expected responses.'
]

export default async function AdminOperationsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const adapterState = resolveServerTableState(params, {
    defaultSort: 'name',
    defaultDir: 'asc',
    defaultPageSize: 10
  })
  const snapshot = await getProjectSnapshot()
  const readiness = await getOperationalReadiness()
  const products = await getPublishedProducts()
  const adapters = queryServerRows(products, adapterState, {
    searchText: product =>
      [
        product.name,
        product.slug,
        product.providerName,
        product.endpointPath,
        product.priceLabel,
        product.successRate
      ].join(' '),
    sortValues: {
      name: product => product.name,
      provider: product => product.providerName,
      price: product => product.priceUsd,
      calls: product => product.calls,
      successRate: product => Number.parseFloat(product.successRate) || 0
    }
  })

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Operations</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Gateway operations</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Monitor deployment readiness, x402 payment health, autonomous agent
            signers, provider adapters, receipt coverage, and contract
            configuration from the admin workspace.
          </p>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-3'>
        {[
          ['Ready checks', readiness.readyCount.toString()],
          ['Needs attention', readiness.attentionCount.toString()],
          ['Published APIs', products.length.toString()]
        ].map(([label, value]) => (
          <Card key={label}>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              {label}
            </p>
            <p className='mt-3 text-2xl font-semibold'>{value}</p>
          </Card>
        ))}
      </section>

      <section className='grid gap-5 lg:grid-cols-[1.1fr_0.9fr]'>
        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Deployment readiness
          </p>
          <div className='grid gap-3'>
            {readiness.items.map(item => (
              <div
                key={item.label}
                className='border-foreground/10 bg-background/35 rounded-lg border p-4 text-sm leading-6'
              >
                <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
                  <p className='font-semibold'>{item.label}</p>
                  <span
                    className={
                      item.state === 'ready'
                        ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300'
                        : 'rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300'
                    }
                  >
                    {item.state === 'ready' ? 'Ready' : 'Review'}
                  </span>
                </div>
                <p
                  className={
                    item.state === 'ready'
                      ? 'mt-3 font-mono text-sm break-all text-emerald-700 dark:text-emerald-300'
                      : 'mt-3 font-mono text-sm break-all text-amber-700 dark:text-amber-300'
                  }
                >
                  {item.value}
                </p>
                <p className='text-foreground/65 mt-2'>{item.detail}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Subscription contract
          </p>
          <h2 className='font-display text-2xl'>Runtime address</h2>
          <div className='bg-muted rounded-lg p-4'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Address
            </p>
            <p className='mt-2 text-sm font-semibold break-all'>
              {snapshot.subscriptionManagerAddress ?? 'Not configured'}
            </p>
            <p className='text-foreground/55 mt-2 text-xs'>
              {snapshot.subscriptionChain.name} - Chain ID{' '}
              {snapshot.subscriptionChain.id} -{' '}
              {snapshot.subscriptionChain.nativeTokenSymbol}
            </p>
          </div>
          {snapshot.subscriptionManagerExplorerUrl ? (
            <a
              href={snapshot.subscriptionManagerExplorerUrl}
              target='_blank'
              rel='noreferrer'
              className={buttonClasses({
                variant: 'outline',
                size: 'sm',
                className: 'gap-2'
              })}
            >
              View on {snapshot.subscriptionChain.explorerName}
              <ExternalLink className='h-4 w-4' aria-hidden />
            </a>
          ) : null}
        </Card>
      </section>

      <section className='grid gap-5 lg:grid-cols-[0.9fr_1.1fr]'>
        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Release checklist
          </p>
          <div className='space-y-3'>
            {deploymentSteps.map((step, index) => (
              <div
                key={step}
                className='border-foreground/10 flex gap-3 rounded-lg border p-4 text-sm leading-6'
              >
                <span className='bg-accent text-accent-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
                  {index + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Provider adapters
          </p>
          <ServerDataTable
            id='admin-provider-adapters'
            rows={adapters.rows}
            columns={providerAdapterColumns()}
            getRowId={product => product.slug}
            basePath='/admin/operations'
            query={adapterState.q}
            sort={adapterState.sort}
            dir={adapterState.dir}
            page={adapters.page}
            pageSize={adapters.pageSize}
            totalRows={adapters.totalRows}
            totalPages={adapters.totalPages}
            emptyTitle='No provider adapters found'
            emptyDescription='Published provider adapters appear here after they are available in the marketplace.'
            searchPlaceholder='Search adapters, providers, or endpoints'
            enableSelection={false}
          />
        </Card>
      </section>
    </div>
  )
}

function providerAdapterColumns(): ServerDataTableColumn<ApiProduct>[] {
  return [
    {
      key: 'name',
      label: 'Adapter',
      sortKey: 'name',
      className: 'min-w-[260px]',
      render: product => (
        <div>
          <p className='font-semibold'>{product.name}</p>
          <p className='text-muted-foreground mt-1 text-xs break-all'>
            {product.endpointPath}
          </p>
        </div>
      )
    },
    {
      key: 'provider',
      label: 'Provider',
      sortKey: 'provider',
      render: product => product.providerName
    },
    {
      key: 'price',
      label: 'Price',
      sortKey: 'price',
      render: product => product.priceLabel
    },
    {
      key: 'calls',
      label: 'Calls',
      sortKey: 'calls',
      render: product => product.calls.toLocaleString()
    },
    {
      key: 'successRate',
      label: 'Success',
      sortKey: 'successRate',
      render: product => product.successRate
    }
  ]
}
