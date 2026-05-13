import Link from 'next/link'

import {
  ArrowLeft,
  Bot,
  CircleDollarSign,
  type LucideIcon,
  Sparkles,
  WalletCards
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { AgentRunCreateForm } from '@/features/agents/agent-run-create-form'
import {
  type AgentTemplate,
  getAgentTemplate
} from '@/features/agents/templates'
import { getPublishedProducts } from '@/features/marketplace/products'
import {
  queryServerRows,
  resolveServerTableState
} from '@/lib/table/server-table'

type NewAgentRunPageProps = {
  searchParams?: Promise<{
    template?: string
    tool?: string
    q?: string
    sort?: string
    dir?: string
    page?: string
    pageSize?: string
  }>
}

export default async function NewAgentRunPage({
  searchParams
}: NewAgentRunPageProps) {
  const params = await searchParams
  const template = getAgentTemplate(params?.template)
  const initialTool = params?.tool
  const agentReadyProducts = (await getPublishedProducts())
    .filter(product => product.isAgentReady)
    .map(product => ({
      slug: product.slug,
      name: product.name,
      priceLabel: product.priceLabel,
      providerName: product.providerName,
      category: product.category
    }))
  const toolState = resolveServerTableState(params, {
    defaultSort: 'name',
    defaultPageSize: 6
  })
  const products = queryServerRows(agentReadyProducts, toolState, {
    searchText: product =>
      [
        product.name,
        product.slug,
        product.providerName,
        product.category,
        product.priceLabel
      ].join(' '),
    sortValues: {
      name: product => product.name,
      provider: product => product.providerName,
      category: product => product.category,
      price: product => product.priceLabel
    }
  })
  const steps: { icon: LucideIcon; title: string; detail: string }[] = [
    { icon: Sparkles, title: 'Plan', detail: 'Select tools' },
    { icon: WalletCards, title: 'Pay', detail: 'x402 USDT' },
    { icon: CircleDollarSign, title: 'Earn', detail: '95-99% provider split' }
  ]

  return (
    <div className='space-y-6'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-5 sm:p-6'>
        <div className='grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center'>
          <div className='space-y-4'>
            <Badge className='w-fit'>
              <Bot className='h-3.5 w-3.5' aria-hidden />
              Launch Pack Agent
            </Badge>
            <div className='space-y-3'>
              <h1 className='font-display text-3xl text-balance sm:text-4xl'>
                {template
                  ? `Create ${template.title}`
                  : 'Create an autonomous paid run.'}
              </h1>
              <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
                {template
                  ? template.summary
                  : 'Start blank or choose a template from the agents page. OpenAI plans; the gateway pays and proves.'}
              </p>
            </div>
          </div>
          <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1'>
            {steps.map(({ icon: Icon, title, detail }) => (
              <div
                key={title}
                className='border-foreground/10 bg-background/85 rounded-lg border p-4'
              >
                <Icon className='text-primary h-4 w-4' aria-hidden />
                <p className='mt-3 font-semibold'>{title}</p>
                <p className='text-foreground/60 mt-1 text-sm'>{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <AgentRunCreateForm
        products={products.rows}
        toolTable={{
          query: toolState.q,
          sort: toolState.sort,
          dir: toolState.dir,
          page: products.page,
          pageSize: products.pageSize,
          totalRows: products.totalRows,
          totalPages: products.totalPages
        }}
        template={template ? serializeAgentTemplate(template) : undefined}
        initialTool={initialTool}
      />
      <Link
        href='/agents'
        className={buttonClasses({ variant: 'outline', size: 'sm' })}
      >
        <ArrowLeft className='h-4 w-4' aria-hidden />
        Agents
      </Link>
    </div>
  )
}

function serializeAgentTemplate(template: AgentTemplate) {
  const { icon: _icon, ...serializableTemplate } = template

  return serializableTemplate
}
