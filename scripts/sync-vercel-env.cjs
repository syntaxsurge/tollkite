#!/usr/bin/env node
const fs = require('node:fs')
const { spawnSync } = require('node:child_process')
const dotenv = require('dotenv')

const validTargets = new Set(['production', 'preview', 'development'])
const args = process.argv.slice(2)
const target = args.find(arg => !arg.startsWith('--')) || 'production'
const shouldDeploy = args.includes('--deploy')
const envPath = '.env.local'
const vercelProjectFiles = ['.vercel/project.json', '.vercel/repo.json']

if (!validTargets.has(target)) {
  console.error(
    `Invalid Vercel environment "${target}". Use production, preview, or development.`
  )
  process.exit(1)
}

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Create it before syncing Vercel env vars.`)
  process.exit(1)
}

if (!vercelProjectFiles.some(file => fs.existsSync(file))) {
  console.error(
    'This workspace is not linked to a Vercel project. Run `pnpm exec vercel link` first and choose not to pull environment variables.'
  )
  process.exit(1)
}

const parsed = dotenv.parse(fs.readFileSync(envPath))
const entries = Object.entries(parsed)

if (entries.length === 0) {
  console.error(`${envPath} does not contain any environment variables.`)
  process.exit(1)
}

for (const [key, value] of entries) {
  runVercel(['env', 'add', key, target, '--force', '--yes'], value)
}

if (shouldDeploy) {
  runVercel(target === 'production' ? ['--prod'] : [])
}

console.log(
  `Synced ${entries.length} ${target} Vercel environment variable${
    entries.length === 1 ? '' : 's'
  } from ${envPath}.`
)

function runVercel(vercelArgs, input) {
  const result = spawnSync('pnpm', ['exec', 'vercel', ...vercelArgs], {
    input,
    stdio: input === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit']
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}
