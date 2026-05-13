import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const blockchainDir = path.join(rootDir, 'blockchain')

const network = process.argv[2]?.trim() || process.env.NETWORK || 'appChain'

const scriptPath = path.join(
  blockchainDir,
  'scripts',
  'deploySubscriptionManager.ts'
)

const { status } = spawnSync(
  'pnpm',
  [
    '--dir',
    blockchainDir,
    'exec',
    'hardhat',
    'run',
    scriptPath,
    '--network',
    network
  ],
  { stdio: 'inherit' }
)

if (status !== 0) {
  process.exit(status ?? 1)
}

console.log('\nSubscriptionManager deployed successfully.')
