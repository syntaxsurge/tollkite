import { UserRound } from 'lucide-react'

import {
  formatWalletAddress,
  getPublicUserProfile
} from '@/lib/settings/user-settings'
import { cn } from '@/lib/utils/cn'

type WalletOwnerCardProps = {
  walletAddress?: string | null
  displayName?: string
  compact?: boolean
  className?: string
}

export function WalletOwnerCard({
  walletAddress,
  displayName,
  compact = false,
  className
}: WalletOwnerCardProps) {
  const profile = getPublicUserProfile(walletAddress, displayName)

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-3',
        compact ? 'text-sm' : 'border-border bg-card/70 rounded-lg border p-4',
        className
      )}
    >
      <span
        className={cn(
          'bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-full font-semibold shadow-sm',
          compact ? 'h-9 w-9 text-xs' : 'h-12 w-12 text-sm'
        )}
        aria-hidden
      >
        {profile.avatarInitials || <UserRound className='h-4 w-4' />}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{profile.fullName}</p>
        <div className='text-muted-foreground mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
          <span className='truncate'>@{profile.username}</span>
          <span aria-hidden>•</span>
          <span className='font-mono'>
            {formatWalletAddress(walletAddress)}
          </span>
        </div>
      </div>
    </div>
  )
}
