import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const API_DIR = path.join(ROOT, 'services', 'dispute-letters-api')
const CREDIT_ENV = path.join('C:', 'Users', 'Mac', 'Downloads', 'Credit letter automation', '.env')

function parseEnv(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[key] = v
  }
  return out
}

function railway(args, opts = {}) {
  const r = spawnSync('npx', ['@railway/cli', ...args], {
    encoding: 'utf8',
    cwd: opts.cwd || API_DIR,
    stdio: opts.stdio || 'pipe',
  })
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || 'railway failed').trim())
  }
  return (r.stdout || '').trim()
}

const local = parseEnv(path.join(ROOT, '.env.local'))
const credit = parseEnv(CREDIT_ENV)
const secretFile = path.join(ROOT, '.dispute-secret.tmp')
const apiSecret = fs.existsSync(secretFile)
  ? fs.readFileSync(secretFile, 'utf8').trim()
  : crypto.randomBytes(32).toString('hex')

const vars = {
  CURSOR_API_KEY: credit.CURSOR_API_KEY || local.CURSOR_API_KEY,
  DISPUTE_LETTERS_API_SECRET: apiSecret,
  SUPABASE_URL: local.NEXT_PUBLIC_SUPABASE_URL || local.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: local.SUPABASE_SERVICE_ROLE_KEY,
  DISPUTE_CORS_ORIGINS: 'https://www.sundayharmony.com,https://sunday-harmony-site.vercel.app',
}

for (const [k, v] of Object.entries(vars)) {
  if (!v) throw new Error(`Missing ${k}`)
}

console.log('Initializing Railway project…')
railway(['init', '--name', 'dispute-letters-api'], { stdio: 'inherit' })

for (const [k, v] of Object.entries(vars)) {
  console.log(`Setting ${k}…`)
  railway(['variables', 'set', `${k}=${v}`])
}

console.log('Deploying…')
railway(['up', '--detach'], { stdio: 'inherit' })

let url = ''
try {
  const domain = railway(['domain'])
  url = domain.startsWith('http') ? domain.replace(/\/$/, '') : `https://${domain.replace(/\/$/, '')}`
} catch {
  const status = railway(['status'])
  const m = status.match(/https:\/\/[^\s]+\.up\.railway\.app/)
  if (m) url = m[0]
}

if (!url) throw new Error('Could not resolve Railway URL — run railway domain in services/dispute-letters-api')

fs.writeFileSync(path.join(ROOT, '.dispute-railway-url.tmp'), url)
fs.writeFileSync(secretFile, apiSecret)
console.log('RAILWAY_URL=' + url)
