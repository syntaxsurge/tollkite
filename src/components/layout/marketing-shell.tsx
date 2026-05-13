import Link from 'next/link'

import { SiteHeader } from '@/components/layout/site-header'
import { footerNav } from '@/lib/config/navigation'
import { siteConfig } from '@/lib/config/site'

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-background text-foreground flex min-h-screen flex-col'>
      <SiteHeader />
      <main id='main-content' className='flex-1'>
        {children}
      </main>
      <footer className='border-border/80 bg-card/50 border-t backdrop-blur'>
        <div className='container-page flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between'>
          <div>
            <p className='text-sm font-semibold'>{siteConfig.name}</p>
            <p className='text-muted-foreground text-xs'>
              USDT-native API commerce on Kite rails.
            </p>
          </div>
          <div className='text-muted-foreground flex flex-wrap gap-4 text-xs'>
            {footerNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className='hover:text-foreground transition'
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}
