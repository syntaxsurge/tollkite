import Link from 'next/link'

import { Bot, ExternalLink, ShieldCheck } from 'lucide-react'

import { WalletOwnerCard } from '@/components/data-display/wallet-owner-card'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ApiProduct } from '@/features/marketplace/products'

type ProductCardProps = {
  product: ApiProduct
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Card className='flex min-h-[240px] flex-col gap-5'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge className='capitalize'>{product.category}</Badge>
        {product.isX402Protected ? (
          <Badge>
            <ShieldCheck className='h-3.5 w-3.5' aria-hidden />
            x402
          </Badge>
        ) : null}
        {product.isAgentReady ? (
          <Badge>
            <Bot className='h-3.5 w-3.5' aria-hidden />
            Agent
          </Badge>
        ) : null}
      </div>
      <div className='space-y-2'>
        <div>
          <h2 className='font-display mt-2 text-2xl'>{product.name}</h2>
        </div>
        <p className='text-foreground/70 line-clamp-2 text-sm leading-6'>
          {product.description}
        </p>
      </div>
      <WalletOwnerCard
        walletAddress={product.ownerWallet ?? product.providerWallet}
        displayName={product.providerName}
        compact
      />
      <div className='border-foreground/10 mt-auto flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <p className='text-foreground/60 text-xs font-semibold'>Price</p>
          <p className='text-lg font-semibold'>{product.priceLabel}</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Link
            href={`/agents/new?tool=${product.slug}`}
            className={buttonClasses({ variant: 'primary', size: 'sm' })}
          >
            <Bot className='h-4 w-4' aria-hidden />
            Run agent
          </Link>
          <Link
            href={`/marketplace/${product.slug}`}
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink className='h-4 w-4' aria-hidden />
            Details
          </Link>
        </div>
      </div>
    </Card>
  )
}
