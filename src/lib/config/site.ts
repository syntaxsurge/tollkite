import { envClient } from '@/lib/env/env.client'

const productionAppUrl = 'https://platform.vercel.app'
const localHostnames = new Set(['localhost', '127.0.0.1', '::1'])

export const siteConfig = {
  name: envClient.NEXT_PUBLIC_APP_NAME ?? 'Tollkite',
  description:
    envClient.NEXT_PUBLIC_APP_DESCRIPTION ??
    'PYUSD-native API commerce for humans, applications, and AI agents on Kite.',
  url: envClient.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  links: {
    github: 'https://github.com/gokite-ai',
    twitter: 'https://x.com/GoKiteAI'
  }
}

export function getPublicAppOrigin(fallbackUrl = siteConfig.url) {
  const configuredOrigin = new URL(fallbackUrl).origin

  if (!localHostnames.has(new URL(configuredOrigin).hostname)) {
    return configuredOrigin
  }

  return new URL(resolveVercelProductionUrl() ?? productionAppUrl).origin
}

function resolveVercelProductionUrl() {
  const value =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL

  if (!value) {
    return undefined
  }

  return value.startsWith('http') ? value : `https://${value}`
}
