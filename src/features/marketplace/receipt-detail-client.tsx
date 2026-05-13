'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { buttonClasses } from '@/components/ui/button'
import type { MarketplaceReceipt } from '@/features/marketplace/receipts'

type ReceiptDetailClientProps = {
  receiptId: string
  initialReceipt: MarketplaceReceipt | null
}

export function ReceiptDetailClient({
  receiptId,
  initialReceipt
}: ReceiptDetailClientProps) {
  const [receipt, setReceipt] = useState<MarketplaceReceipt | null>(
    initialReceipt
  )

  useEffect(() => {
    if (receipt) {
      return
    }

    const saved = window.sessionStorage.getItem(`app:receipt:${receiptId}`)

    if (saved) {
      setReceipt(JSON.parse(saved) as MarketplaceReceipt)
    }
  }, [receipt, receiptId])

  if (!receipt) {
    return (
      <div>
        <p className='font-semibold'>Receipt not found</p>
        <p className='text-foreground/65 mt-2 text-sm leading-6'>
          The receipt record is not available in the current browser session.
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-5'>
      <div className='grid gap-4 md:grid-cols-3'>
        {[
          ['Product', receipt.productName],
          ['Amount', receipt.amountUsdt],
          ['Network', receipt.network]
        ].map(([label, value]) => (
          <div key={label} className='bg-muted rounded-lg p-4'>
            <p className='text-foreground/60 text-xs uppercase'>{label}</p>
            <p className='mt-1 font-semibold break-words'>{value}</p>
          </div>
        ))}
      </div>
      <div className='grid gap-3 text-sm md:grid-cols-2'>
        {[
          ['Receipt ID', receipt.id],
          ['Order ID', receipt.orderId],
          ['Request ID', receipt.requestId],
          ['Provider', receipt.providerName],
          ['Provider plan', receipt.providerPlan ?? 'free'],
          [
            'Provider share',
            receipt.providerShareBps
              ? `${receipt.providerShareBps / 100}%`
              : '95%'
          ],
          ['Buyer wallet', receipt.buyerWallet],
          ['Provider wallet', receipt.providerWallet],
          ['Platform fee', receipt.platformFeeUsdt],
          ['Provider amount', receipt.providerAmountUsdt],
          ['Transaction hash', receipt.txHash],
          ['Created', new Date(receipt.createdAt).toLocaleString()]
        ].map(([label, value]) => (
          <div
            key={label}
            className='border-foreground/10 rounded-lg border p-4'
          >
            <p className='text-foreground/60 text-xs uppercase'>{label}</p>
            <p className='mt-1 font-semibold break-words'>{value}</p>
          </div>
        ))}
      </div>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Link
          href={`/orders/${receipt.orderId}`}
          className={buttonClasses({ variant: 'outline', size: 'sm' })}
        >
          Open order
        </Link>
        {receipt.agentRunId ? (
          <Link
            href={`/agents/${receipt.agentRunId}`}
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Open agent run
          </Link>
        ) : null}
        {receipt.proofId ? (
          <Link
            href={`/proofs/${receipt.proofId}`}
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            Open proof
          </Link>
        ) : null}
        {receipt.explorerUrl ? (
          <a
            href={receipt.explorerUrl}
            target='_blank'
            rel='noreferrer'
            className={buttonClasses({ size: 'sm' })}
          >
            View transaction
          </a>
        ) : null}
      </div>
    </div>
  )
}
