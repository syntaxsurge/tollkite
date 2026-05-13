import 'server-only'

import { promises as fs } from 'node:fs'
import type { Dirent } from 'node:fs'
import path from 'node:path'

import {
  getExplorerAddressUrl,
  getSubscriptionChain
} from '@/lib/config/chains'
import { siteConfig } from '@/lib/config/site'
import { walletProvider } from '@/lib/config/wallet'
import { envClient } from '@/lib/env/env.client'

const ROOT = process.cwd()
const CONTRACTS_DIR = path.join(ROOT, 'blockchain', 'contracts')
const HARDHAT_CONFIG = path.join(ROOT, 'blockchain', 'hardhat.config.ts')
const PACKAGE_JSON = path.join(ROOT, 'package.json')

async function pathExists(target: string) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function listSolidityContracts(baseDir: string) {
  const contracts: string[] = []

  async function walk(dir: string) {
    let entries: Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.sol')) {
        const relative = path
          .relative(baseDir, fullPath)
          .replace(/\\/g, '/')
          .replace(/\.sol$/, '')
        contracts.push(relative)
      }
    }
  }

  await walk(baseDir)

  return contracts.sort()
}

async function readPackageJson() {
  try {
    const raw = await fs.readFile(PACKAGE_JSON, 'utf8')
    return JSON.parse(raw) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      scripts?: Record<string, string>
    }
  } catch {
    return {}
  }
}

export async function getProjectSnapshot() {
  const subscriptionChain = getSubscriptionChain()
  const [contracts, hasHardhat, pkg] = await Promise.all([
    listSolidityContracts(CONTRACTS_DIR),
    pathExists(HARDHAT_CONFIG),
    readPackageJson()
  ])

  const deps = pkg.dependencies ?? {}
  const devDeps = pkg.devDependencies ?? {}
  const getVersion = (name: string) => deps[name] ?? devDeps[name] ?? null

  return {
    appName: siteConfig.name,
    appDescription: siteConfig.description,
    appUrl: siteConfig.url,
    walletProvider,
    walletProviderLabel:
      walletProvider === 'rainbow-kit' ? 'RainbowKit' : 'Thirdweb',
    hasThirdwebClientId: Boolean(envClient.NEXT_PUBLIC_THIRDWEB_CLIENT_ID),
    hasWalletConnectProjectId: Boolean(
      envClient.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
    ),
    convexUrl: envClient.NEXT_PUBLIC_CONVEX_URL ?? null,
    subscriptionManagerAddress:
      envClient.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS ?? null,
    subscriptionManagerExplorerUrl: getExplorerAddressUrl(
      envClient.NEXT_PUBLIC_SUBSCRIPTION_MANAGER_ADDRESS
    ),
    subscriptionChain: {
      id: subscriptionChain.id,
      name: subscriptionChain.shortName,
      explorerName: subscriptionChain.explorer.name,
      nativeTokenSymbol: subscriptionChain.nativeCurrency.symbol
    },
    contracts,
    contractCount: contracts.length,
    tooling: hasHardhat ? ['Hardhat'] : ['Not configured'],
    versions: {
      next: getVersion('next'),
      react: getVersion('react'),
      convex: getVersion('convex'),
      thirdweb: getVersion('thirdweb'),
      wagmi: getVersion('wagmi')
    },
    scripts: Object.keys(pkg.scripts ?? {}).sort()
  }
}
