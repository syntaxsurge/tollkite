import Link from 'next/link'

import {
  Activity,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Plus,
  Sparkles
} from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { AgentRunRowActions } from '@/features/agents/agent-run-row-actions'
import { agentRunStatusLabels } from '@/features/agents/status'
import { getAgentMetrics, listAgentRuns } from '@/features/agents/store'
import { type AgentTemplate, agentTemplates } from '@/features/agents/templates'
import type { AgentRun } from '@/features/agents/types'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

type AgentsPageProps = {
  searchParams?: Promise<{
    tab?: string
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const params = await searchParams
  const tab = params?.tab === 'templates' ? 'templates' : 'runs'
  const metrics = await getAgentMetrics()
  const state = resolveServerTableState(params, {
    defaultSort: tab === 'runs' ? 'updatedAt' : 'title',
    defaultPageSize: 8
  })
  const templates = queryServerRows(agentTemplates, state, {
    searchText: template =>
      [
        template.title,
        template.category,
        template.summary,
        template.toolStrategy,
        template.deliverables.join(' ')
      ].join(' '),
    sortValues: {
      title: template => template.title,
      category: template => template.category,
      budget: template => template.recommendedBudgetUsdt,
      actions: template => template.maxPaidActions
    }
  })
  const runs = queryServerRows(await listAgentRuns(), state, {
    searchText: run =>
      [
        run.title,
        run.status,
        run.ownerWallet,
        run.objective,
        run.fundedAmountUsdt,
        run.availableAmountUsdt
      ].join(' '),
    sortValues: {
      title: run => run.title,
      status: run => run.status,
      budget: run => run.budgetCapUsdt,
      updatedAt: run => new Date(run.updatedAt)
    }
  })

  return (
    <div className='space-y-6'>
      <section className='border-foreground/10 bg-card/90 overflow-hidden rounded-lg border p-5 shadow-sm sm:p-6'>
        <div className='grid gap-6 xl:grid-cols-[1fr_520px] xl:items-center'>
          <div className='max-w-3xl space-y-5'>
            <Badge className='w-fit'>
              <Sparkles className='h-3.5 w-3.5' aria-hidden />
              OpenAI agent command center
            </Badge>
            <div className='space-y-3'>
              <h1 className='font-display text-3xl text-balance sm:text-5xl'>
                Autonomous paid runs, funded and proved.
              </h1>
              <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
                Start from a template or blank run. The agent plans with OpenAI,
                spends through x402, records receipts, and publishes an on-chain
                proof.
              </p>
            </div>
            <div className='flex flex-wrap gap-3'>
              <Link
                href='/agents/new'
                className={buttonClasses({ size: 'md' })}
              >
                <Plus className='h-4 w-4' aria-hidden />
                Blank run
              </Link>
              <Link
                href='/agents?tab=templates'
                className={buttonClasses({ variant: 'outline', size: 'md' })}
              >
                Browse templates
              </Link>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <MetricTile
              icon={Activity}
              label='Runs'
              value={metrics.totalRuns.toString()}
            />
            <MetricTile
              icon={CheckCircle2}
              label='Completed'
              value={metrics.completedRuns.toString()}
            />
            <MetricTile
              icon={FileCheck2}
              label='Proofs'
              value={metrics.proofCount.toString()}
            />
            <MetricTile
              icon={CircleDollarSign}
              label='Spend'
              value={`${metrics.totalSpendUsdt} PYUSD`}
            />
          </div>
        </div>
      </section>

      <nav
        className='border-border bg-card/90 flex flex-wrap gap-2 rounded-lg border p-2'
        aria-label='Agent page sections'
      >
        {[
          ['runs', 'Recent runs'],
          ['templates', 'Templates']
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/agents?tab=${value}`}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-semibold transition',
              tab === value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'templates' ? (
        <ServerDataTable
          id='agent-templates'
          rows={templates.rows}
          columns={templateColumns}
          getRowId={template => template.id}
          basePath='/agents'
          preserveParams={{ tab: 'templates' }}
          query={state.q}
          sort={state.sort}
          dir={state.dir}
          page={templates.page}
          pageSize={templates.pageSize}
          totalRows={templates.totalRows}
          totalPages={templates.totalPages}
          searchPlaceholder='Search templates, deliverables, or strategies'
          emptyTitle='No templates match this search'
          emptyDescription='Clear the search or create a blank run.'
          enableSelection={false}
        />
      ) : (
        <ServerDataTable
          id='agent-runs'
          rows={runs.rows}
          columns={runColumns}
          getRowId={run => run.id}
          basePath='/agents'
          preserveParams={{ tab: 'runs' }}
          query={state.q}
          sort={state.sort}
          dir={state.dir}
          page={runs.page}
          pageSize={runs.pageSize}
          totalRows={runs.totalRows}
          totalPages={runs.totalPages}
          searchPlaceholder='Search runs, wallets, objectives, or statuses'
          emptyTitle='No agent runs yet'
          emptyDescription='Create a run, fund the vault, and let OpenAI choose paid tools.'
          bulkActions={[
            {
              label: 'Delete selected',
              endpoint: '/api/agents/runs/bulk-delete',
              confirmMessage:
                'Delete the selected agent runs? Running jobs will be stopped and unused budget refund will be attempted when applicable.'
            }
          ]}
        />
      )}
    </div>
  )
}

const templateColumns: ServerDataTableColumn<AgentTemplate>[] = [
  {
    key: 'template',
    label: 'Template',
    sortKey: 'title',
    render: template => {
      const Icon = template.icon

      return (
        <div className='flex min-w-0 gap-3'>
          <span className='bg-primary/10 text-primary h-10 w-10 shrink-0 rounded-lg p-2'>
            <Icon className='h-5 w-5' aria-hidden />
          </span>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <p className='font-semibold'>{template.title}</p>
              <Badge>{template.category}</Badge>
            </div>
            <p className='text-muted-foreground mt-1 max-w-2xl text-sm leading-6'>
              {template.summary}
            </p>
          </div>
        </div>
      )
    }
  },
  {
    key: 'deliverables',
    label: 'Deliverables',
    render: template => (
      <div className='flex flex-wrap gap-2'>
        {template.deliverables.map(deliverable => (
          <span
            key={deliverable}
            className='border-border bg-muted/40 rounded-full border px-2.5 py-1 text-xs font-semibold'
          >
            {deliverable}
          </span>
        ))}
      </div>
    )
  },
  {
    key: 'budget',
    label: 'Budget',
    sortKey: 'budget',
    render: template => (
      <div>
        <p className='font-semibold'>
          {template.recommendedBudgetUsdt.toFixed(2)} PYUSD
        </p>
        <p className='text-muted-foreground mt-1 text-xs'>
          {template.maxPaidActions} max actions
        </p>
      </div>
    )
  },
  {
    key: 'action',
    label: 'Action',
    render: template => (
      <Link
        href={`/agents/new?template=${template.id}`}
        className={buttonClasses({ size: 'sm' })}
      >
        Configure
      </Link>
    )
  }
]

const runColumns: ServerDataTableColumn<AgentRun>[] = [
  {
    key: 'run',
    label: 'Run',
    sortKey: 'title',
    render: run => (
      <div>
        <Link
          href={`/agents/${run.id}`}
          className='font-semibold hover:underline'
        >
          {run.title}
        </Link>
        <p className='text-muted-foreground mt-1 line-clamp-2 max-w-xl text-sm leading-6'>
          {run.objective}
        </p>
      </div>
    )
  },
  {
    key: 'status',
    label: 'Status',
    sortKey: 'status',
    render: run => <Badge>{agentRunStatusLabels[run.status]}</Badge>
  },
  {
    key: 'budget',
    label: 'Budget',
    sortKey: 'budget',
    render: run => (
      <div>
        <p className='font-semibold'>{run.fundedAmountUsdt}</p>
        <p className='text-muted-foreground mt-1 text-xs'>
          {run.availableAmountUsdt} available
        </p>
      </div>
    )
  },
  {
    key: 'updated',
    label: 'Updated',
    sortKey: 'updatedAt',
    render: run => (
      <time className='text-sm' dateTime={run.updatedAt}>
        {new Date(run.updatedAt).toLocaleString()}
      </time>
    )
  },
  {
    key: 'action',
    label: 'Actions',
    className: 'w-20 text-right',
    render: run => <AgentRunRowActions run={run} />
  }
]

function MetricTile({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Activity
  label: string
  value: string
}) {
  return (
    <div className='border-foreground/10 bg-background/85 rounded-lg border p-4 shadow-sm'>
      <Icon className='text-primary h-4 w-4' aria-hidden />
      <p className='text-foreground/60 mt-3 text-xs tracking-[0.14em] uppercase'>
        {label}
      </p>
      <p className='mt-1 text-xl font-semibold'>{value}</p>
    </div>
  )
}
