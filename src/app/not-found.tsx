import Link from 'next/link'

import { buttonClasses } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className='grid min-h-[60vh] place-items-center px-6'>
      <div className='flex max-w-md flex-col items-center gap-4 text-center'>
        <p className='text-foreground/60 text-xs font-semibold tracking-[0.3em] uppercase'>
          404
        </p>
        <h1 className='font-display text-3xl'>Page not found.</h1>
        <p className='text-foreground/70 text-sm'>
          The page you were looking for moved or never existed.
        </p>
        <Link href='/' className={buttonClasses({ variant: 'outline' })}>
          Back to home
        </Link>
      </div>
    </div>
  )
}
