'use client'

import Link from 'next/link'
import * as React from 'react'

import { Loader2, MoreVertical, Settings, Trash2 } from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'

import { Button, buttonClasses } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import type { ApiProduct } from '@/features/marketplace/products'

export function ProviderProductRowActions({ product }: { product: ApiProduct }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [error, setError] = React.useState('')
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [menuOpen])

  async function deleteProduct() {
    setIsDeleting(true)
    setError('')

    try {
      const response = await fetch(
        `/api/providers/self/products/${product.slug}`,
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

      removeRow(product.slug)
      setDeleteOpen(false)
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
    <div className='relative' ref={menuRef}>
      <button
        type='button'
        aria-label={`Open actions for ${product.name}`}
        aria-haspopup='menu'
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
        className={buttonClasses({
          variant: 'ghost',
          size: 'sm',
          className: 'h-9 w-9 px-0'
        })}
      >
        <MoreVertical className='h-4 w-4' aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role='menu'
          className='border-border bg-card absolute right-0 z-20 mt-2 w-48 rounded-lg border p-1 shadow-xl'
        >
          <Link
            href={`/provider/products/${product.slug}`}
            role='menuitem'
            className='hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm'
            onClick={() => setMenuOpen(false)}
          >
            <Settings className='h-4 w-4' aria-hidden />
            Manage listing
          </Link>
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              setMenuOpen(false)
              setDeleteOpen(true)
            }}
            className='hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 dark:text-red-400'
          >
            <Trash2 className='h-4 w-4' aria-hidden />
            Delete
          </button>
        </div>
      ) : null}

      <Dialog
        open={deleteOpen}
        onOpenChange={open => {
          if (!open && !isDeleting) {
            setDeleteOpen(false)
            setError('')
          }
        }}
        title='Delete API product'
        description='This removes the listing from provider management and marketplace discovery.'
        className='max-w-xl'
      >
        <div className='space-y-5'>
          <div className='rounded-lg border border-red-500/25 bg-red-500/10 p-4'>
            <p className='font-semibold'>Delete {product.name}?</p>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              This only deletes provider-created listings owned by the connected
              wallet.
            </p>
            <p className='text-foreground/70 mt-3 font-mono text-xs break-all'>
              {product.slug}
            </p>
          </div>

          {error ? (
            <p
              className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300'
              role='alert'
            >
              {error}
            </p>
          ) : null}

          <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              disabled={isDeleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={isDeleting}
              className='bg-red-600 text-white hover:bg-red-700'
              onClick={() => void deleteProduct()}
            >
              {isDeleting ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <Trash2 className='h-4 w-4' aria-hidden />
              )}
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function removeRow(rowId: string) {
  const row = document.querySelector(
    `[data-table-row-id="${CSS.escape(rowId)}"]`
  )
  const tableId = row
    ?.closest('[data-server-table-id]')
    ?.getAttribute('data-server-table-id')

  row?.remove()

  if (tableId) {
    updateResultCount(tableId)
  }
}

function updateResultCount(tableId: string) {
  const element = document.querySelector<HTMLElement>(
    `[data-table-result-count="${CSS.escape(tableId)}"]`
  )

  if (!element) {
    return
  }

  const current = Number(element.dataset.tableTotalRows ?? 0)
  const next = Math.max(0, current - 1)

  element.dataset.tableTotalRows = String(next)
  element.textContent = `${next.toLocaleString()} result${next === 1 ? '' : 's'}`
}
