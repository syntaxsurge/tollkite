import Link from 'next/link'

import { Bot, CircleDollarSign, FileCheck2, TriangleAlert } from 'lucide-react'

import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AgentRunRowActions } from '@/features/agents/agent-run-row-actions'
import { getAgentMetrics, listAgentRuns } from '@/features/agents/store'
import type { AgentRun } from '@/features/agents/types'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type AdminAgentsPageProps = {
  searchParams?: Promise<{
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function AdminAgentsPage({
  searchParams
}: AdminAgentsPageProps) {
  const params = await searchParams
  const runs = await listAgentRuns()
  const metrics = await getAgentMetrics()
  const state = resolveServerTableState(params, {
    defaultSort: 'updated',
    defaultPageSize: 10
  })
  const table = queryServerRows(runs, state, {
    searchText: run =>
      [
        run.id,
        run.title,
        run.objective,
        run.ownerWallet,
        run.status,
        run.fundingStatus,
        run.deliverables.plannerMode ?? '',
        run.deliverables.plannerModel ?? ''
      ].join(' '),
    sortValues: {
      title: run => run.title,
      owner: run => run.ownerWallet,
      status: run => run.status,
      funded: run => Number(run.fundedAmountUsdt),
      spent: run => Number(run.spentAmountUsdt),
      updated: run => run.updatedAt,
      created: run => run.createdAt
    }
  })
  const failedRuns = runs.filter(run => run.status === 'failed').length
  const proofCount = runs.filter(run => run.proof).length

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Agent operations</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Autonomous run oversight</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Review funded budgets, OpenAI planning mode, paid tool execution,
            run status, refunds, and proof readiness across all agent runs.
          </p>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          {
            label: 'Agent runs',
            value: metrics.totalRuns.toLocaleString(),
            detail: `${metrics.completedRuns} completed`,
            icon: Bot
          },
          {
            label: 'Agent spend',
            value: `${metrics.totalSpendUsdt} PYUSD`,
            detail: 'Recorded tool spend',
            icon: CircleDollarSign
          },
          {
            label: 'Proofs',
            value: proofCount.toLocaleString(),
            detail: 'Attested or proof-ready runs',
            icon: FileCheck2
          },
          {
            label: 'Failed runs',
            value: failedRuns.toLocaleString(),
            detail: 'Need retry or refund review',
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
        id='admin-agents'
        rows={table.rows}
        columns={agentColumns()}
        getRowId={run => run.id}
        basePath='/admin/agents'
        query={state.q}
        sort={state.sort}
        dir={state.dir}
        page={table.page}
        pageSize={table.pageSize}
        totalRows={table.totalRows}
        totalPages={table.totalPages}
        searchPlaceholder='Search run IDs, owners, objectives, statuses, or planner models'
        emptyTitle='No agent runs yet'
        emptyDescription='Funded autonomous runs appear here after users create them.'
        enableSelection
        bulkActions={[
          {
            label: 'Delete selected',
            endpoint: '/api/agents/runs/bulk-delete',
            confirmMessage:
              'Delete the selected agent runs and stop future execution?'
          }
        ]}
      />
    </div>
  )
}

function agentColumns(): ServerDataTableColumn<AgentRun>[] {
  return [
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
          <p className='text-muted-foreground mt-2 line-clamp-2 text-sm'>
            {run.objective}
          </p>
        </div>
      )
    },
    {
      key: 'owner',
      label: 'Owner',
      sortKey: 'owner',
      render: run => (
        <p className='font-mono text-xs break-all'>{run.ownerWallet}</p>
      )
    },
    {
      key: 'budget',
      label: 'Budget',
      sortKey: 'funded',
      render: run => (
        <div>
          <p className='font-semibold'>{run.fundedAmountUsdt} PYUSD funded</p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {run.spentAmountUsdt} PYUSD spent
          </p>
        </div>
      )
    },
    {
      key: 'planner',
      label: 'Planner',
      render: run => (
        <div>
          <p className='font-semibold'>
            {run.deliverables.plannerMode ?? 'Not planned'}
          </p>
          <p className='text-muted-foreground mt-2 text-xs'>
            {run.deliverables.plannerModel ?? 'No model'}
          </p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: run => (
        <div>
          <p className='font-semibold capitalize'>{run.status}</p>
          <p className='text-muted-foreground mt-2 text-xs capitalize'>
            {run.fundingStatus.replace(/_/g, ' ')}
          </p>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'w-20 text-right',
      render: run => <AgentRunRowActions run={run} />
    }
  ]
}
