'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className='grid min-h-[60vh] place-items-center px-6'>
      <div className='flex max-w-md flex-col items-center gap-4 text-center'>
        <h1 className='font-display text-3xl'>Something went sideways.</h1>
        <p className='text-foreground/70 text-sm'>
          We hit an unexpected snag. Try again or head back to the homepage.
        </p>
        <div className='flex gap-3'>
          <Button onClick={reset}>Try again</Button>
          <Button
            variant='outline'
            onClick={() => (window.location.href = '/')}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
