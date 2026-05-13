import '../styles/globals.css'

import { Geist_Mono, Inter } from 'next/font/google'

import type { Metadata, Viewport } from 'next'
import NextTopLoader from 'nextjs-toploader'

import { NavigationProgressEvents } from '@/components/feedback/navigation-progress-events'
import { AppProviders } from '@/components/providers/app-providers'
import { siteConfig } from '@/lib/config/site'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
})

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    type: 'website'
  }
}

export const viewport: Viewport = {
  themeColor: '#F6F8FB'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang='en'
      className={`${inter.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className='bg-background text-foreground min-h-screen antialiased'>
        <a
          href='#main-content'
          className='focus-ring bg-card text-foreground border-border fixed top-4 left-4 z-[80] -translate-y-24 rounded-lg border px-4 py-2 text-sm font-semibold shadow-md transition focus-visible:translate-y-0'
        >
          Skip to content
        </a>
        <NextTopLoader
          color='#00C2FF'
          height={3}
          showSpinner={false}
          shadow='0 0 16px rgba(0, 194, 255, 0.45)'
        />
        <NavigationProgressEvents />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
