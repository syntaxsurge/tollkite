import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  PauseCircle,
  Rocket,
  BarChart3
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CopyEndpointButton } from '@/features/marketplace/copy-endpoint-button'
import { DeleteProductButton } from '@/features/marketplace/delete-product-button'
import { OrderCreateForm } from '@/features/marketplace/order-create-form'
import { ProductLifecycleControls } from '@/features/marketplace/product-lifecycle-controls'
import {
  type ApiProduct,
  getProductBySlug
} from '@/features/marketplace/products'
import { productStatusLabels } from '@/features/marketplace/status'
import { cn } from '@/lib/utils/cn'

type ProviderProductPageProps = {
  params: Promise<{
    productId: string
  }>
}

export default async function ProviderProductPage({
  params
}: ProviderProductPageProps) {
  const { productId } = await params
  const product = await getProductBySlug(productId)

  if (!product) {
    notFound()
  }

  const checklist = getLaunchChecklist(product)

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <div className='flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between'>
          <div className='max-w-4xl space-y-4'>
            <Badge>API management</Badge>
            <div className='space-y-3'>
              <div className='flex flex-wrap items-center gap-3'>
                <h1 className='font-display text-4xl'>{product.name}</h1>
                <StatusPill status={product.status} />
              </div>
              <p className='text-foreground/70 max-w-3xl text-sm leading-6'>
                Publish, test, and inspect this listing.
              </p>
            </div>
          </div>
          <div className='flex flex-col gap-3 sm:flex-row xl:justify-end'>
            <Link
              href={`/orders/new?product=${product.slug}`}
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              Test
            </Link>
            <Link
              href={`/marketplace/${product.slug}`}
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className='h-4 w-4' aria-hidden='true' />
              View listing
            </Link>
            <DeleteProductButton
              productSlug={product.slug}
              productName={product.name}
              redirectTo='/provider/products'
            />
          </div>
        </div>
      </section>

      <section className='grid gap-5 xl:grid-cols-[1fr_0.8fr]'>
        <Card className='space-y-4'>
          <div className='flex items-center gap-3'>
            {product.status === 'published' ? (
              <Rocket className='text-primary h-5 w-5' aria-hidden='true' />
            ) : product.status === 'paused' ? (
              <PauseCircle
                className='text-foreground/60 h-5 w-5'
                aria-hidden='true'
              />
            ) : (
              <CircleAlert
                className='h-5 w-5 text-amber-500'
                aria-hidden='true'
              />
            )}
            <div>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Listing lifecycle
              </p>
              <h2 className='mt-1 text-2xl font-semibold'>
                {getStatusHeadline(product.status)}
              </h2>
            </div>
          </div>
          <ProductLifecycleControls
            product={{ slug: product.slug, status: product.status }}
          />
        </Card>

        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Launch checklist
          </p>
          <div className='space-y-3'>
            {checklist.map(item => (
              <div
                key={item.label}
                className='border-border/70 bg-background/40 flex gap-3 rounded-lg border p-3'
              >
                {item.ready ? (
                  <CheckCircle2
                    className='mt-0.5 h-5 w-5 shrink-0 text-emerald-500'
                    aria-hidden='true'
                  />
                ) : (
                  <CircleAlert
                    className='mt-0.5 h-5 w-5 shrink-0 text-amber-500'
                    aria-hidden='true'
                  />
                )}
                <div>
                  <p className='font-semibold'>{item.label}</p>
                  <p className='text-foreground/65 mt-1 text-sm leading-5'>
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          ['Price', product.priceLabel],
          ['Execution', formatEnumLabel(product.executionMode)],
          ['Result', formatEnumLabel(product.resultDelivery)],
          ['Success rate', product.successRate]
        ].map(([label, value]) => (
          <Card key={label} className='min-h-32'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              {label}
            </p>
            <p className='mt-3 text-2xl font-semibold break-words'>{value}</p>
          </Card>
        ))}
      </section>

      <OrderCreateForm
        compact
        providerDraftTest
        product={{
          slug: product.slug,
          name: product.name,
          requestSchema: product.requestSchema,
          referencePayload: product.referencePayload
        }}
      />

      <section className='grid gap-5 xl:grid-cols-[1fr_0.9fr]'>
        <Card className='space-y-5'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Gateway endpoint
            </p>
            <p className='mt-2 font-mono text-sm font-semibold break-words'>
              {product.endpointPath}
            </p>
          </div>
          {product.providerEndpointUrl ? (
            <div>
              <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
                Upstream endpoint
              </p>
              <p className='text-foreground/75 mt-2 text-sm break-words'>
                {product.providerEndpointUrl}
              </p>
            </div>
          ) : null}
          <div className='grid gap-3 md:grid-cols-3'>
            <CopyEndpointButton endpoint={product.endpointPath} />
            <Link
              href='/provider/usage'
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              <BarChart3 className='h-4 w-4' aria-hidden />
              Usage
            </Link>
          </div>
        </Card>

        <Card className='space-y-4'>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Provider contract
          </p>
          <div className='grid gap-3 sm:grid-cols-2'>
            {[
              ['Auth', formatEnumLabel(product.providerAuth?.type ?? 'none')],
              ['Method', product.method],
              ['Timeout', `${product.timeoutSeconds ?? 60}s`],
              ['Agent-ready', product.isAgentReady ? 'Yes' : 'No']
            ].map(([label, value]) => (
              <div
                key={label}
                className='border-border/70 bg-background/40 rounded-lg border p-3'
              >
                <p className='text-foreground/55 text-xs tracking-[0.16em] uppercase'>
                  {label}
                </p>
                <p className='mt-2 font-semibold break-words'>{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className='grid gap-5 xl:grid-cols-2'>
        <SchemaPanel title='Request schema' schema={product.requestSchema} />
        <SchemaPanel title='Response schema' schema={product.responseSchema} />
      </section>
    </div>
  )
}

function StatusPill({ status }: { status: ApiProduct['status'] }) {
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.14em] uppercase',
        status === 'published' &&
          'border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        status === 'draft' &&
          'border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-300',
        status === 'paused' &&
          'border-foreground/15 bg-muted text-foreground/70'
      )}
    >
      {productStatusLabels[status]}
    </span>
  )
}

