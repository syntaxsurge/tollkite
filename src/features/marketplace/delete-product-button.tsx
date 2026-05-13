'use client'

import { useState } from 'react'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'

import { Button } from '@/components/ui/button'

type DeleteProductButtonProps = {
  productSlug: string
  productName: string
  redirectTo?: string
}

export function DeleteProductButton({
  productSlug,
  productName,
  redirectTo
}: DeleteProductButtonProps) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  async function deleteProduct() {
    setError('')

    const confirmed = window.confirm(
      `Delete "${productName}"? This removes the listing from provider management and the marketplace catalog.`
    )

    if (!confirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const response = await fetch(
        `/api/providers/self/products/${productSlug}`,
        {
          method: 'DELETE',
          headers: { Accept: 'application/json' }
        }
      )
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        throw new Error(body?.error ?? 'Unable to delete this API product.')
      }

      if (redirectTo) {
        router.push(redirectTo)
        return
      }

      router.refresh()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to delete this API product.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className='space-y-2'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={deleteProduct}
        disabled={isDeleting}
        className='border-red-500/30 text-red-700 hover:border-red-500/60 hover:bg-red-500/10 dark:text-red-300'
      >
        <Trash2 className='h-4 w-4' aria-hidden='true' />
        {isDeleting ? 'Deleting' : 'Delete'}
      </Button>
      {error ? (
        <p className='text-sm text-red-600' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
