'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Bot,
  CreditCard,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Settings,
  Store,
  UserRound
} from 'lucide-react'

import { appNav } from '@/lib/config/navigation'
import { cn } from '@/lib/utils/cn'

const appNavIcons = {
  Dashboard: LayoutDashboard,
  Agents: Bot,
  Marketplace: Store,
  Provider: PackageSearch,
  Orders: ReceiptText,
  Profile: UserRound,
  Billing: CreditCard,
  Settings
}

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className='lg:sticky lg:top-24 lg:self-start'>
      <nav
        aria-label='Workspace'
        className='border-border/80 bg-card/90 shadow-brand-blue/5 rounded-lg border p-2 shadow-sm backdrop-blur'
      >
        <div className='flex items-center gap-2 px-3 py-2'>
          <LayoutDashboard className='text-accent h-4 w-4' aria-hidden />
          <p className='text-muted-foreground text-xs font-semibold'>
            Workspace
          </p>
        </div>
        <div className='grid gap-1'>
          {appNav.map(item => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon =
              appNavIcons[item.label as keyof typeof appNavIcons] ??
              LayoutDashboard

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition duration-200',
                  isActive
                    ? 'border-primary/25 bg-primary text-primary-foreground border shadow-sm'
                    : 'text-foreground hover:bg-accent/10 hover:text-primary dark:hover:text-accent'
                )}
              >
                <Icon className='h-4 w-4 shrink-0' aria-hidden />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}
