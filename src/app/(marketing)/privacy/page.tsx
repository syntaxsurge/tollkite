import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const sections = [
  {
    title: 'Default collection',
    body: 'the gateway keeps wallet connection state local for route protection and uses Convex-backed records for marketplace data.'
  },
  {
    title: 'Wallet data',
    body: 'Wallet connection state is used locally to protect app routes. Add explicit data policies before storing wallet addresses or signatures.'
  },
  {
    title: 'Backend data',
    body: 'Convex is the application data layer. Document table usage, retention, and deletion workflows as the product grows.'
  }
]

export default function PrivacyPage() {
  return (
    <div className='bg-app-grid'>
      <section className='mx-auto w-full max-w-4xl px-6 py-16'>
        <div className='mb-8 space-y-4'>
          <Badge>Privacy</Badge>
          <h1 className='font-display text-4xl'>Privacy policy</h1>
          <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
            Product data surfaces for wallet routes, receipts, and provider
            records.
          </p>
        </div>
        <div className='grid gap-4'>
          {sections.map(section => (
            <Card key={section.title} className='space-y-2'>
              <h2 className='font-display text-2xl'>{section.title}</h2>
              <p className='text-foreground/70 text-sm leading-6'>
                {section.body}
              </p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
