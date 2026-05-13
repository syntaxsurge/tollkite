import { Mail, UserRound, Wallet } from 'lucide-react'

import { AdminUserRowActions } from '@/components/admin/admin-user-row-actions'
import {
  ServerDataTable,
  type ServerDataTableColumn
} from '@/components/data-display/server-data-table'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  type AdminUserQuery,
  type AdminUserRecord,
  type AdminUserSortKey,
  getSubscriptionStatus
} from '@/lib/admin/admin-users'

type AdminUsersTableProps = {
  users: AdminUserRecord[]
  query: AdminUserQuery
  total: number
  page: number
  pageSize: number
  pageCount: number
  sort: AdminUserSortKey
  direction: 'asc' | 'desc'
}

export function AdminUsersTable({
  users,
  query,
  total,
  page,
  pageSize,
  pageCount,
  sort,
  direction
}: AdminUsersTableProps) {
  const q = query.q ?? query.search ?? ''
  const preserveParams = {
    role: query.role,
    plan: query.plan,
    status: query.status
  }

  return (
    <Card className='space-y-5'>
      <div className='flex flex-col justify-between gap-4 xl:flex-row xl:items-end'>
        <div>
          <Badge>Users</Badge>
          <h1 className='font-display mt-4 text-4xl'>User directory</h1>
          <p className='text-foreground/65 mt-2 max-w-2xl text-sm leading-6'>
            Manage identity, account state, and subscriptions with the same
            server-side table controls used across the admin workspace.
          </p>
        </div>
        <form
          className='grid gap-2 sm:grid-cols-[auto_auto_auto_auto]'
          action='/admin/users'
        >
          <input type='hidden' name='q' value={q} />
          <input type='hidden' name='sort' value={sort} />
          <input type='hidden' name='dir' value={direction} />
          <input type='hidden' name='pageSize' value={pageSize} />
          <FilterSelect
            label='Role'
            name='role'
            value={query.role}
            options={['admin', 'member']}
          />
          <FilterSelect
            label='Tier'
            name='plan'
            value={query.plan}
            options={['free', 'base', 'plus']}
          />
          <FilterSelect
            label='Status'
            name='status'
            value={query.status}
            options={['active', 'invited', 'paused']}
          />
          <button
            className={buttonClasses({
              size: 'sm',
              className: 'h-11 self-end'
            })}
          >
            Apply filters
          </button>
        </form>
      </div>

      <ServerDataTable
        id='admin-users'
        rows={users}
        columns={userColumns({ query, sort, direction, pageSize })}
        getRowId={user => user.id}
        basePath='/admin/users'
        query={q}
        sort={sort}
        dir={direction}
        page={page}
        pageSize={pageSize}
        totalRows={total}
        totalPages={pageCount}
        preserveParams={preserveParams}
        searchPlaceholder='Search users, wallets, email, or username'
        emptyTitle='No users found'
        emptyDescription='Adjust the server-side search or filters to find matching users.'
        enableSelection
        bulkActions={[
          {
            label: 'Delete selected',
            endpoint: '/api/admin/users/bulk-delete',
            confirmMessage:
              'Delete the selected users from the admin directory?'
          }
        ]}
      />
    </Card>
  )
}

function userColumns({
  query,
  sort,
  direction,
  pageSize
}: {
  query: AdminUserQuery
  sort: AdminUserSortKey
  direction: 'asc' | 'desc'
  pageSize: number
}): ServerDataTableColumn<AdminUserRecord>[] {
  const returnTo = buildUsersHref({
    ...query,
    q: query.q ?? query.search,
    sort,
    dir: direction,
    pageSize: String(pageSize)
  })

  return [
    {
      key: 'identity',
      label: 'User',
      sortKey: 'displayName',
      className: 'min-w-[260px]',
      render: user => (
        <div className='space-y-2'>
          <div className='flex items-center gap-3'>
            <span className='bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full'>
              <UserRound className='h-4 w-4' aria-hidden />
            </span>
            <div className='min-w-0'>
              <p className='font-semibold'>{user.displayName}</p>
              <p className='text-muted-foreground text-xs'>
                @{user.username || 'unclaimed'}
              </p>
            </div>
          </div>
          {user.email ? (
            <p className='text-muted-foreground flex items-center gap-2 text-xs'>
              <Mail className='h-3.5 w-3.5' aria-hidden />
              {user.email}
            </p>
          ) : null}
        </div>
      )
    },
    {
      key: 'wallet',
      label: 'Wallet',
      sortKey: 'walletAddress',
      className: 'min-w-[240px]',
      render: user => (
        <p className='text-foreground/85 flex items-start gap-2 font-mono text-xs break-all'>
          <Wallet className='text-primary mt-0.5 h-3.5 w-3.5 shrink-0' />
          {user.walletAddress}
        </p>
      )
    },
    {
      key: 'role',
      label: 'Role',
      sortKey: 'role',
      render: user => <StatusPill>{user.role}</StatusPill>
    },
    {
      key: 'subscription',
      label: 'Subscription',
      sortKey: 'subscriptionStatus',
      render: user => (
        <div>
          <StatusPill>{getSubscriptionStatus(user.plan)}</StatusPill>
          <p className='text-muted-foreground mt-2 text-xs capitalize'>
            {user.plan} tier
          </p>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      render: user => <StatusPill>{user.status}</StatusPill>
    },
    {
      key: 'lastSeen',
      label: 'Last seen',
      sortKey: 'lastSeenAt',
      className: 'min-w-[180px]',
      render: user => (
        <span className='text-muted-foreground text-sm'>
          {new Intl.DateTimeFormat('en', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(new Date(user.lastSeenAt))}
        </span>
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: user => <AdminUserRowActions user={user} returnTo={returnTo} />
    }
  ]
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className='bg-muted text-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize'>
      {children}
    </span>
  )
}

function FilterSelect({
  label,
  name,
  value,
  options
}: {
  label: string
  name: string
  value?: string
  options: string[]
}) {
  return (
    <label className='space-y-1'>
      <span className='text-foreground/60 text-xs font-semibold tracking-[0.14em] uppercase'>
        {label}
      </span>
      <select
        name={name}
        defaultValue={value ?? ''}
        className='border-foreground/15 bg-background text-foreground focus-visible:ring-foreground/30 h-11 rounded-lg border px-3 text-sm capitalize focus-visible:ring-2 focus-visible:outline-none'
      >
        <option value=''>All {label.toLowerCase()}</option>
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function buildUsersHref(query: AdminUserQuery) {
  const params = new URLSearchParams()
  const q = query.q ?? query.search
  const dir = query.dir ?? query.direction

  if (q) params.set('q', q)
  if (query.role) params.set('role', query.role)
  if (query.plan) params.set('plan', query.plan)
  if (query.status) params.set('status', query.status)
  if (query.sort) params.set('sort', query.sort)
  if (dir) params.set('dir', dir)
  if (query.page) params.set('page', query.page)
  if (query.pageSize) params.set('pageSize', query.pageSize)

  const search = params.toString()

  return search ? `/admin/users?${search}` : '/admin/users'
}
