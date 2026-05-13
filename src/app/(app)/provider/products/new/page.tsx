import { Badge } from '@/components/ui/badge'
import { ProviderProductForm } from '@/features/marketplace/provider-product-form'

export default function NewProviderProductPage() {
  return (
    <div className='space-y-8'>
      <section className='bg-panel-sheen border-foreground/10 rounded-lg border p-6'>
        <Badge>Create API product</Badge>
        <div className='mt-4 max-w-3xl space-y-3'>
          <h1 className='font-display text-4xl'>List a paid API</h1>
          <p className='text-foreground/70 text-sm leading-6'>
            Add pricing, schemas, auth, settlement, and visibility.
          </p>
        </div>
      </section>

      <ProviderProductForm />
    </div>
  )
}
