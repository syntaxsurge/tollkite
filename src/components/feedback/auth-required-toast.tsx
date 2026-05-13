'use client'

import * as React from 'react'

import { ShieldAlert, X } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type AuthRequiredToastProps = {
  reason?: string
  nextPath?: string
}

export function AuthRequiredToast({
  reason,
  nextPath
}: AuthRequiredToastProps) {
  const [isVisible, setIsVisible] = React.useState(reason === 'wallet_required')

  React.useEffect(() => {
    if (reason !== 'wallet_required') {
      return
    }

    setIsVisible(true)
    removeAuthReasonFromUrl()

    const timeout = window.setTimeout(() => {
      setIsVisible(false)
    }, 8000)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [reason])

  if (!isVisible) {
    return null
  }

  return (
    <div
      role='status'
      aria-live='polite'
      className={cn(
        'fixed right-4 bottom-4 z-50 w-[calc(100vw-2rem)] max-w-md',
        'border-foreground/10 bg-card text-foreground rounded-lg border p-4 shadow-xl'
      )}
    >
      <div className='flex gap-3'>
        <div className='bg-accent/15 text-accent mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'>
          <ShieldAlert className='h-5 w-5' aria-hidden />
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-sm font-semibold'>Wallet connection required</p>
          <p className='text-foreground/65 mt-1 text-sm leading-6'>
            Connect your wallet before opening protected pages
            {nextPath ? ` like ${nextPath}` : ''}.
          </p>
        </div>
        <button
          type='button'
          onClick={() => setIsVisible(false)}
          aria-label='Dismiss authentication notice'
          className={buttonClasses({
            variant: 'ghost',
            size: 'sm',
            className: 'h-8 w-8 shrink-0 px-0'
          })}
        >
          <X className='h-4 w-4' aria-hidden />
        </button>
      </div>
    </div>
  )
}

function removeAuthReasonFromUrl() {
  const url = new URL(window.location.href)

  if (!url.searchParams.has('auth')) {
    return
  }

  url.searchParams.delete('auth')
  window.history.replaceState(
    null,
    '',
    `${url.pathname}${url.search}${url.hash}`
  )
}
