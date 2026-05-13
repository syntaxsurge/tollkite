'use client'

import { Button } from '@/components/ui/button'

export default function GlobalError({
  error: _error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang='en'>
      <body className='bg-background text-foreground min-h-screen'>
        <div className='grid min-h-screen place-items-center px-6'>
          <div className='flex max-w-md flex-col items-center gap-4 text-center'>
            <h1 className='font-display text-3xl'>We broke orbit.</h1>
            <p className='text-foreground/70 text-sm'>
              A global error stopped the app from loading. Try refreshing or
              reset the session.
            </p>
            <Button onClick={reset}>Reload</Button>
          </div>
        </div>
      </body>
    </html>
  )
}
