'use client'

import { useState } from 'react'

import { PauseCircle, Rocket, RotateCcw } from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'

import { Button } from '@/components/ui/button'
import type {
  ApiProduct,
  ApiProductStatus
} from '@/features/marketplace/products'
import { productStatusLabels } from '@/features/marketplace/status'

type ProductLifecycleControlsProps = {
  product: Pick<ApiProduct, 'slug' | 'status'>
}

export function ProductLifecycleControls({
  product
}: ProductLifecycleControlsProps) {
  const router = useRouter()
  const [status, setStatus] = useState<ApiProductStatus>(product.status)
  const [error, setError] = useState('')
  const [pendingStatus, setPendingStatus] = useState<ApiProductStatus | null>(
    null
  )

  async function updateStatus(nextStatus: ApiProductStatus) {
    setError('')
    setPendingStatus(nextStatus)

    try {
      const response = await fetch(
        `/api/providers/self/products/${product.slug}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        }
      )
      const payload = (await response.json()) as {
        status?: ApiProductStatus
        error?: string
      }

      if (!response.ok || !payload.status) {
        throw new Error(payload.error ?? 'Unable to update listing status.')
      }

      setStatus(payload.status)
      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update listing status.'
      )
    } finally {
      setPendingStatus(null)
    }
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap'>
        <Button
          type='button'
          onClick={() => updateStatus('published')}
          disabled={status === 'published' || Boolean(pendingStatus)}
        >
          <Rocket className='h-4 w-4' aria-hidden='true' />
          {pendingStatus === 'published'
            ? 'Publishing'
            : status === 'published'
              ? 'Listing is live'
              : 'Publish listing'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => updateStatus('paused')}
          disabled={status === 'paused' || Boolean(pendingStatus)}
        >
          <PauseCircle className='h-4 w-4' aria-hidden='true' />
          {pendingStatus === 'paused'
            ? 'Pausing'
            : status === 'paused'
              ? 'Listing is paused'
              : 'Pause listing'}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => updateStatus('draft')}
          disabled={status === 'draft' || Boolean(pendingStatus)}
        >
          <RotateCcw className='h-4 w-4' aria-hidden='true' />
          {pendingStatus === 'draft'
            ? 'Moving to draft'
            : status === 'draft'
              ? 'Saved as draft'
              : 'Move to draft'}
        </Button>
      </div>
      <p className='text-foreground/65 text-sm leading-6'>
        Current state: <strong>{productStatusLabels[status]}</strong>. Drafts
        are private to provider management. Published listings appear in the
        marketplace and can be selected by agents.
      </p>
      {error ? (
        <p className='text-sm text-red-600' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
