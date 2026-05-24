'use client'

import { useRouter as useSmoothRouter } from 'next/navigation'
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'

import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  type LucideIcon,
  Search,
  Sparkles,
  Wallet
} from 'lucide-react'
import { useRouter as useTopLoaderRouter } from 'nextjs-toploader/app'

import { ServerDataTableSelection } from '@/components/data-display/server-data-table-selection'
import { ServerDataTableSortButton } from '@/components/data-display/server-data-table-sort-button'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import type { AgentTemplate } from '@/features/agents/templates'
import type { AgentRun, AgentToolSlug } from '@/features/agents/types'
import type { ApiProduct } from '@/features/marketplace/products'
import type { ServerTableDirection } from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

type ToolRow = Pick<
  ApiProduct,
  'slug' | 'name' | 'priceLabel' | 'providerName' | 'category'
>

type ToolTableState = {
  query: string
  sort: string
  dir: ServerTableDirection
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
}

type AgentRunFormTemplate = Omit<AgentTemplate, 'icon'>

export function AgentRunCreateForm({
  products,
  toolTable,
  template,
  initialTool
}: {
  template?: AgentRunFormTemplate
  initialTool?: string
  products: ToolRow[]
  toolTable: ToolTableState
}) {
  const router = useTopLoaderRouter()
  const smoothRouter = useSmoothRouter()
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toolSearch, setToolSearch] = useState(toolTable.query)
  const initialAgentTool = initialTool
    ? (initialTool as AgentToolSlug)
    : undefined
  const selectionStorageKey = useMemo(
    () =>
      `app:agent-create:selected-tools:${template?.id ?? initialTool ?? 'blank'}`,
    [initialTool, template?.id]
  )
  const [selectedTools, setSelectedTools] = useState<AgentToolSlug[]>(() =>
    readStoredSelectedTools(selectionStorageKey, initialAgentTool)
  )
  const [toolMode, setToolMode] = useState<'ai' | 'manual'>(
    initialAgentTool ? 'manual' : 'ai'
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const ownerWallet = formData.get('ownerWallet')

    try {
      if (!ownerWallet) {
        throw new Error('Connect your wallet before creating an agent run.')
      }

      if (toolMode === 'manual' && selectedTools.length === 0) {
        throw new Error('Select at least one tool for manual tool limits.')
      }

      const response = await fetch('/api/agents/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: template?.id,
          objective: formData.get('objective'),
          sourceText: formData.get('sourceText') || undefined,
          ownerWallet,
          budgetCapUsdt: formData.get('budgetCapUsdt'),
          maxPaidActions: formData.get('maxPaidActions'),
          toolSelectionMode: toolMode,
          allowedTools: toolMode === 'manual' ? selectedTools : undefined,
          mode: 'production'
        })
      })
      const run = (await response.json()) as AgentRun & { error?: string }

      if (!response.ok) {
        throw new Error(run.error ?? 'Unable to create the agent run.')
      }

      window.sessionStorage.setItem(
        `app:agent-run:${run.id}`,
        JSON.stringify(run)
      )
      window.sessionStorage.removeItem(selectionStorageKey)
      router.push(`/agents/${run.id}`)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create the agent run.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  function toggleTool(tool: AgentToolSlug) {
    setSelectedTools(current =>
      current.includes(tool)
        ? current.filter(item => item !== tool)
        : [...current, tool]
    )
  }

  useEffect(() => {
    window.sessionStorage.setItem(
      selectionStorageKey,
      JSON.stringify(selectedTools)
    )
  }, [selectedTools, selectionStorageKey])

  function goToToolsPage(page: number) {
    smoothRouter.push(buildToolsHref({ page, query: toolTable.query }), {
      scroll: false
    })
  }

  function searchTools() {
    smoothRouter.push(buildToolsHref({ page: 1, query: toolSearch.trim() }), {
      scroll: false
    })
  }

  return (
    <WalletAddressConsumer>
      {({ address, isConnected }) => (
        <form onSubmit={handleSubmit} className='space-y-5'>
          <StepCard
            icon={Sparkles}
            eyebrow='Step 1'
            title='Goal'
            description='Tell OpenAI what business outcome this funded agent run should produce.'
          >
            <div className='grid gap-4'>
              <label className='block space-y-2'>
                <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Objective
                </span>
                <textarea
                  name='objective'
                  defaultValue={template?.objective}
                  placeholder='Tell the agent what business outcome to produce.'
                  className='border-foreground/15 bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-28 w-full resize-y rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                  required
                />
              </label>
              <label className='block space-y-2'>
                <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Context
                </span>
                <textarea
                  name='sourceText'
                  defaultValue={template?.sourceText}
                  placeholder='Paste product notes, audience, API behavior, constraints, or launch context.'
                  className='border-foreground/15 bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background min-h-24 w-full resize-y rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none'
                />
              </label>
            </div>
          </StepCard>

          <StepCard
            icon={Boxes}
            eyebrow='Step 2'
            title='Tools'
            description='Let OpenAI choose from the marketplace, or manually limit the paid APIs it may call.'
          >
            <div className='grid gap-3 md:grid-cols-2'>
              <ToolModeCard
                active={toolMode === 'ai'}
                icon={Sparkles}
                title='Let AI decide'
                detail={`${toolTable.totalRows.toLocaleString()} agent-ready tools available. The server resolves the catalog; the browser does not load every API.`}
                onClick={() => setToolMode('ai')}
              />
              <ToolModeCard
                active={toolMode === 'manual'}
                icon={Boxes}
                title='Manually limit tools'
                detail='Search, sort, and page through the catalog before selecting the exact tools this run may use.'
                onClick={() => {
                  setToolMode('manual')
                  setSelectedTools(current => {
                    if (current.length > 0) {
                      return current
                    }

                    const fallbackTool =
                      initialAgentTool ?? (products[0]?.slug as AgentToolSlug)

                    return fallbackTool ? [fallbackTool] : []
                  })
                }}
              />
            </div>

            {toolMode === 'manual' ? (
              <ManualToolTable
                products={products}
                selectedTools={selectedTools}
                toggleTool={toggleTool}
                setSelectedTools={setSelectedTools}
                toolTable={toolTable}
                toolSearch={toolSearch}
                setToolSearch={setToolSearch}
                searchTools={searchTools}
                goToToolsPage={goToToolsPage}
                buildToolsHref={buildToolsHref}
              />
            ) : (
              <div className='border-foreground/10 bg-muted/30 rounded-lg border p-4'>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                  <p className='font-semibold'>AI chooses server-side</p>
                  <Badge>Auto catalog</Badge>
                </div>
                <p className='text-foreground/60 mt-2 text-sm leading-6'>
                  the app sends the run intent to the backend. The planner sees
                  the current agent-ready catalog, quotes each selected tool,
                  skips irrelevant or over-budget calls, and records receipts
                  only for paid actions it executes.
                </p>
              </div>
            )}
          </StepCard>

          <StepCard
            icon={Wallet}
            eyebrow='Step 3'
            title='Funded budget'
            description='The connected wallet owns the run and funds the budget vault after creation.'
          >
            <div className='grid gap-4 lg:grid-cols-[1fr_320px]'>
              <div className='border-border bg-primary/5 rounded-lg border p-4 text-sm leading-6'>
                Agent runs are created first, then funded on the run page with a
                PYUSD deposit into the agent budget vault before any paid action
                can execute. Unused budget can be refunded to the owner.
              </div>
              <div className='space-y-2'>
                <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Owner wallet
                </span>
                <input
                  type='hidden'
                  name='ownerWallet'
                  value={address ?? ''}
                  required
                />
                <div className='border-foreground/10 bg-muted/30 text-foreground min-h-11 rounded-lg border px-4 py-3 text-sm font-semibold break-all'>
                  {address ?? 'Connect a wallet to create an agent run'}
                </div>
              </div>
              <label className='space-y-2'>
                <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Budget
                </span>
                <Input
                  name='budgetCapUsdt'
                  type='number'
                  step='0.01'
                  min='0.08'
                  defaultValue={(
                    template?.recommendedBudgetUsdt ?? 0.9
                  ).toFixed(2)}
                  required
                />
              </label>
              <label className='space-y-2'>
                <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                  Max paid actions
                </span>
                <Input
                  name='maxPaidActions'
                  type='number'
                  min='1'
                  max='4'
                  defaultValue={template?.maxPaidActions ?? 4}
                  required
                />
              </label>
            </div>
          </StepCard>

          <StepCard
            icon={FileCheck2}
            eyebrow='Step 4'
            title='Review and create'
            description='Create the run, then fund it on the next page before the agent can spend.'
          >
            <div className='grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center'>
              <div className='border-foreground/10 bg-muted/30 rounded-lg border p-4'>
                <div className='flex items-center justify-between gap-3'>
                  <span className='text-sm font-semibold'>Allowed tools</span>
                  <Badge>
                    {toolMode === 'ai'
                      ? `${toolTable.totalRows.toLocaleString()} available`
                      : selectedTools.length}
                  </Badge>
                </div>
                <p className='text-foreground/60 mt-2 text-sm leading-6'>
                  {toolMode === 'ai'
                    ? 'OpenAI chooses relevant tools from the server-side agent-ready catalog.'
                    : 'OpenAI chooses only from the manually selected tools.'}{' '}
                  the gateway still quotes, pays, and records receipts.
                </p>
              </div>
              <Button
                type='submit'
                className='min-h-12 w-full lg:w-56'
                disabled={
                  isSubmitting ||
                  (toolMode === 'manual' && selectedTools.length === 0) ||
                  (toolMode === 'ai' && toolTable.totalRows === 0) ||
                  !isConnected ||
                  !address
                }
              >
                <FileCheck2 className='h-4 w-4' aria-hidden />
                {isSubmitting ? 'Preparing' : 'Create run'}
              </Button>
            </div>
            {!isConnected || !address ? (
              <p className='border-foreground/10 bg-muted/30 text-foreground/70 rounded-lg border p-3 text-sm leading-6'>
                Connect your wallet first so the gateway can assign ownership
                and prepare the funded budget vault.
              </p>
            ) : null}
            {error ? (
              <p
                className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300'
                role='alert'
              >
                {error}
              </p>
            ) : null}
          </StepCard>
        </form>
      )}
    </WalletAddressConsumer>
  )

  function buildToolsHref({
    page,
    query = toolTable.query,
    sort = toolTable.sort,
    dir = toolTable.dir
  }: {
    page: number
    query?: string
    sort?: string
    dir?: ServerTableDirection
  }) {
    const params = new URLSearchParams()

    if (template?.id) {
      params.set('template', template.id)
    }

    if (initialTool) {
      params.set('tool', initialTool)
    }

    if (query) {
      params.set('q', query)
    }

    params.set('sort', sort)
    params.set('dir', dir)
    params.set('page', String(page))
    params.set('pageSize', String(toolTable.pageSize))

    return `/agents/new?${params.toString()}`
  }
}

