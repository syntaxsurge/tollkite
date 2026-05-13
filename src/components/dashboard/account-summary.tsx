'use client'

import { Mail, UserRound, WalletCards } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import { useUserSettings } from '@/hooks/use-user-settings'
import { userDisplayName } from '@/lib/settings/user-settings'

export function AccountSummary() {
  return (
    <WalletAddressConsumer>
      {({ address }) => <AccountSummaryContent address={address} />}
    </WalletAddressConsumer>
  )
}

function AccountSummaryContent({ address }: { address: string | null }) {
  const { settings } = useUserSettings(address)

  return (
    <Card className='space-y-5'>
      <div className='min-w-0'>
        <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
          Account
        </p>
        <h2 className='font-display mt-2 text-2xl'>Connected user</h2>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        <AccountTile
          icon={UserRound}
          label='Name'
          value={userDisplayName(settings)}
        />
        <AccountTile
          icon={WalletCards}
          label='Wallet'
          value={address ?? 'Resolving wallet'}
          valueClassName='font-mono text-[0.8125rem] leading-5'
        />
        <AccountTile
          icon={Mail}
          label='Email'
          value={settings.email || 'Not provided'}
        />
        <AccountTile label='Plan' value={settings.plan} capitalize />
      </div>
    </Card>
  )
}

function AccountTile({
  icon: Icon,
  label,
  value,
  valueClassName = '',
  capitalize = false
}: {
  icon?: LucideIcon
  label: string
  value: string
  valueClassName?: string
  capitalize?: boolean
}) {
  return (
    <div className='bg-muted/90 min-w-0 rounded-lg p-5'>
      {Icon ? <Icon className='text-accent h-5 w-5' aria-hidden /> : null}
      <p className='text-foreground/60 mt-4 text-xs tracking-[0.16em] uppercase'>
        {label}
      </p>
      <p
        className={[
          'mt-2 max-w-full text-sm leading-5 font-semibold [overflow-wrap:anywhere]',
          capitalize ? 'capitalize' : '',
          valueClassName
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {value}
      </p>
    </div>
  )
}