function SchemaPanel({
  title,
  schema
}: {
  title: string
  schema: Record<string, string>
}) {
  const entries = Object.entries(schema)

  return (
    <Card className='space-y-4'>
      <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {title}
      </p>
      {entries.length ? (
        <div className='space-y-3'>
          {entries.map(([field, type]) => (
            <div
              key={field}
              className='border-border/70 bg-background/40 grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]'
            >
              <p className='font-mono text-sm font-semibold break-words'>
                {field}
              </p>
              <p className='text-foreground/70 font-mono text-sm break-words'>
                {type}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className='text-foreground/65 text-sm leading-6'>
          No schema fields were published for this listing.
        </p>
      )}
    </Card>
  )
}

function getLaunchChecklist(product: ApiProduct) {
  return [
    {
      label: 'Endpoint is configured',
      ready: Boolean(product.providerEndpointUrl),
      detail: product.providerEndpointUrl
        ? 'the gateway can forward paid requests to the provider endpoint.'
        : 'Add the provider endpoint before publishing.'
    },
    {
      label: 'Pricing is configured',
      ready:
        product.pricing.model === 'fixed'
          ? product.priceUsd > 0
          : Boolean(product.pricing.creditUnitPath),
      detail:
        product.pricing.model === 'fixed'
          ? 'This API charges a fixed x402 amount per request.'
          : 'This API quotes or reports usage credits before settlement.'
    },
    {
      label: 'Request schema is usable',
      ready: Object.keys(product.requestSchema).length > 0,
      detail:
        'The test builder uses this schema to generate validated request fields.'
    },
    {
      label: 'Agent availability is set',
      ready: product.isAgentReady,
      detail: product.isAgentReady
        ? 'Autonomous agent runs can select this tool after publication.'
        : 'Turn on agent readiness if agents should be allowed to buy this API.'
    },
    {
      label: 'Listing is published',
      ready: product.status === 'published',
      detail:
        product.status === 'published'
          ? 'The product is live in the marketplace.'
          : 'Publish when the payable test flow works as expected.'
    }
  ]
}

function getStatusHeadline(status: ApiProduct['status']) {
  if (status === 'published') {
    return 'Live in the marketplace'
  }

  if (status === 'paused') {
    return 'Temporarily hidden from buyers'
  }

  return 'Draft ready for testing'
}

function formatEnumLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
}
