import Image from 'next/image'
import Link from 'next/link'

import {
  ArrowRight,
  Bot,
  Braces,
  CircleDollarSign,
  Clapperboard,
  Code2,
  DatabaseZap,
  FileCheck2,
  KeyRound,
  Plug,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Store,
  WalletCards,
  Workflow,
  Zap
} from 'lucide-react'

import { AuthRequiredToast } from '@/components/feedback/auth-required-toast'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getFeaturedProduct,
  getMarketplaceMetrics
} from '@/features/marketplace/products'

type MarketingPageSearchParams = {
  auth?: string
  next?: string
}

function formatCompactLabel(value: string) {
  return value.replaceAll('_', ' ')
}

const audiencePaths = [
  {
    icon: Bot,
    title: 'Run agents',
    detail: 'Give OpenAI a goal, fund a budget, and let it buy tools.'
  },
  {
    icon: Store,
    title: 'Buy APIs',
    detail: 'Run paid endpoints from the browser or from your backend.'
  },
  {
    icon: Plug,
    title: 'Sell access',
    detail: 'List your own API or a service you are allowed to resell.'
  }
]

const agentFlow = [
  { icon: Sparkles, title: 'Plan', detail: 'AI picks tools' },
  { icon: WalletCards, title: 'Pay', detail: 'Budgeted PYUSD' },
  { icon: DatabaseZap, title: 'Work', detail: 'Provider APIs run' },
  { icon: FileCheck2, title: 'Prove', detail: 'Receipts + hash' }
]

const productTypes = [
  {
    icon: Clapperboard,
    title: 'Async media',
    detail: 'Video, design, rendering'
  },
  {
    icon: Braces,
    title: 'Data wrappers',
    detail: 'No-key public data tools'
  },
  {
    icon: Code2,
    title: 'Developer APIs',
    detail: 'Docs, repos, packages'
  },
  {
    icon: Workflow,
    title: 'Agent tools',
    detail: 'Tool calls with receipts'
  }
]

const providerBenefits = [
  {
    icon: CircleDollarSign,
    title: 'Earn per request',
    detail: 'Set fixed or metered pricing.'
  },
  {
    icon: KeyRound,
    title: 'Keep keys private',
    detail: 'the gateway forwards securely server-side.'
  },
  {
    icon: ShieldCheck,
    title: 'Protect failures',
    detail: 'Escrow handles release, retry, or refund.'
  },
  {
    icon: ReceiptText,
    title: 'Show proof',
    detail: 'Receipts connect spend to results.'
  }
]

