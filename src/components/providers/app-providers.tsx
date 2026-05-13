'use client'

import { AppThemeProvider } from '@/components/providers/theme-provider'
import { WalletProvider } from '@/components/providers/wallet-provider'
import { ProfileOnboardingDialog } from '@/components/settings/profile-onboarding-dialog'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AppThemeProvider>
      <WalletProvider>
        {children}
        <ProfileOnboardingDialog />
      </WalletProvider>
    </AppThemeProvider>
  )
}
