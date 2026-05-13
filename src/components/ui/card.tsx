import * as React from 'react'

import { cn } from '@/lib/utils/cn'

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-border/80 bg-card/90 shadow-brand-blue/5 rounded-lg border p-6 shadow-sm backdrop-blur transition duration-200 ease-out',
        className
      )}
      {...props}
    />
  )
}
