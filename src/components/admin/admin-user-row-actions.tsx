'use client'

import * as React from 'react'

import { MoreVertical, Pencil, Trash2 } from 'lucide-react'

import { Button, buttonClasses } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  deleteAdminUserAction,
  updateAdminUserAction
} from '@/lib/admin/admin-user-actions'
import type { AdminUserRecord } from '@/lib/admin/admin-users'
import { cn } from '@/lib/utils/cn'

type AdminUserRowActionsProps = {
  user: AdminUserRecord
  returnTo: string
}

export function AdminUserRowActions({
  user,
  returnTo
}: AdminUserRowActionsProps) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [menuOpen])

  return (
    <div className='relative' ref={menuRef}>
      <button
        type='button'
        aria-label={`Open actions for ${user.displayName}`}
        aria-haspopup='menu'
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
        className={buttonClasses({
          variant: 'ghost',
          size: 'sm',
          className: 'h-9 w-9 px-0'
        })}
      >
        <MoreVertical className='h-4 w-4' aria-hidden />
      </button>

      {menuOpen ? (
        <div
          role='menu'
          className='border-foreground/10 bg-card absolute right-0 z-20 mt-2 w-44 rounded-lg border p-1 shadow-xl'
        >
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              setMenuOpen(false)
              setEditOpen(true)
            }}
            className='hover:bg-foreground/5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm'
          >
            <Pencil className='h-4 w-4' aria-hidden />
            Edit user
          </button>
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              setMenuOpen(false)
              setDeleteOpen(true)
            }}
            className='hover:bg-foreground/5 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600 dark:text-red-400'
          >
            <Trash2 className='h-4 w-4' aria-hidden />
            Delete user
          </button>
        </div>
      ) : null}

      <EditUserDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
        returnTo={returnTo}
      />
      <DeleteUserDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        user={user}
        returnTo={returnTo}
      />
    </div>
  )
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  returnTo
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUserRecord
  returnTo: string
}) {
  const initialPaidStatus = user.plan === 'free' ? 'free' : 'paid'
  const [subscriptionStatus, setSubscriptionStatus] =
    React.useState(initialPaidStatus)
  const [paidTier, setPaidTier] = React.useState(
    user.plan === 'free' ? 'base' : user.plan
  )
  const submittedPlan = subscriptionStatus === 'free' ? 'free' : paidTier

  React.useEffect(() => {
    if (!open) {
      return
    }

    setSubscriptionStatus(initialPaidStatus)
    setPaidTier(user.plan === 'free' ? 'base' : user.plan)
  }, [initialPaidStatus, open, user.plan])

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title='Edit user'
      description='Update profile, account state, and subscription fields for the selected user. Admin access is controlled only by the configured wallet allowlist.'
    >
      <form action={updateAdminUserAction} className='grid gap-5'>
        <input type='hidden' name='id' value={user.id} />
        <input type='hidden' name='returnTo' value={returnTo} />
        <input type='hidden' name='plan' value={submittedPlan} />

        <div className='grid gap-4 md:grid-cols-2'>
          <Field label='Wallet'>
            <Input value={user.walletAddress} readOnly />
          </Field>
          <Field label='Display name'>
            <Input name='displayName' defaultValue={user.displayName} />
          </Field>
          <Field label='Username'>
            <Input name='username' defaultValue={user.username} />
          </Field>
          <Field label='Email'>
            <Input name='email' type='email' defaultValue={user.email} />
          </Field>
          <Field label='Role'>
            <Input value={user.role} readOnly />
          </Field>
          <Field label='Account status'>
            <Select name='status' defaultValue={user.status}>
              <option value='active'>Active</option>
              <option value='invited'>Invited</option>
              <option value='paused'>Paused</option>
            </Select>
          </Field>
          <Field label='Subscription'>
            <Select
              value={subscriptionStatus}
              onChange={event =>
                setSubscriptionStatus(event.target.value as 'free' | 'paid')
              }
            >
              <option value='free'>Free</option>
              <option value='paid'>Paid</option>
            </Select>
          </Field>
          <Field label='Paid tier'>
            <Select
              value={paidTier}
              disabled={subscriptionStatus === 'free'}
              onChange={event =>
                setPaidTier(event.target.value as 'base' | 'plus')
              }
            >
              <option value='base'>Base</option>
              <option value='plus'>Plus</option>
            </Select>
          </Field>
        </div>

        <div className='border-foreground/10 bg-muted rounded-lg border p-4'>
          <p className='text-sm font-semibold'>Subscription result</p>
          <p className='text-foreground/65 mt-1 text-sm leading-6'>
            This user will be marked as{' '}
            <span className='font-semibold capitalize'>{submittedPlan}</span>.
            Paid users appear as active subscribers in the admin table, while
            free users remain on the marketplace access tier.
          </p>
        </div>

        <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type='submit'>
            <Pencil className='mr-2 h-4 w-4' aria-hidden />
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  returnTo
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: AdminUserRecord
  returnTo: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title='Delete user'
      description='This action removes the selected user from the admin directory.'
      className='max-w-xl'
    >
      <form action={deleteAdminUserAction} className='space-y-5'>
        <input type='hidden' name='id' value={user.id} />
        <input type='hidden' name='returnTo' value={returnTo} />

        <div className='rounded-lg border border-red-500/25 bg-red-500/10 p-4'>
          <p className='font-semibold'>This action is permanent.</p>
          <p className='text-foreground/65 mt-2 text-sm leading-6'>
            Deleting {user.displayName} removes this wallet from the
            server-rendered admin table and clears it from normal user
            operations. the gateway stores admin edits as server-readable
            overrides; production backends should apply the same confirmation
            before deleting persisted records.
          </p>
          <p className='text-foreground/70 mt-3 font-mono text-xs break-all'>
            {user.walletAddress}
          </p>
        </div>

        <div className='flex flex-col-reverse gap-3 sm:flex-row sm:justify-end'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            className='bg-red-600 text-white hover:bg-red-700'
          >
            <Trash2 className='mr-2 h-4 w-4' aria-hidden />
            Delete user
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className='space-y-2'>
      <span className='text-foreground/60 text-xs tracking-[0.16em] uppercase'>
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'border-foreground/15 bg-background text-foreground focus-visible:ring-foreground/30 h-11 w-full rounded-2xl border px-4 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
}
