'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import {
  ChevronDown,
  LayoutDashboard,
  Menu,
  Settings,
  UserRound
} from 'lucide-react'

import { AdminHeaderLink } from '@/components/layout/admin-header-link'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { WalletConnectButton } from '@/components/ui/wallet-connect-button'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { WalletBalanceSummary } from '@/components/wallet/wallet-balance-summary'
import { useUserSettings } from '@/hooks/use-user-settings'
import { primaryNav } from '@/lib/config/navigation'
import { siteConfig } from '@/lib/config/site'
import { userDisplayName, userInitials } from '@/lib/settings/user-settings'
import { cn } from '@/lib/utils/cn'

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className='border-border/80 bg-background/92 sticky top-0 z-50 border-b shadow-sm backdrop-blur-xl'>
      <div className='mx-auto flex min-h-[4.5rem] w-full max-w-[98rem] items-center gap-4 px-4 py-3 sm:px-6 lg:px-8'>
        <Link href='/' className='group flex shrink-0 items-center gap-3'>
          <span className='logo-mark-surface ring-border/80 group-hover:ring-primary/45 grid h-11 w-11 shrink-0 place-items-center rounded-lg p-1.5 ring-1 transition group-hover:scale-[1.02]'>
            <Image
              src={siteConfig.logoPath}
              alt={siteConfig.name}
              width={44}
              height={44}
              priority
              className='h-9 w-9 object-contain'
            />
          </span>
          <div className='min-w-0 text-left'>
            <p className='truncate text-lg leading-6 font-semibold sm:text-xl'>
              {siteConfig.name}
            </p>
          </div>
        </Link>

        <nav
          className='hidden min-w-0 flex-1 items-center justify-center gap-5 text-sm xl:flex 2xl:gap-7'
          aria-label='Primary'
        >
          {primaryNav.map(item => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'rounded-md px-1 py-2 text-base font-medium whitespace-nowrap transition',
                  isActive
                    ? 'text-primary dark:text-accent'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className='ml-auto flex shrink-0 items-center gap-3'>
          <details className='relative xl:hidden'>
            <summary
              aria-label='Open navigation menu'
              className='border-border bg-card text-foreground hover:border-brand-cyan/60 flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-lg border transition'
            >
              <Menu className='h-4 w-4' aria-hidden />
              <span className='sr-only'>Open navigation menu</span>
            </summary>
            <div className='border-border bg-card absolute right-0 mt-2 w-56 rounded-lg border p-2 shadow-lg'>
              {primaryNav.map(item => {
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href ||
                      pathname.startsWith(`${item.href}/`)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm transition',
                      isActive
                        ? 'bg-accent/12 text-primary dark:text-accent'
                        : 'text-muted-foreground hover:bg-accent/8 hover:text-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </details>
          <AdminHeaderLink />
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}

function ProfileMenu() {
  return (
    <WalletAddressConsumer>
      {wallet => <ProfileMenuContent walletAddress={wallet.address} />}
    </WalletAddressConsumer>
  )
}

function ProfileMenuContent({
  walletAddress
}: {
  walletAddress: string | null
}) {
  const { settings } = useUserSettings(walletAddress)
  const isAuthenticated = Boolean(walletAddress)
  const displayName = isAuthenticated
    ? userDisplayName(settings)
    : 'Not connected'
  const username = isAuthenticated
    ? settings.username
      ? `@${settings.username}`
      : 'Set username'
    : 'Connect a wallet'
  const initials = isAuthenticated ? userInitials(settings) || 'P' : 'P'

  return (
    <details className='group relative'>
      <summary
        aria-label='Open account menu'
        className='border-border bg-card hover:border-brand-cyan/60 flex h-12 cursor-pointer list-none items-center gap-2 rounded-lg border px-2 shadow-sm transition'
      >
        <span className='bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-full text-xs font-semibold'>
          {initials}
        </span>
        <ChevronDown
          className='text-muted-foreground h-4 w-4 transition group-open:rotate-180'
          aria-hidden
        />
        <span className='sr-only'>Open account menu</span>
      </summary>
      <div className='border-border bg-card absolute right-0 mt-2 w-[19rem] rounded-lg border p-3 shadow-xl'>
        <div className='bg-muted/60 flex items-center gap-3 rounded-md p-3'>
          <span className='bg-primary text-primary-foreground grid h-11 w-11 place-items-center rounded-full text-sm font-semibold'>
            {initials}
          </span>
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold'>{displayName}</p>
            <p className='text-muted-foreground truncate text-xs'>{username}</p>
          </div>
        </div>
        {isAuthenticated ? (
          <WalletBalanceSummary walletAddress={walletAddress} variant='menu' />
        ) : null}
        {isAuthenticated ? (
          <div className='my-3 grid gap-1'>
            <MenuLink href='/dashboard' icon={LayoutDashboard}>
              Dashboard
            </MenuLink>
            <MenuLink href='/profile' icon={UserRound}>
              Profile
            </MenuLink>
            <MenuLink href='/settings' icon={Settings}>
              Settings
            </MenuLink>
          </div>
        ) : null}
        <div className='border-border border-t pt-3'>
          <p className='text-muted-foreground mb-2 text-xs font-semibold'>
            Wallet
          </p>
          <WalletConnectButton className='w-full max-w-none justify-center' />
        </div>
      </div>
    </details>
  )
}

function MenuLink({
  children,
  href,
  icon: Icon
}: {
  children: React.ReactNode
  href: string
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}) {
  return (
    <Link
      href={href}
      className='hover:bg-accent/10 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition'
    >
      <Icon className='text-muted-foreground h-4 w-4' aria-hidden />
      {children}
    </Link>
  )
}
