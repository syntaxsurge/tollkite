'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'nextjs-toploader/app'

import { notifyServerTableSelectionUpdated } from '@/components/data-display/server-data-table-master-checkbox'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { cn } from '@/lib/utils/cn'

export type ServerDataTableBulkAction = {
  label: string
  endpoint: string
  method?: 'POST' | 'DELETE'
  confirmMessage?: string
  tone?: 'default' | 'destructive'
}

export function ServerDataTableSelection({
  tableId,
  bulkActions = [],
  selectedIds,
  onSelectionChange,
  currentPageIds,
  selectedLabel = 'selected on this page'
}: {
  tableId: string
  bulkActions?: ServerDataTableBulkAction[]
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  currentPageIds?: string[]
  selectedLabel?: string
}) {
  const router = useRouter()
  const masterCheckboxRef = useRef<HTMLInputElement>(null)
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([])
  const [pendingAction, setPendingAction] =
    useState<ServerDataTableBulkAction | null>(null)
  const [isRunningAction, setIsRunningAction] = useState(false)
  const [actionError, setActionError] = useState('')
  const effectiveSelectedIds = selectedIds ?? internalSelectedIds
  const selectedSet = useMemo(
    () => new Set(effectiveSelectedIds),
    [effectiveSelectedIds]
  )
  const visibleIds = currentPageIds ?? []
  const selectedVisibleCount = visibleIds.filter(id =>
    selectedSet.has(id)
  ).length
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length
  const hasPartialVisibleSelection =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length

  function getCheckboxes() {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>(
        `[data-table-id="${tableId}"][data-row-checkbox]`
      )
    )
  }

  useEffect(() => {
    const checkboxes = getCheckboxes()

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', syncFromDom)
    })

    return () => {
      checkboxes.forEach(checkbox => {
        checkbox.removeEventListener('change', syncFromDom)
      })
    }
  })

  useEffect(() => {
    const checkboxes = getCheckboxes()

    checkboxes.forEach(checkbox => {
      checkbox.checked = selectedSet.has(checkbox.value)
    })

    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.checked = allVisibleSelected
      masterCheckboxRef.current.indeterminate = hasPartialVisibleSelection
    }

    notifyServerTableSelectionUpdated(tableId)
  }, [
    allVisibleSelected,
    hasPartialVisibleSelection,
    selectedSet,
    tableId,
    visibleIds
  ])

  function syncFromDom() {
    const checkboxes = getCheckboxes()
    const pageIds = checkboxes.map(checkbox => checkbox.value)
    const visibleSelectedIds = checkboxes
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value)
    const nextIds = [
      ...effectiveSelectedIds.filter(id => !pageIds.includes(id)),
      ...visibleSelectedIds
    ]

    updateSelection(dedupeIds(nextIds))
  }

  function updateSelection(nextIds: string[]) {
    notifyServerTableSelectionUpdated(tableId)

    if (onSelectionChange) {
      onSelectionChange(nextIds)
      return
    }

    setInternalSelectedIds(nextIds)
  }

  function toggleCurrentPage(checked: boolean) {
    const pageIds = getCheckboxes().map(checkbox => checkbox.value)
    const nextIds = checked
      ? dedupeIds([...effectiveSelectedIds, ...pageIds])
      : effectiveSelectedIds.filter(id => !pageIds.includes(id))

    updateSelection(nextIds)
  }

  async function runBulkAction(action: ServerDataTableBulkAction) {
    if (effectiveSelectedIds.length === 0) {
      return
    }

    setIsRunningAction(true)
    setActionError('')

    try {
      const ids = [...effectiveSelectedIds]
      const response = await fetch(action.endpoint, {
        method: action.method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })

      const body = (await response.json().catch(() => null)) as {
        error?: string
        deletedRunIds?: string[]
      } | null

      if (!response.ok) {
        throw new Error(body?.error ?? 'Bulk action failed.')
      }

      removeRowsFromDom(ids)
      removeAgentRunSessionStorage(body?.deletedRunIds ?? ids)
      updateResultCount(tableId, ids.length)
      updateSelection([])
      setPendingAction(null)
      router.refresh()
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Bulk action failed.'
      )
    } finally {
      setIsRunningAction(false)
    }
  }

  const selectedCount = effectiveSelectedIds.length
  const hasSelection = selectedCount > 0

  return (
    <div
      className={cn(
        'border-border bg-background/55 rounded-lg border p-3 transition',
        hasSelection && 'border-primary/40 bg-primary/5 shadow-sm'
      )}
    >
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <label className='flex min-w-0 items-center gap-3 text-sm font-semibold'>
          <input
            ref={masterCheckboxRef}
            type='checkbox'
            className='border-border text-primary focus:ring-ring h-4 w-4 shrink-0 rounded'
            aria-label='Select all rows on this page'
            onChange={event => toggleCurrentPage(event.currentTarget.checked)}
          />
          <span className='min-w-0'>
            <span className='block'>{selectedCount} selected</span>
            <span className='text-muted-foreground block text-xs font-medium'>
              {selectedLabel}
            </span>
          </span>
        </label>
        {bulkActions.length > 0 ? (
          <div className='flex flex-wrap gap-2'>
            {bulkActions.map(action => {
              const destructive = isDestructiveBulkAction(action)

              return (
                <Button
                  key={action.label}
                  type='button'
                  variant={destructive ? 'primary' : 'outline'}
                  size='sm'
                  disabled={selectedSet.size === 0}
                  className={cn(
                    destructive &&
                      'disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted bg-red-600 text-white shadow-red-950/20 hover:bg-red-700 hover:shadow-red-950/25'
                  )}
                  onClick={() => {
                    setActionError('')
                    setPendingAction(action)
                  }}
                >
                  <Trash2 className='h-4 w-4' aria-hidden />
                  {action.label}
                </Button>
              )
            })}
          </div>
        ) : null}
      </div>
      <span className='sr-only' aria-live='polite'>
        {selectedCount} rows selected
      </span>
      <Dialog
        open={Boolean(pendingAction)}
        onOpenChange={open => {
          if (!open && !isRunningAction) {
            setPendingAction(null)
            setActionError('')
          }
        }}
        title={pendingAction?.label ?? 'Confirm bulk action'}
        description={`${selectedCount} ${
          selectedCount === 1 ? 'row is' : 'rows are'
        } selected.`}
        className='max-w-xl'
      >
        <div className='space-y-5'>
          <div
            className={cn(
              'rounded-lg border p-4',
              pendingAction && isDestructiveBulkAction(pendingAction)
                ? 'border-red-500/35 bg-red-500/10'
                : 'border-border bg-muted/30'
            )}
          >
            <div className='flex items-start gap-3'>
              {pendingAction && isDestructiveBulkAction(pendingAction) ? (
                <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-600 dark:text-red-300'>
                  <AlertTriangle className='h-4 w-4' aria-hidden />
                </span>
              ) : null}
              <div className='min-w-0'>
                <p className='font-semibold'>
                  {pendingAction && isDestructiveBulkAction(pendingAction)
                    ? 'Confirm destructive action'
                    : 'Confirm this action'}
                </p>
                <p className='text-muted-foreground mt-2 text-sm leading-6'>
                  {pendingAction?.confirmMessage ??
                    'This action will run for the selected rows.'}
                </p>
              </div>
            </div>
          </div>

          {actionError ? (
            <p
              className='rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300'
              role='alert'
            >
              {actionError}
            </p>
          ) : null}

          <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
            <Button
              type='button'
              variant='outline'
              disabled={isRunningAction}
              onClick={() => {
                setPendingAction(null)
                setActionError('')
              }}
            >
              Cancel
            </Button>
            <Button
              type='button'
              disabled={!pendingAction || isRunningAction}
              className={cn(
                pendingAction && isDestructiveBulkAction(pendingAction)
                  ? 'bg-red-600 text-white shadow-red-950/20 hover:bg-red-700'
                  : ''
              )}
              onClick={() => {
                if (pendingAction) {
                  void runBulkAction(pendingAction)
                }
              }}
            >
              {isRunningAction ? (
                <Loader2 className='h-4 w-4 animate-spin' aria-hidden />
              ) : (
                <Trash2 className='h-4 w-4' aria-hidden />
              )}
              Confirm
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

function isDestructiveBulkAction(action: ServerDataTableBulkAction) {
  if (action.tone) {
    return action.tone === 'destructive'
  }

  return /delete|remove|destroy|bulk-delete/i.test(
    `${action.label} ${action.endpoint}`
  )
}

function dedupeIds(ids: string[]) {
  return Array.from(new Set(ids))
}

function removeRowsFromDom(ids: string[]) {
  ids.forEach(id => {
    document.querySelector(`[data-table-row-id="${CSS.escape(id)}"]`)?.remove()
  })
}

function removeAgentRunSessionStorage(ids: string[]) {
  ids.forEach(id => {
    window.sessionStorage.removeItem(`app:agent-run:${id}`)
  })
}

function updateResultCount(tableId: string, removedCount: number) {
  const element = document.querySelector<HTMLElement>(
    `[data-table-result-count="${CSS.escape(tableId)}"]`
  )

  if (!element) {
    return
  }

  const current = Number(element.dataset.tableTotalRows ?? 0)
  const next = Math.max(0, current - removedCount)

  element.dataset.tableTotalRows = String(next)
  element.textContent = `${next.toLocaleString()} result${next === 1 ? '' : 's'}`
}
