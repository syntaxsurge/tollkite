import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const sections = [
  {
    title: 'Use of the app',
    body: 'The app provides USDT-native API marketplace, provider dashboard, wallet, admin, and receipt surfaces for paid API commerce.'
  },
  {
    title: 'Billing terms',
    body: 'Paid pricing actions use SubscriptionManager when a deployed contract address is configured. Add final commercial terms before collecting production payments.'
  },
  {
    title: 'Smart-contract risk',
    body: 'Contract templates and tooling require independent review, testing, and deployment controls before production use.'
  }
]

export default function TermsPage() {
  return (
    <div className='bg-app-grid'>
      <section className='mx-auto w-full max-w-4xl px-6 py-16'>
        <div className='mb-8 space-y-4'>
          <Badge>Terms</Badge>
          <h1 className='font-display text-4xl'>Terms of service</h1>
          <p className='text-foreground/70 max-w-2xl text-sm leading-6'>
            Marketplace usage, provider responsibilities, buyer access, and
            payment risk.
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
