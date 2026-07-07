#!/usr/bin/env node
/**
 * Deploy dispute-letters-api to Railway and sync Vercel env vars.
 * Prerequisites: `npx @railway/cli login` completed once on this machine.
 *
 * Usage (from repo root):
 *   node scripts/deploy-dispute-letters-railway.mjs
 */

import { execSync, spawnSync } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const API_DIR = path.join(ROOT, 'services', 'dispute-letters-api')
const RAILWAY = 'npx'
const RAILWAY_ARGS = ['@railway/cli']

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd || API_DIR, ...opts })
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || `Command failed: ${cmd} ${args.join(' ')}`).trim())
  }
  return (r.stdout || '').trim()
}

function parseEnvFile(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

function requireLogin() {
  try {
    run(RAILWAY, [...RAILWAY_ARGS, 'whoami'])
  } catch {
    console.error('\nRailway CLI is not logged in.')
    console.error('Run: npx @railway/cli login')
    console.error('Complete sign-in in the browser, then re-run this script.\n')
    process.exit(1)
  }
}

function loadSecrets() {
  const local = parseEnvFile(path.join(ROOT, '.env.local'))
  const creditLetter = parseEnvFile(
    path.join(process.env.USERPROFILE || '', 'Downloads', 'Credit letter automation', '.env')
  )

  const supabaseUrl = local.NEXT_PUBLIC_SUPABASE_URL || local.SUPABASE_URL
  const supabaseKey = local.SUPABASE_SERVICE_ROLE_KEY
  const cursorKey = creditLetter.CURSOR_API_KEY || local.CURSOR_API_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }
  if (!cursorKey) {
    throw new Error('Missing CURSOR_API_KEY in Credit letter automation/.env or .env.local')
  }

  let apiSecret = local.DISPUTE_LETTERS_API_SECRET
  if (!apiSecret) {
    apiSecret = crypto.randomBytes(32).toString('hex')
    console.log('Generated new DISPUTE_LETTERS_API_SECRET')
  }

  return {
    CURSOR_API_KEY: cursorKey,
    DISPUTE_LETTERS_API_SECRET: apiSecret,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey,
    DISPUTE_CORS_ORIGINS:
      'https://www.sundayharmony.com,https://sunday-harmony-site.vercel.app',
  }
}

function ensureProject() {
  const status = run(RAILWAY, [...RAILWAY_ARGS, 'status'], { cwd: API_DIR })
  if (status.includes('Project:')) return
  console.log('Linking new Railway project dispute-letters-api…')
  run(RAILWAY, [...RAILWAY_ARGS, 'init', '--name', 'dispute-letters-api'], { cwd: API_DIR })
}

function setRailwayVars(vars) {
  for (const [key, value] of Object.entries(vars)) {
    console.log(`Setting Railway var ${key}…`)
    run(RAILWAY, [...RAILWAY_ARGS, 'variables', 'set', `${key}=${value}`], { cwd: API_DIR })
  }
}

function deploy() {
  console.log('Deploying to Railway (this may take several minutes)…')
  run(RAILWAY, [...RAILWAY_ARGS, 'up', '--detach'], { cwd: API_DIR, stdio: 'inherit' })
}

function getServiceUrl() {
  try {
    const domain = run(RAILWAY, [...RAILWAY_ARGS, 'domain'], { cwd: API_DIR })
    if (domain && domain.startsWith('http')) return domain.replace(/\/$/, '')
    if (domain) return `https://${domain.replace(/\/$/, '')}`
  } catch {
    /* fall through */
  }
  const status = run(RAILWAY, [...RAILWAY_ARGS, 'status'], { cwd: API_DIR })
  const m = status.match(/https:\/\/[^\s]+\.up\.railway\.app/)
  if (m) return m[0]
  throw new Error('Could not determine Railway service URL. Run `railway domain` in services/dispute-letters-api')
}

function setVercelEnv(name, value, environments = ['production', 'preview', 'development']) {
  for (const env of environments) {
    try {
      execSync(`vercel env rm ${name} ${env} --yes`, { cwd: ROOT, stdio: 'pipe' })
    } catch {
      /* not set yet */
    }
    execSync(`vercel env add ${name} ${env}`, {
      cwd: ROOT,
      input: value,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  }
}

async function verifyHealth(baseUrl) {
  const res = await fetch(`${baseUrl}/health`)
  if (!res.ok) throw new Error(`/health returned ${res.status}`)
  const data = await res.json()
  if (data.status !== 'ok') throw new Error('Unexpected /health response')
  console.log('Health check OK:', baseUrl)
}

async function main() {
  requireLogin()
  const vars = loadSecrets()
  ensureProject()
  setRailwayVars(vars)
  deploy()

  // Wait for deploy to become reachable
  let baseUrl = ''
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 15000))
    try {
      baseUrl = getServiceUrl()
      await verifyHealth(baseUrl)
      break
    } catch (e) {
      console.log(`Waiting for service… (${i + 1}/12)`)
      if (i === 11) throw e
    }
  }

  console.log('\nSetting Vercel env vars…')
  setVercelEnv('DISPUTE_LETTERS_API_URL', baseUrl)
  setVercelEnv('DISPUTE_LETTERS_API_SECRET', vars.DISPUTE_LETTERS_API_SECRET)

  console.log('\nDone.')
  console.log('DISPUTE_LETTERS_API_URL=', baseUrl)
  console.log('Redeploy Vercel production: vercel --prod')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
