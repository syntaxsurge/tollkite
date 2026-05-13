'use client'

import * as React from 'react'

import {
  UserSettings,
  defaultUserSettings,
  fetchUserSettings,
  readUserSettings
} from '@/lib/settings/user-settings'

export function useUserSettings(walletAddress?: string | null) {
  const normalizedWallet = walletAddress?.toLowerCase() ?? null
  const [settings, setSettings] =
    React.useState<UserSettings>(defaultUserSettings)
  const [isLoading, setIsLoading] = React.useState(Boolean(normalizedWallet))
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let isMounted = true

    if (!normalizedWallet) {
      setSettings(defaultUserSettings)
      setIsLoading(false)
      setError('')
      return
    }

    setSettings(readUserSettings(normalizedWallet))
    setIsLoading(true)
    setError('')

    fetchUserSettings(normalizedWallet)
      .then(savedSettings => {
        if (isMounted) {
          setSettings(savedSettings)
        }
      })
      .catch(() => {
        if (isMounted) {
          setSettings(readUserSettings(normalizedWallet))
          setError('Could not load saved profile.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    function syncSettings() {
      if (isMounted) {
        setSettings(readUserSettings(normalizedWallet))
      }
    }

    window.addEventListener('storage', syncSettings)
    window.addEventListener('app:user-settings-updated', syncSettings)

    return () => {
      isMounted = false
      window.removeEventListener('storage', syncSettings)
      window.removeEventListener('app:user-settings-updated', syncSettings)
    }
  }, [normalizedWallet])

  return { settings, isLoading, error }
}
