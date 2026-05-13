import { ProtectedAppGuard } from '@/components/layout/protected-app-guard'
import { SiteHeader } from '@/components/layout/site-header'
import { WorkspaceSidebar } from '@/components/layout/workspace-sidebar'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-background text-foreground min-h-screen'>
      <SiteHeader />
      <main id='main-content' className='container-page py-8 lg:py-10'>
        <ProtectedAppGuard>
          <div className='grid gap-6 lg:grid-cols-[280px_1fr]'>
            <WorkspaceSidebar />
            <div className='min-w-0'>{children}</div>
          </div>
        </ProtectedAppGuard>
      </main>
    </div>
  )
}
