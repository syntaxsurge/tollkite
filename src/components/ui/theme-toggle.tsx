'use client'

import * as React from 'react'

import { useTheme } from 'next-themes'

import { buttonClasses } from '@/components/ui/button'

function SunIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-4 w-4'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <circle cx='12' cy='12' r='4' />
      <path d='M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 24 24'
      className='h-4 w-4'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <path d='M21 12.5A8.5 8.5 0 0 1 11.5 3 7 7 0 1 0 21 12.5z' />
    </svg>
  )
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'
  const label = mounted
    ? isDark
      ? 'Switch to light mode'
      : 'Switch to dark mode'
    : 'Toggle theme'

  return (
    <button
      type='button'
      className={buttonClasses({ variant: 'ghost', size: 'sm', className })}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      <span className='sr-only'>{label}</span>
      {mounted ? isDark ? <SunIcon /> : <MoonIcon /> : <MoonIcon />}
    </button>
  )
}