export default async function MarketingPage({
  searchParams
}: {
  searchParams: Promise<MarketingPageSearchParams>
}) {
  const params = await searchParams
  const featuredProduct = await getFeaturedProduct()
  const metrics = await getMarketplaceMetrics()

  return (
    <div className='bg-app-grid relative overflow-hidden'>
      <AuthRequiredToast reason={params.auth} nextPath={params.next} />

      <section className='container-page relative isolate py-16 sm:py-20 lg:py-24'>
        <div className='pointer-events-none absolute inset-y-8 right-0 -z-10 hidden w-1/2 items-center justify-center lg:flex'>
          <Image
            src='/images/tollkite-logo.png'
            alt=''
            width={520}
            height={520}
            priority
            className='opacity-15 blur-[1px] dark:opacity-20'
          />
        </div>

        <div className='max-w-4xl space-y-7'>
          <Badge className='w-fit'>
            <Sparkles className='h-3.5 w-3.5' aria-hidden />
            Kite-native API commerce
          </Badge>
          <div className='space-y-5'>
            <h1 className='font-display max-w-4xl text-4xl leading-tight font-semibold text-balance sm:text-5xl lg:text-6xl'>
              Paid APIs for humans, apps, and autonomous agents.
            </h1>
            <p className='text-lead max-w-2xl'>
              The gateway lets providers sell API calls, developers buy them
              with x402, and OpenAI agents spend from funded budgets with
              receipts.
            </p>
          </div>
          <div className='flex flex-wrap gap-3'>
            <Link href='/agents/new' className={buttonClasses({ size: 'lg' })}>
              Create agent run
              <ArrowRight className='h-4 w-4' aria-hidden />
            </Link>
            <Link
              href='/provider/products/new'
              className={buttonClasses({ variant: 'outline', size: 'lg' })}
            >
              List an API
            </Link>
            <Link
              href='/marketplace'
              className={buttonClasses({ variant: 'ghost', size: 'lg' })}
            >
              Browse marketplace
            </Link>
          </div>
        </div>

        <div className='mt-10 grid gap-3 sm:grid-cols-3'>
          {[
            { label: 'Agent-ready APIs', value: metrics.productCount },
            { label: 'Provider share', value: metrics.providerShareRangeLabel },
            { label: 'Settlement rail', value: 'PYUSD' }
          ].map(item => (
            <div
              key={item.label}
              className='border-border bg-card/95 rounded-lg border p-4 shadow-sm'
            >
              <p className='text-muted-foreground text-xs tracking-[0.16em] uppercase'>
                {item.label}
              </p>
              <p className='text-foreground mt-2 text-2xl font-semibold'>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className='container-page grid gap-4 pb-12 md:grid-cols-3'>
        {audiencePaths.map(({ icon: Icon, title, detail }) => (
          <Card key={title} className='min-h-40'>
            <div className='bg-primary/10 text-primary flex h-11 w-11 items-center justify-center rounded-lg'>
              <Icon className='h-5 w-5' aria-hidden />
            </div>
            <h2 className='mt-5 text-xl font-semibold'>{title}</h2>
            <p className='text-muted-foreground mt-2 text-sm leading-6'>
              {detail}
            </p>
          </Card>
        ))}
      </section>

      <section className='container-page py-12'>
        <div className='grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch'>
          <div className='space-y-4'>
            <Badge className='w-fit'>Agent flow</Badge>
            <h2 className='font-display text-3xl font-semibold text-balance'>
              From goal to audited result in four steps.
            </h2>
            <p className='text-muted-foreground max-w-lg text-sm leading-6'>
              The agent chooses, the gateway pays, providers work, and the proof
              page records what happened.
            </p>
          </div>
          <div className='grid gap-3 sm:grid-cols-4'>
            {agentFlow.map(({ icon: Icon, title, detail }) => (
              <Card key={title} className='p-5'>
                <Icon className='text-primary h-5 w-5' aria-hidden />
                <p className='mt-4 font-semibold'>{title}</p>
                <p className='text-muted-foreground mt-1 text-sm'>{detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {featuredProduct ? (
        <section className='container-page py-12'>
          <div className='border-border bg-card/95 grid gap-6 rounded-lg border p-5 shadow-sm lg:grid-cols-[1fr_0.8fr] lg:items-center lg:p-7'>
            <div className='space-y-4'>
              <Badge className='w-fit'>
                <Clapperboard className='h-3.5 w-3.5' aria-hidden />
                Featured provider
              </Badge>
              <div>
                <h2 className='font-display text-3xl font-semibold text-balance'>
                  {featuredProduct.providerName}: {featuredProduct.name}
                </h2>
                <p className='text-muted-foreground mt-3 max-w-2xl text-sm leading-6'>
                  {featuredProduct.description}
                </p>
              </div>
              <div className='flex flex-wrap gap-3'>
                <Link
                  href={`/marketplace/${featuredProduct.slug}`}
                  className={buttonClasses({ size: 'sm' })}
                >
                  View API
                </Link>
                <Link
                  href={`/agents/new?tool=${featuredProduct.slug}`}
                  className={buttonClasses({ variant: 'outline', size: 'sm' })}
                >
                  Use in agent
                </Link>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              {[
                ['Price', featuredProduct.priceLabel],
                ['Mode', formatCompactLabel(featuredProduct.executionMode)],
                ['Result', formatCompactLabel(featuredProduct.resultDelivery)],
                ['Latency', featuredProduct.estimatedLatency]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className='bg-muted/40 border-border rounded-lg border p-4'
                >
                  <p className='text-muted-foreground text-xs tracking-[0.16em] uppercase'>
                    {label}
                  </p>
                  <p className='mt-2 text-sm font-semibold break-words'>
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className='container-page py-12'>
        <div className='mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end'>
          <div>
            <Badge className='w-fit'>What can be sold</Badge>
            <h2 className='font-display mt-3 text-3xl font-semibold'>
              Any useful API can become a paid tool.
            </h2>
          </div>
          <Link
            href='/developers/docs'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Read provider docs
          </Link>
        </div>
        <div className='grid gap-4 md:grid-cols-4'>
          {productTypes.map(({ icon: Icon, title, detail }) => (
            <Card key={title} className='p-5'>
              <Icon className='text-primary h-5 w-5' aria-hidden />
              <p className='mt-4 font-semibold'>{title}</p>
              <p className='text-muted-foreground mt-1 text-sm'>{detail}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className='container-page py-12'>
        <div className='grid gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start'>
          <div className='space-y-4'>
            <Badge className='w-fit'>
              <CircleDollarSign className='h-3.5 w-3.5' aria-hidden />
              Provider revenue
            </Badge>
            <h2 className='font-display text-3xl font-semibold text-balance'>
              Monetize APIs without building billing from scratch.
            </h2>
            <Link
              href='/provider/products/new'
              className={buttonClasses({ size: 'lg' })}
            >
              List a paid API
              <ArrowRight className='h-4 w-4' aria-hidden />
            </Link>
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            {providerBenefits.map(({ icon: Icon, title, detail }) => (
              <Card key={title} className='p-5'>
                <Icon className='text-primary h-5 w-5' aria-hidden />
                <p className='mt-4 font-semibold'>{title}</p>
                <p className='text-muted-foreground mt-1 text-sm'>{detail}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className='container-page pt-10 pb-16'>
        <div className='border-border bg-card/95 rounded-lg border p-6 shadow-sm md:p-8'>
          <div className='grid gap-6 md:grid-cols-[1fr_auto] md:items-center'>
            <div className='space-y-3'>
              <Badge className='w-fit'>
                <Zap className='h-3.5 w-3.5' aria-hidden />
                Live workflow
              </Badge>
              <h2 className='font-display text-3xl font-semibold'>
                Start with a funded agent run.
              </h2>
              <p className='text-muted-foreground max-w-2xl text-sm leading-6'>
                Pick a template, fund the budget vault, let OpenAI choose paid
                tools, then inspect receipts and proof.
              </p>
            </div>
            <Link href='/agents' className={buttonClasses({ size: 'lg' })}>
              Open agents
              <ArrowRight className='h-4 w-4' aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