function readStoredSelectedTools(
  key: string,
  initialTool: AgentToolSlug | undefined
) {
  if (typeof window === 'undefined') {
    return initialTool ? [initialTool] : []
  }

  const stored = window.sessionStorage.getItem(key)

  if (!stored) {
    return initialTool ? [initialTool] : []
  }

  try {
    const parsed = JSON.parse(stored) as unknown

    if (!Array.isArray(parsed)) {
      return initialTool ? [initialTool] : []
    }

    const selected = parsed.filter(
      value => typeof value === 'string' && value.trim().length > 0
    ) as AgentToolSlug[]

    return selected.length > 0 || !initialTool ? selected : [initialTool]
  } catch {
    return initialTool ? [initialTool] : []
  }
}

function ManualToolTable({
  products,
  selectedTools,
  toggleTool,
  setSelectedTools,
  toolTable,
  toolSearch,
  setToolSearch,
  searchTools,
  goToToolsPage,
  buildToolsHref
}: {
  products: ToolRow[]
  selectedTools: AgentToolSlug[]
  toggleTool: (tool: AgentToolSlug) => void
  setSelectedTools: Dispatch<SetStateAction<AgentToolSlug[]>>
  toolTable: ToolTableState
  toolSearch: string
  setToolSearch: (value: string) => void
  searchTools: () => void
  goToToolsPage: (page: number) => void
  buildToolsHref: (options: {
    page: number
    query?: string
    sort?: string
    dir?: ServerTableDirection
  }) => string
}) {
  const tableId = 'agent-manual-tools'
  const currentPageIds = products.map(product => product.slug)

  return (
    <div className='border-border overflow-hidden rounded-lg border'>
      <div className='border-border bg-background/50 border-b p-4'>
        <div className='grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center'>
          <label className='border-border bg-card focus-within:ring-ring/35 flex min-h-11 items-center gap-3 rounded-lg border px-3 transition focus-within:ring-2'>
            <Search className='text-foreground/50 h-4 w-4' aria-hidden />
            <span className='sr-only'>Search agent tools</span>
            <input
              value={toolSearch}
              onChange={event => setToolSearch(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  searchTools()
                }
              }}
              placeholder='Search tools, providers, categories, or prices'
              className='placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-sm outline-none'
            />
          </label>
          <div className='flex flex-wrap items-center gap-2'>
            <Button type='button' variant='outline' onClick={searchTools}>
              Search
            </Button>
            <span className='text-muted-foreground text-sm'>
              {toolTable.totalRows.toLocaleString()} results
            </span>
          </div>
        </div>
        <div className='mt-3'>
          <ServerDataTableSelection
            tableId={tableId}
            selectedIds={selectedTools}
            onSelectionChange={ids => setSelectedTools(ids as AgentToolSlug[])}
            currentPageIds={currentPageIds}
            selectedLabel='selected tools'
          />
        </div>
        {selectedTools.length === 0 ? (
          <p className='mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-200'>
            Select at least one tool before creating a manual agent run.
          </p>
        ) : null}
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-[760px] text-left text-sm'>
          <thead className='bg-muted/30 text-muted-foreground'>
            <tr>
              <th className='w-12 px-4 py-3'>
                <span className='sr-only'>Select</span>
              </th>
              {[
                ['name', 'Tool'],
                ['provider', 'Provider'],
                ['category', 'Category'],
                ['price', 'Price']
              ].map(([sort, label]) => (
                <th
                  key={sort}
                  className='px-4 py-3 text-xs font-semibold tracking-[0.12em] uppercase'
                >
                  <ServerDataTableSortButton
                    href={buildToolsHref({
                      page: 1,
                      sort,
                      dir:
                        toolTable.sort === sort && toolTable.dir === 'desc'
                          ? 'asc'
                          : 'desc'
                    })}
                    label={label}
                    active={toolTable.sort === sort}
                    dir={toolTable.dir}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='divide-border divide-y'>
            {products.map(product => {
              const checked = selectedTools.includes(product.slug)

              return (
                <tr key={product.slug} className='hover:bg-muted/25 transition'>
                  <td className='px-4 py-4 align-top'>
                    <input
                      value={product.slug}
                      data-table-id={tableId}
                      data-row-checkbox
                      type='checkbox'
                      checked={checked}
                      onChange={() => toggleTool(product.slug)}
                      aria-label={`Select ${product.name}`}
                      className='border-border text-primary focus:ring-ring h-4 w-4 rounded'
                    />
                  </td>
                  <td className='px-4 py-4 align-top'>
                    <p className='font-semibold'>{product.name}</p>
                    <p className='text-muted-foreground mt-1 max-w-md text-xs break-all'>
                      {product.slug}
                    </p>
                  </td>
                  <td className='px-4 py-4 align-top'>
                    {product.providerName}
                  </td>
                  <td className='px-4 py-4 align-top capitalize'>
                    {product.category}
                  </td>
                  <td className='px-4 py-4 align-top font-semibold'>
                    {product.priceLabel}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {products.length === 0 ? (
        <div className='p-8 text-center'>
          <p className='text-lg font-semibold'>No tools match this search</p>
          <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6'>
            Clear the search or publish an agent-ready marketplace product.
          </p>
        </div>
      ) : null}

      <div className='border-border flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          Page {toolTable.page} of {toolTable.totalPages}
        </p>
        <div className='flex gap-2'>
          <button
            type='button'
            disabled={toolTable.page <= 1}
            onClick={() => goToToolsPage(Math.max(1, toolTable.page - 1))}
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className: toolTable.page <= 1 ? 'opacity-50' : ''
            })}
          >
            <ChevronLeft className='h-4 w-4' aria-hidden />
            Previous
          </button>
          <button
            type='button'
            disabled={toolTable.page >= toolTable.totalPages}
            onClick={() =>
              goToToolsPage(Math.min(toolTable.totalPages, toolTable.page + 1))
            }
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className:
                toolTable.page >= toolTable.totalPages ? 'opacity-50' : ''
            })}
          >
            Next
            <ChevronRight className='h-4 w-4' aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}

function ToolModeCard({
  active,
  icon: Icon,
  title,
  detail,
  onClick
}: {
  active: boolean
  icon: LucideIcon
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'border-foreground/10 hover:border-primary/50 bg-card flex min-h-36 w-full gap-4 rounded-lg border p-4 text-left transition',
        active ? 'bg-primary/10 ring-primary/30 ring-1' : ''
      )}
    >
      <span className='bg-primary/10 text-primary flex h-11 w-11 shrink-0 items-center justify-center rounded-lg'>
        <Icon className='h-5 w-5' aria-hidden />
      </span>
      <span className='min-w-0'>
        <span className='block text-lg font-semibold'>{title}</span>
        <span className='text-foreground/60 mt-2 block text-sm leading-6'>
          {detail}
        </span>
      </span>
    </button>
  )
}

function StepCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  children
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className='space-y-5'>
      <SectionTitle icon={Icon} eyebrow={eyebrow} title={title} />
      <p className='text-muted-foreground max-w-3xl text-sm leading-6'>
        {description}
      </p>
      {children}
    </Card>
  )
}

function SectionTitle({
  icon: Icon,
  eyebrow,
  title
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
}) {
  return (
    <div className='flex items-start gap-3'>
      <span className='bg-primary/10 text-primary rounded-lg p-2'>
        <Icon className='h-4 w-4' aria-hidden />
      </span>
      <span>
        <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          {eyebrow}
        </span>
        <span className='mt-1 block text-lg font-semibold'>{title}</span>
      </span>
    </div>
  )
}
