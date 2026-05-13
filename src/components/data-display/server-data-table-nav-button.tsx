'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

export function ServerDataTableNavButton({
  href,
  className,
  disabled,
  children
}: {
  href: string
  className?: string
  disabled?: boolean
  children: ReactNode
}) {
  const router = useRouter()

  return (
    <button
      type='button'
      disabled={disabled}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) {
          router.push(href, { scroll: false })
        }
      }}
      className={className}
    >
      {children}
    </button>
  )
}
