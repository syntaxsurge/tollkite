import { UserSettingsForm } from '@/components/settings/user-settings-form'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Settings</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Account settings</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Update profile, workspace, notification, and privacy preferences.
          </p>
        </div>
      </section>

      <UserSettingsForm />
    </div>
  )
}
