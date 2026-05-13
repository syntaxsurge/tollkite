import { cookies } from 'next/headers'

import { AdminUsersTable } from '@/components/admin/admin-users-table'
import { ADMIN_USER_OVERRIDES_COOKIE } from '@/lib/admin/admin-user-cookies'
import {
  AdminUserQuery,
  applyAdminUserOverrides,
  listAdminDirectoryUsers,
  parseAdminUserOverrides,
  queryAdminUsers
} from '@/lib/admin/admin-users'

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<AdminUserQuery>
}) {
  const params = await searchParams
  const cookieStore = await cookies()
  const overrides = parseAdminUserOverrides(
    cookieStore.get(ADMIN_USER_OVERRIDES_COOKIE)?.value
  )
  const seededUsers = applyAdminUserOverrides(
    await listAdminDirectoryUsers(),
    overrides
  )
  const result = queryAdminUsers(seededUsers, params, {})

  return (
    <AdminUsersTable
      users={result.users}
      query={params}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      pageCount={result.pageCount}
      sort={result.sort}
      direction={result.direction}
    />
  )
}
