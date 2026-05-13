'use client'

import { useEffect, useRef, useState } from 'react'

const selectionUpdatedEvent = 'app:table-selection-updated'

export function ServerDataTableMasterCheckbox({
  tableId
}: {
  tableId: string
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)
  const [checked, setChecked] = useState(false)
  const [partial, setPartial] = useState(false)

  useEffect(() => {
    syncState()

    const checkboxes = getRowCheckboxes(tableId)

    checkboxes.forEach(checkbox => {
      checkbox.addEventListener('change', syncState)
    })
    window.addEventListener(selectionUpdatedEvent, handleSelectionUpdated)

    return () => {
      checkboxes.forEach(checkbox => {
        checkbox.removeEventListener('change', syncState)
      })
      window.removeEventListener(selectionUpdatedEvent, handleSelectionUpdated)
    }

    function handleSelectionUpdated(event: Event) {
      const detail = (event as CustomEvent<{ tableId?: string }>).detail

      if (!detail?.tableId || detail.tableId === tableId) {
        syncState()
      }
    }

    function syncState() {
      const currentCheckboxes = getRowCheckboxes(tableId)
      const selectedCount = currentCheckboxes.filter(
        checkbox => checkbox.checked
      ).length
      const nextChecked =
        currentCheckboxes.length > 0 &&
        selectedCount === currentCheckboxes.length
      const nextPartial =
        selectedCount > 0 && selectedCount < currentCheckboxes.length

      setChecked(nextChecked)
      setPartial(nextPartial)
    }
  }, [tableId])

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = partial
    }
  }, [partial])

  function togglePageRows(nextChecked: boolean) {
    const checkboxes = getRowCheckboxes(tableId)

    checkboxes.forEach(checkbox => {
      checkbox.checked = nextChecked
    })
    checkboxes[0]?.dispatchEvent(new Event('change', { bubbles: true }))
    setChecked(nextChecked)
    setPartial(false)
  }

  return (
    <input
      ref={checkboxRef}
      type='checkbox'
      checked={checked}
      aria-label='Select all rows on this page'
      className='border-border text-primary focus:ring-ring h-4 w-4 rounded'
      onChange={event => togglePageRows(event.currentTarget.checked)}
    />
  )
}

export function notifyServerTableSelectionUpdated(tableId: string) {
  window.dispatchEvent(
    new CustomEvent(selectionUpdatedEvent, {
      detail: { tableId }
    })
  )
}

function getRowCheckboxes(tableId: string) {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `[data-table-id="${tableId}"][data-row-checkbox]`
    )
  )
}
