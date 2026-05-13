import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { OrderStatusClient } from '@/features/marketplace/order-status-client'
import { getMarketplaceOrderById } from '@/features/marketplace/orders'

type OrderDetailPageProps = {
  params: Promise<{
    orderId: string
  }>
}

export default async function OrderDetailPage({
  params
}: OrderDetailPageProps) {
  const { orderId } = await params
  const order = (await getMarketplaceOrderById(orderId)) ?? null

  return (
    <div className='space-y-6'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6 lg:p-8'>
        <Badge>Order detail</Badge>
        <div className='mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-3xl sm:text-4xl'>
              Run & Pay playground
            </h1>
            <p className='text-foreground/70 text-base leading-7'>
              Pay, settle, and inspect one hosted API request.
            </p>
          </div>
          <Link
            href='/orders'
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <ArrowLeft className='h-4 w-4' aria-hidden />
            Orders
          </Link>
        </div>
      </section>
      <OrderStatusClient orderId={orderId} initialOrder={order} />
    </div>
  )
}
