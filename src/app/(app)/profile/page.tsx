import { ProfilePreview } from '@/components/settings/profile-preview'
import { Badge } from '@/components/ui/badge'

export default function ProfilePage() {
  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Profile</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>Builder profile</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Preview your public identity and connected account details.
          </p>
        </div>
      </section>

      <ProfilePreview />
    </div>
  )
}
