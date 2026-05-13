import type { ReactNode } from 'react'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ServerDataTableMasterCheckbox } from '@/components/data-display/server-data-table-master-checkbox'
import { ServerDataTableNavButton } from '@/components/data-display/server-data-table-nav-button'
import { ServerDataTableSearch } from '@/components/data-display/server-data-table-search'
import {
  ServerDataTableSelection,
  type ServerDataTableBulkAction
} from '@/components/data-display/server-data-table-selection'
import { ServerDataTableSortButton } from '@/components/data-display/server-data-table-sort-button'
import { buttonClasses } from '@/components/ui/button'
import type { ServerTableDirection } from '@/lib/table/server-table'
import { cn } from '@/lib/utils/cn'

export type ServerDataTableColumn<T> = {
  key: string
  label: string
  sortKey?: string
  className?: string
  render: (row: T) => ReactNode
}

export function ServerDataTable<T>({
  id,
  rows,
  columns,
  getRowId,
  basePath,
  query,
  sort,
  dir,
  page,
  pageSize,
  totalRows,
  totalPages,
  preserveParams = {},
  paramPrefix,
  emptyTitle,
  emptyDescription,
  searchPlaceholder = 'Search',
  showSearch = true,
  bulkActions = [],
  enableSelection = bulkActions.length > 0
}: {
  id: string
  rows: T[]
  columns: ServerDataTableColumn<T>[]
  getRowId: (row: T) => string
  basePath: string
  query: string
  sort: string
  dir: ServerTableDirection
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  preserveParams?: Record<string, string | undefined>
  paramPrefix?: string
  emptyTitle: string
  emptyDescription: string
  searchPlaceholder?: string
  showSearch?: boolean
  enableSelection?: boolean
  bulkActions?: ServerDataTableBulkAction[]
}) {
  return (
    <div
      className='border-border bg-card/90 overflow-hidden rounded-lg border shadow-sm'
      data-server-table-id={id}
    >
      <div className='border-border bg-background/50 border-b p-4'>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          {showSearch ? (
            <ServerDataTableSearch
              basePath={basePath}
              preserveParams={preserveParams}
              paramPrefix={paramPrefix}
              query={query}
              sort={sort}
              dir={dir}
              pageSize={pageSize}
              searchPlaceholder={searchPlaceholder}
            />
          ) : (
            <div />
          )}
          <div
            className='text-muted-foreground text-sm'
            data-table-result-count={id}
            data-table-total-rows={totalRows}
          >
            {totalRows.toLocaleString()} result{totalRows === 1 ? '' : 's'}
          </div>
        </div>
        {enableSelection ? (
          <div className='mt-3'>
            <ServerDataTableSelection
              tableId={id}
              bulkActions={bulkActions}
              currentPageIds={rows.map(row => getRowId(row))}
            />
          </div>
        ) : null}
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full min-w-[760px] text-left text-sm'>
          <thead className='bg-muted/30 text-muted-foreground'>
            <tr>
              {enableSelection ? (
                <th className='w-12 px-4 py-3'>
                  <ServerDataTableMasterCheckbox tableId={id} />
                </th>
              ) : null}
              {columns.map(column => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold tracking-[0.12em] uppercase',
                    column.className
                  )}
                >
                  {column.sortKey ? (
                    <ServerDataTableSortButton
                      href={buildHref({
                        basePath,
                        preserveParams,
                        paramPrefix,
                        q: query,
                        sort: column.sortKey,
                        dir:
                          sort === column.sortKey && dir === 'desc'
                            ? 'asc'
                            : 'desc',
                        page: 1,
                        pageSize
                      })}
                      label={column.label}
                      active={sort === column.sortKey}
                      dir={dir}
                    />
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className='divide-border divide-y'>
            {rows.map(row => {
              const rowId = getRowId(row)

              return (
                <tr
                  key={rowId}
                  data-table-row-id={rowId}
                  className='hover:bg-muted/25 transition'
                >
                  {enableSelection ? (
                    <td className='px-4 py-4 align-top'>
                      <input
                        value={rowId}
                        data-table-id={id}
                        data-row-checkbox
                        type='checkbox'
                        aria-label={`Select ${rowId}`}
                        className='border-border text-primary focus:ring-ring h-4 w-4 rounded'
                      />
                    </td>
                  ) : null}
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={cn('px-4 py-4 align-top', column.className)}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <div className='p-8 text-center'>
          <p className='text-lg font-semibold'>{emptyTitle}</p>
          <p className='text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6'>
            {emptyDescription}
          </p>
        </div>
      ) : null}

      <div className='border-border flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          Page {page} of {totalPages}
        </p>
        <div className='flex gap-2'>
          <ServerDataTableNavButton
            disabled={page <= 1}
            href={buildHref({
              basePath,
              preserveParams,
              paramPrefix,
              q: query,
              sort,
              dir,
              page: Math.max(1, page - 1),
              pageSize
            })}
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className: page <= 1 ? 'pointer-events-none opacity-50' : ''
            })}
          >
            <ChevronLeft className='h-4 w-4' aria-hidden />
            Previous
          </ServerDataTableNavButton>
          <ServerDataTableNavButton
            disabled={page >= totalPages}
            href={buildHref({
              basePath,
              preserveParams,
              paramPrefix,
              q: query,
              sort,
              dir,
              page: Math.min(totalPages, page + 1),
              pageSize
            })}
            className={buttonClasses({
              variant: 'outline',
              size: 'sm',
              className:
                page >= totalPages ? 'pointer-events-none opacity-50' : ''
            })}
          >
            Next
            <ChevronRight className='h-4 w-4' aria-hidden />
          </ServerDataTableNavButton>
        </div>
      </div>
    </div>
  )
}

function buildHref({
  basePath,
  preserveParams,
  paramPrefix,
  q,
  sort,
  dir,
  page,
  pageSize
}: {
  basePath: string
  preserveParams: Record<string, string | undefined>
  paramPrefix?: string
  q: string
  sort: string
  dir: ServerTableDirection
  page: number
  pageSize: number
}) {
  const params = new URLSearchParams()

  Object.entries(preserveParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value)
    }
  })

  if (q) {
    params.set(prefixedKey(paramPrefix, 'q'), q)
  }

  params.set(prefixedKey(paramPrefix, 'sort'), sort)
  params.set(prefixedKey(paramPrefix, 'dir'), dir)
  params.set(prefixedKey(paramPrefix, 'page'), String(page))
  params.set(prefixedKey(paramPrefix, 'pageSize'), String(pageSize))

  return `${basePath}?${params.toString()}`
}

function prefixedKey(prefix: string | undefined, key: string) {
  return prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key
}
