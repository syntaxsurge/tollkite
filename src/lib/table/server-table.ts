export type ServerTableDirection = 'asc' | 'desc'

export type ServerTableState = {
  q: string
  sort: string
  dir: ServerTableDirection
  page: number
  pageSize: number
}

export type ServerTableResult<T> = {
  rows: T[]
  totalRows: number
  totalPages: number
  page: number
  pageSize: number
}

export function resolveServerTableState(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
  options: {
    defaultSort: string
    defaultDir?: ServerTableDirection
    defaultPageSize?: number
    paramPrefix?: string
  }
): ServerTableState {
  const q =
    readParam(searchParams, prefixedKey(options.paramPrefix, 'q'))?.trim() ?? ''
  const sort =
    readParam(searchParams, prefixedKey(options.paramPrefix, 'sort')) ??
    options.defaultSort
  const dir =
    readParam(searchParams, prefixedKey(options.paramPrefix, 'dir')) === 'asc'
      ? 'asc'
      : 'desc'
  const page = Math.max(
    1,
    Number(
      readParam(searchParams, prefixedKey(options.paramPrefix, 'page')) ?? 1
    ) || 1
  )
  const pageSize = Math.min(
    100,
    Math.max(
      5,
      Number(
        readParam(searchParams, prefixedKey(options.paramPrefix, 'pageSize')) ??
          options.defaultPageSize ??
          10
      ) ||
        options.defaultPageSize ||
        10
    )
  )

  return {
    q,
    sort,
    dir:
      options.defaultDir &&
      !readParam(searchParams, prefixedKey(options.paramPrefix, 'dir'))
        ? options.defaultDir
        : dir,
    page,
    pageSize
  }
}

function prefixedKey(prefix: string | undefined, key: string) {
  return prefix ? `${prefix}${key[0].toUpperCase()}${key.slice(1)}` : key
}

export function queryServerRows<T>(
  rows: T[],
  state: ServerTableState,
  options: {
    searchText: (row: T) => string
    sortValues: Record<string, (row: T) => string | number | Date | undefined>
  }
): ServerTableResult<T> {
  const normalizedQuery = state.q.toLowerCase()
  const filteredRows = normalizedQuery
    ? rows.filter(row =>
        options.searchText(row).toLowerCase().includes(normalizedQuery)
      )
    : rows
  const sortValue =
    options.sortValues[state.sort] ?? Object.values(options.sortValues)[0]
  const sortedRows = [...filteredRows].sort((first, second) => {
    const firstValue = normalizeSortValue(sortValue(first))
    const secondValue = normalizeSortValue(sortValue(second))
    const comparison =
      typeof firstValue === 'number' && typeof secondValue === 'number'
        ? firstValue - secondValue
        : String(firstValue).localeCompare(String(secondValue))

    return state.dir === 'asc' ? comparison : -comparison
  })
  const totalRows = sortedRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize))
  const safePage = Math.min(state.page, totalPages)
  const start = (safePage - 1) * state.pageSize

  return {
    rows: sortedRows.slice(start, start + state.pageSize),
    totalRows,
    totalPages,
    page: safePage,
    pageSize: state.pageSize
  }
}

function normalizeSortValue(value: string | number | Date | undefined) {
  if (value instanceof Date) {
    return value.getTime()
  }

  return value ?? ''
}

function readParam(
  searchParams:
    | Record<string, string | string[] | undefined>
    | undefined
    | null,
  key: string
) {
  const value = searchParams?.[key]

  return Array.isArray(value) ? value[0] : value
}
