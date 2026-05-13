import * as React from 'react'

import { cn } from '@/lib/utils/cn'

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'border-brand-cyan/30 bg-accent/10 text-primary shadow-brand-cyan/10 dark:text-accent inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold shadow-sm',
        className
      )}
      {...props}
    />
  )
}
