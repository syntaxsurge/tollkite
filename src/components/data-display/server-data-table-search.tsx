'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { Search } from 'lucide-react'

import type { ServerTableDirection } from '@/lib/table/server-table'

export function ServerDataTableSearch({
  basePath,
  preserveParams,
  paramPrefix,
  query,
  sort,
  dir,
  pageSize,
  searchPlaceholder
}: {
  basePath: string
  preserveParams: Record<string, string | undefined>
  paramPrefix?: string
  query: string
  sort: string
  dir: ServerTableDirection
  pageSize: number
  searchPlaceholder: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(query)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()

    Object.entries(preserveParams).forEach(([key, preservedValue]) => {
      if (preservedValue) {
        params.set(key, preservedValue)
      }
    })

    if (value.trim()) {
      params.set(prefixedKey(paramPrefix, 'q'), value.trim())
    }

    params.set(prefixedKey(paramPrefix, 'sort'), sort)
    params.set(prefixedKey(paramPrefix, 'dir'), dir)
    params.set(prefixedKey(paramPrefix, 'page'), '1')
    params.set(prefixedKey(paramPrefix, 'pageSize'), String(pageSize))

    router.push(`${basePath}?${params.toString()}`, { scroll: false })
  }

  return (
    <form onSubmit={handleSubmit} className='min-w-0 flex-1' role='search'>
      <label className='border-border bg-card focus-within:ring-ring/35 flex min-h-11 items-center gap-3 rounded-lg border px-3 transition focus-within:ring-2'>
        <Search className='text-foreground/50 h-4 w-4' aria-hidden />
        <span className='sr-only'>Search table</span>
        <input
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder={searchPlaceholder}
          className='placeholder:text-muted-foreground h-10 min-w-0 flex-1 bg-transparent text-sm outline-none'
        />
      </label>
    </form>
  )
}

function prefixedKey(prefix: string | undefined, key: string) {
  return prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key
}
