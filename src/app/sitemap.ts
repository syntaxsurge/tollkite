import type { MetadataRoute } from 'next'

import { siteConfig } from '@/lib/config/site'

const routes = ['', '/pricing', '/privacy', '/terms']

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(path => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date()
  }))
}
