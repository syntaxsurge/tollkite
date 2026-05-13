'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { ServerDataTableNavButton } from '@/components/data-display/server-data-table-nav-button'
import type { ServerTableDirection } from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

export function ServerDataTableSortButton({
  href,
  label,
  active,
  dir,
  className
}: {
  href: string
  label: string
  active: boolean
  dir: ServerTableDirection
  className?: string
}) {
  const Icon = active ? (dir === 'desc' ? ArrowDown : ArrowUp) : ChevronsUpDown

  return (
    <ServerDataTableNavButton
      href={href}
      className={cn(
        'hover:text-foreground group inline-flex items-center gap-2 rounded-md transition',
        active ? 'text-foreground' : 'text-muted-foreground',
        className
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'border-border bg-background/70 inline-flex h-5 w-5 items-center justify-center rounded border transition',
          active
            ? 'border-primary/50 text-primary'
            : 'text-muted-foreground/70 group-hover:border-primary/40 group-hover:text-primary'
        )}
        aria-hidden
      >
        <Icon className='h-3.5 w-3.5' />
      </span>
      <span className='sr-only'>
        {active
          ? `Sorted ${dir === 'desc' ? 'descending' : 'ascending'}`
          : 'Sortable column'}
      </span>
    </ServerDataTableNavButton>
  )
}
