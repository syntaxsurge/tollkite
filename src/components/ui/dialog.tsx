'use client'

import * as React from 'react'

import { X } from 'lucide-react'

import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'

type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className
}: DialogProps) {
  React.useEffect(() => {
    if (!open) {
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onOpenChange, open])

  if (!open) {
    return null
  }

  return (
    <div
      className='fixed inset-0 z-50 grid place-items-center p-4'
      role='presentation'
    >
      <button
        type='button'
        className='absolute inset-0 bg-black/55 backdrop-blur-sm'
        aria-label='Close dialog'
        onClick={() => onOpenChange(false)}
      />
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='dialog-title'
        aria-describedby={description ? 'dialog-description' : undefined}
        className={cn(
          'bg-card text-foreground border-border shadow-brand-blue/15 relative flex max-h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden rounded-lg border shadow-2xl',
          className
        )}
      >
        <div className='border-border flex items-start justify-between gap-4 border-b p-5'>
          <div className='min-w-0'>
            <h2 id='dialog-title' className='font-display text-2xl'>
              {title}
            </h2>
            {description ? (
              <p
                id='dialog-description'
                className='text-muted-foreground mt-2 text-sm leading-6'
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type='button'
            onClick={() => onOpenChange(false)}
            aria-label='Close dialog'
            className={buttonClasses({
              variant: 'ghost',
              size: 'sm',
              className: 'h-9 w-9 shrink-0 px-0'
            })}
          >
            <X className='h-4 w-4' aria-hidden />
          </button>
        </div>
        <div className='min-h-0 overflow-y-auto p-5'>{children}</div>
      </section>
    </div>
  )
}
