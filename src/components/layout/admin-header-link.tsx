'use client'

import Link from 'next/link'
import * as React from 'react'

import { ShieldCheck } from 'lucide-react'

import { useWalletRuntimeReady } from '@/components/providers/wallet-provider'
import { buttonClasses } from '@/components/ui/button'
import { WalletAddressConsumer } from '@/components/wallet/wallet-address-consumer'

export function AdminHeaderLink() {
  const walletRuntimeReady = useWalletRuntimeReady()

  if (!walletRuntimeReady) {
    return null
  }

  return (
    <WalletAddressConsumer>
      {({ address }) => <AdminHeaderLinkContent walletAddress={address} />}
    </WalletAddressConsumer>
  )
}

function AdminHeaderLinkContent({
  walletAddress
}: {
  walletAddress: string | null
}) {
  const [access, setAccess] = React.useState({
    walletAddress: null as string | null,
    isAdmin: false,
    isChecking: false
  })

  React.useEffect(() => {
    let isMounted = true

    if (!walletAddress) {
      setAccess({
        walletAddress: null,
        isAdmin: false,
        isChecking: false
      })
      return
    }

    setAccess({
      walletAddress,
      isAdmin: false,
      isChecking: true
    })

    fetch(
      `/api/admin/access?walletAddress=${encodeURIComponent(walletAddress)}`,
      {
        cache: 'no-store'
      }
    )
      .then(async response => {
        if (!isMounted) {
          return
        }

        const body = (await response.json().catch(() => null)) as {
          isAdmin?: boolean
        } | null

        setAccess({
          walletAddress,
          isAdmin: Boolean(response.ok && body?.isAdmin),
          isChecking: false
        })
      })
      .catch(() => {
        if (isMounted) {
          setAccess({
            walletAddress,
            isAdmin: false,
            isChecking: false
          })
        }
      })

    return () => {
      isMounted = false
    }
  }, [walletAddress])

  if (
    !walletAddress ||
    access.walletAddress !== walletAddress ||
    access.isChecking ||
    !access.isAdmin
  ) {
    return null
  }

  return (
    <Link
      href='/admin'
      className={buttonClasses({
        variant: 'outline',
        size: 'sm',
        className: 'gap-2 whitespace-nowrap'
      })}
    >
      <ShieldCheck className='h-4 w-4' aria-hidden />
      <span className='hidden sm:inline'>Admin panel</span>
    </Link>
  )
}
