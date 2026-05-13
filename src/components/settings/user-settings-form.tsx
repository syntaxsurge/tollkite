'use client'

import { FormEvent, useEffect, useState } from 'react'

import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'
import {
  UserSettings,
  defaultUserSettings,
  fetchUserSettings,
  normalizeUsername,
  readUserSettings,
  saveUserSettings,
  validateEmail,
  validateUsername
} from '@/lib/settings/user-settings'

export function UserSettingsForm() {
  return (
    <WalletAddressConsumer>
      {wallet => <UserSettingsFormFields walletAddress={wallet.address} />}
    </WalletAddressConsumer>
  )
}

function UserSettingsFormFields({
  walletAddress
}: {
  walletAddress: string | null
}) {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings)
  const [isReady, setIsReady] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let isMounted = true
    const cachedSettings = readUserSettings(walletAddress)

    setSettings(cachedSettings)
    setStatus('')

    if (!walletAddress) {
      setIsReady(true)
      return
    }

    setIsReady(false)

    fetchUserSettings(walletAddress)
      .then(savedSettings => {
        if (isMounted) {
          setSettings(savedSettings)
          setIsReady(true)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSettings(cachedSettings)
          setStatus('Could not load saved profile settings.')
          setIsReady(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [walletAddress])

  function updateField<Field extends keyof UserSettings>(
    field: Field,
    value: UserSettings[Field]
  ) {
    setSettings(current => ({ ...current, [field]: value }))
    setStatus('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = normalizeUsername(settings.username)
    const usernameError = validateUsername(username, walletAddress)
    const email = settings.email.trim()
    const emailError = validateEmail(email)

    if (settings.fullName.trim().length < 2) {
      setStatus('Full name must be at least 2 characters.')
      return
    }

    if (usernameError) {
      setStatus(usernameError)
      return
    }

    if (emailError) {
      setStatus(emailError)
      return
    }

    try {
      const savedSettings = await saveUserSettings(
        {
          ...settings,
          fullName: settings.fullName.trim(),
          username,
          email
        },
        walletAddress
      )
      setSettings(savedSettings)
      setStatus('Settings saved.')
    } catch (saveError) {
      setStatus(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save settings.'
      )
    }
  }

  if (!isReady) {
    return <SettingsSkeleton />
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      <Card className='space-y-5'>
        <div>
          <p className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
            Identity
          </p>
          <h2 className='font-display mt-2 text-2xl'>Profile details</h2>
          <p className='text-foreground/65 mt-2 max-w-2xl text-sm leading-6'>
            These values power your creator profile across marketplace,
            provider, receipt, and agent activity surfaces.
          </p>
        </div>
        <div className='grid gap-4 md:grid-cols-3'>
          <LabeledInput
            label='Full name'
            value={settings.fullName}
            onChange={value => updateField('fullName', value)}
          />
          <LabeledInput
            label='Username'
            value={settings.username}
            onChange={value =>
              updateField('username', normalizeUsername(value))
            }
          />
          <LabeledInput
            label='Email'
            type='email'
            value={settings.email}
            onChange={value => updateField('email', value)}
          />
        </div>
      </Card>

      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Button type='submit'>
          <Save className='h-4 w-4' aria-hidden />
          Save
        </Button>
        {status ? (
          <p className='text-foreground/65 text-sm' role='status'>
            {status}
          </p>
        ) : null}
      </div>
    </form>
  )
}

function LabeledInput({
  label,
  value,
  type = 'text',
  onChange
}: {
  label: string
  value: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label className='space-y-2'>
      <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {label}
      </span>
      <Input
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  )
}

function SettingsSkeleton() {
  return (
    <div className='space-y-6'>
      <div className='skeleton h-72 rounded-lg' />
    </div>
  )
}
