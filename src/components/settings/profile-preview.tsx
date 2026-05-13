'use client'

import Link from 'next/link'

import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { WalletBalanceSummary } from '@/components/wallet/wallet-balance-summary'
import { useUserSettings } from '@/hooks/use-user-settings'
import { userDisplayName, userInitials } from '@/lib/settings/user-settings'

export function ProfilePreview() {
  return (
    <WalletAddressConsumer>
      {wallet => <ProfilePreviewContent walletAddress={wallet.address} />}
    </WalletAddressConsumer>
  )
}

function ProfilePreviewContent({
  walletAddress
}: {
  walletAddress: string | null
}) {
  const { settings, isLoading } = useUserSettings(walletAddress)

  if (isLoading) {
    return <div className='skeleton h-80 rounded-lg' />
  }

  const displayName = userDisplayName(settings)
  const username = settings.username ? `@${settings.username}` : '@builder'

  return (
    <div className='grid gap-5 xl:grid-cols-[0.9fr_1.1fr]'>
      <Card className='bg-panel-sheen space-y-6'>
        <div className='bg-foreground text-background flex h-20 w-20 items-center justify-center rounded-2xl text-2xl font-semibold'>
          {userInitials(settings) || 'NB'}
        </div>
        <div>
          <h2 className='font-display mt-4 text-3xl'>{displayName}</h2>
          <p className='text-foreground/65 mt-1 text-sm'>{username}</p>
        </div>
        <div className='space-y-3 text-sm'>
          <ProfileLine label='Email' value={settings.email || 'Not provided'} />
          <ProfileLine label='Plan' value={settings.plan} />
        </div>
        <Link
          href='/settings'
          className={buttonClasses({ variant: 'outline', className: 'w-full' })}
        >
          Edit profile
        </Link>
      </Card>

      <div className='grid gap-5 lg:grid-cols-2 xl:grid-cols-1'>
        <WalletBalanceSummary walletAddress={walletAddress} />
        <Card className='space-y-5'>
          <div>
            <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
              Creator identity
            </p>
            <h2 className='font-display mt-2 text-2xl'>Marketplace profile</h2>
            <p className='text-foreground/65 mt-2 text-sm leading-6'>
              This is the public creator identity buyers see beside your API
              listings, receipts, and provider activity.
            </p>
          </div>
          <div className='grid gap-3'>
            <Metric label='Display name' value={displayName} />
            <Metric label='Username' value={username} />
            <Metric label='Email' value={settings.email || 'Not provided'} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='border-foreground/10 flex items-center justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0'>
      <span className='text-foreground/60'>{label}</span>
      <span className='font-medium break-all'>{value}</span>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='bg-muted rounded-lg p-4'>
      <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {label}
      </p>
      <p className='mt-2 text-sm font-semibold capitalize'>{value}</p>
    </div>
  )
}
