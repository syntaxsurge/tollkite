'use client'

import { usePathname } from 'next/navigation'

import { AdminSidebar } from '@/components/layout/admin-sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'

export function WorkspaceSidebar() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin')) {
    return <AdminSidebar />
  }

  return <AppSidebar />
}
