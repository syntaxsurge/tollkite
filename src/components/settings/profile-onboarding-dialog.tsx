'use client'

import { FormEvent, useEffect, useState } from 'react'

import { AtSign, Mail, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WalletConnectButton } from '@/components/ui/wallet-connect-button'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import {
  UserSettings,
  defaultUserSettings,
  fetchUserSettings,
  isUserSettingsComplete,
  normalizeUsername,
  readUserSettings,
  saveUserSettings,
  validateEmail,
  validateUsername
} from '@/lib/settings/user-settings'

export function ProfileOnboardingDialog() {
  return (
    <WalletAddressConsumer>
      {wallet => <ProfileOnboardingFields walletAddress={wallet.address} />}
    </WalletAddressConsumer>
  )
}

function ProfileOnboardingFields({
  walletAddress
}: {
  walletAddress: string | null
}) {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings)
  const [hasSavedProfile, setHasSavedProfile] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true
    const cachedSettings = readUserSettings(walletAddress)

    setSettings(cachedSettings)
    setHasSavedProfile(false)
    setIsReady(false)
    setError('')

    if (!walletAddress) {
      setHasSavedProfile(false)
      setIsReady(true)
      return
    }

    if (isUserSettingsComplete(cachedSettings)) {
      setHasSavedProfile(true)
      setIsReady(true)
    }

    fetchUserSettings(walletAddress)
      .then(savedSettings => {
        if (!isMounted) {
          return
        }

        setSettings(savedSettings)
        setHasSavedProfile(isUserSettingsComplete(savedSettings))
        setIsReady(true)
      })
      .catch(() => {
        if (isMounted) {
          setHasSavedProfile(isUserSettingsComplete(cachedSettings))
          setIsReady(true)
          setError('Could not load your saved profile. Try refreshing.')
        }
      })

    return () => {
      isMounted = false
    }
  }, [walletAddress])

  if (!walletAddress || !isReady || hasSavedProfile) {
    return null
  }

  function updateField<Field extends keyof UserSettings>(
    field: Field,
    value: UserSettings[Field]
  ) {
    setSettings(current => ({ ...current, [field]: value }))
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const fullName = settings.fullName.trim()
    const username = normalizeUsername(settings.username)
    const email = settings.email.trim()
    const usernameError = validateUsername(username, walletAddress)
    const emailError = validateEmail(email)

    if (fullName.length < 2) {
      setError('Full name must be at least 2 characters.')
      return
    }

    if (usernameError) {
      setError(usernameError)
      return
    }

    if (emailError) {
      setError(emailError)
      return
    }

    const nextSettings = {
      ...settings,
      fullName,
      username,
      email
    }

    try {
      const savedSettings = await saveUserSettings(nextSettings, walletAddress)
      setSettings(savedSettings)
      setHasSavedProfile(true)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save profile.'
      )
    }
  }

  return (
    <div
      className='bg-background/90 fixed inset-0 z-[90] grid place-items-center p-4 backdrop-blur-md'
      role='presentation'
    >
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='profile-onboarding-title'
        aria-describedby='profile-onboarding-description'
        className='border-border bg-card text-card-foreground w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl'
      >
        <div className='border-border bg-muted/30 border-b p-6'>
          <div className='flex items-start gap-4'>
            <span className='bg-primary text-primary-foreground grid h-12 w-12 shrink-0 place-items-center rounded-full'>
              <UserRound className='h-5 w-5' aria-hidden />
            </span>
            <div className='min-w-0'>
              <p className='text-primary text-xs font-semibold tracking-[0.18em] uppercase'>
                Required profile
              </p>
              <h2
                id='profile-onboarding-title'
                className='font-display mt-2 text-2xl leading-tight'
              >
                Set your creator identity
              </h2>
              <p
                id='profile-onboarding-description'
                className='text-muted-foreground mt-2 text-sm leading-6'
              >
                the app shows creator profiles beside marketplace APIs, provider
                earnings, receipts, and agent activity. Complete this once to
                continue.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-5 p-6'>
          <div className='border-border bg-background/70 space-y-3 rounded-lg border p-4'>
            <p className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
              Connected wallet
            </p>
            <WalletConnectButton className='w-full justify-center' />
            <p className='text-muted-foreground text-xs leading-5'>
              Connected the wrong wallet? Open the wallet menu here and choose
              disconnect before creating this profile.
            </p>
          </div>

          <div className='grid gap-4'>
            <label className='space-y-2'>
              <span className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
                Full name <span className='text-destructive'>*</span>
              </span>
              <Input
                value={settings.fullName}
                onChange={event => updateField('fullName', event.target.value)}
                placeholder='Provider Labs'
                required
                minLength={2}
              />
            </label>
            <label className='space-y-2'>
              <span className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
                Username <span className='text-destructive'>*</span>
              </span>
              <div className='relative'>
                <AtSign
                  className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
                  aria-hidden
                />
                <Input
                  value={settings.username}
                  onChange={event =>
                    updateField(
                      'username',
                      normalizeUsername(event.target.value)
                    )
                  }
                  placeholder='platform'
                  className='pl-9'
                  required
                  minLength={3}
                  maxLength={24}
                />
              </div>
            </label>
            <label className='space-y-2'>
              <span className='text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase'>
                Email <span className='text-destructive'>*</span>
              </span>
              <div className='relative'>
                <Mail
                  className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2'
                  aria-hidden
                />
                <Input
                  type='email'
                  value={settings.email}
                  onChange={event => updateField('email', event.target.value)}
                  placeholder='team@example.com'
                  className='pl-9'
                  required
                />
              </div>
            </label>
          </div>

          {error ? (
            <p
              className='border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm font-medium'
              role='alert'
            >
              {error}
            </p>
          ) : null}

          <Button type='submit' className='w-full justify-center'>
            Save profile and continue
          </Button>
        </form>
      </section>
    </div>
  )
}
