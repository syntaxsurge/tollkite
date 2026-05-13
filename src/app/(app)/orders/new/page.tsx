import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { OrderCreateForm } from '@/features/marketplace/order-create-form'
import { getProductBySlug } from '@/features/marketplace/products'

type NewOrderPageProps = {
  searchParams: Promise<{
    product?: string
  }>
}

export default async function NewOrderPage({
  searchParams
}: NewOrderPageProps) {
  const { product: productSlug } = await searchParams
  const product = productSlug ? await getProductBySlug(productSlug) : null

  if (!product) {
    notFound()
  }

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6 shadow-sm'>
        <Badge>Paid API request</Badge>
        <div className='mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end'>
          <div className='space-y-3'>
            <h1 className='font-display max-w-4xl text-4xl leading-tight break-words'>
              {product.name}
            </h1>
            <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
              Create a payable request record for this API. No USDT is charged
              on this page; the paid response is returned after an x402 buyer
              client, backend, CLI, or agent signs and settles the payment.
            </p>
          </div>
          <Card className='bg-background/85'>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Amount
            </p>
            <p className='mt-2 text-2xl font-semibold'>{product.priceLabel}</p>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              Charged only after signed x402 settlement on the configured
              network.
            </p>
          </Card>
        </div>
      </section>

      <section className='space-y-5'>
        <Card className='grid gap-5 p-5 md:grid-cols-3'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Gateway endpoint
            </p>
            <p className='mt-2 font-mono text-sm font-semibold break-all'>
              {product.endpointPath}
            </p>
          </div>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Method
            </p>
            <p className='mt-2 font-semibold'>{product.method}</p>
          </div>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Provider
            </p>
            <p className='mt-2 font-semibold'>{product.providerName}</p>
          </div>
        </Card>
        <OrderCreateForm
          product={{
            slug: product.slug,
            name: product.name,
            requestSchema: product.requestSchema,
            referencePayload: product.referencePayload
          }}
        />
      </section>

      <div className='flex flex-col gap-3 sm:flex-row'>
        <Link
          href={`/marketplace/${product.slug}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          <ArrowLeft className='h-4 w-4' aria-hidden />
          API
        </Link>
      </div>
    </div>
  )
}
