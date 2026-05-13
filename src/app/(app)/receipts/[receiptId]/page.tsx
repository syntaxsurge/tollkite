import Link from 'next/link'

import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ReceiptDetailClient } from '@/features/marketplace/receipt-detail-client'
import { getMarketplaceReceiptById } from '@/features/marketplace/receipt-store'

type ReceiptDetailPageProps = {
  params: Promise<{
    receiptId: string
  }>
}

export default async function ReceiptDetailPage({
  params
}: ReceiptDetailPageProps) {
  const { receiptId } = await params
  const receipt = (await getMarketplaceReceiptById(receiptId)) ?? null

  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>USDT receipt</Badge>
        <div className='mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end'>
          <div className='max-w-3xl space-y-3'>
            <h1 className='font-display text-4xl'>Settlement receipt</h1>
            <p className='text-foreground/70 text-sm leading-6'>
              Confirm payment, network, transaction, and fee split.
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

      <Card>
        <ReceiptDetailClient receiptId={receiptId} initialReceipt={receipt} />
      </Card>
    </div>
  )
}
