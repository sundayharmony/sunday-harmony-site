/**
 * Area 01 credential hygiene after anon RLS exposure:
 * - Clear password-reset tokens for all users
 * - Invalidate login hashes for staff (admin + credit_manager) by default
 * - Optional: --all-users also rotates client passwords
 *
 * Does NOT email users. Affected accounts must use forgot-password after this runs.
 *
 * Usage: node scripts/invalidate-exposed-auth.mjs
 *        node scripts/invalidate-exposed-auth.mjs --all-users
 * Dry run:  node scripts/invalidate-exposed-auth.mjs --dry-run
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const allUsers = process.argv.includes('--all-users')

function loadEnv(path) {
  let raw
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    if (line.startsWith('export ')) line = line.slice(7).trim()
    const i = line.indexOf('=')
    const k = line.slice(0, i).trim()
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    env[k] = v
  }
  return env
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  return `${salt}:${hash}`
}

function pick(envList, keys) {
  for (const env of envList) {
    for (const k of keys) {
      const v = (env[k] || '').trim()
      if (v) return v
    }
  }
  return ''
}

const envList = [
  loadEnv(join(root, '.env.local')),
  loadEnv(join(root, '.env.vercel-pull-tmp')),
  loadEnv(join(root, '.env.vercel.production')),
]
const url = pick(envList, ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'])
const service = pick(envList, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'])
if (!url || !service) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, service)
const { data: users, error } = await sb.from('users').select('id,email,role,reset_token,reset_token_expires')
if (error) {
  console.error('list users failed', error.message)
  process.exit(1)
}

console.log(dryRun ? 'DRY RUN' : 'APPLYING', 'users=', users?.length ?? 0)

let clearedTokens = 0
let rotatedStaff = 0

for (const u of users || []) {
  const needsTokenClear = u.reset_token != null || u.reset_token_expires != null
  const isStaff = u.role === 'admin' || u.role === 'credit_manager'
  const rotatePassword = isStaff || (allUsers && u.role === 'client')

  if (!needsTokenClear && !rotatePassword) continue

  const updates = {}
  if (needsTokenClear) {
    updates.reset_token = null
    updates.reset_token_expires = null
  }
  if (rotatePassword) {
    updates.password = hashPassword(crypto.randomBytes(32).toString('hex'))
  }

  console.log(
    rotatePassword ? (isStaff ? 'staff_invalidate' : 'client_invalidate') : 'clear_tokens',
    u.role,
    u.email,
    Object.keys(updates).join(',')
  )

  if (dryRun) {
    if (needsTokenClear) clearedTokens++
    if (rotatePassword) rotatedStaff++
    continue
  }

  const { error: upErr } = await sb.from('users').update(updates).eq('id', u.id)
  if (upErr) {
    console.error('update failed', u.email, upErr.message)
    process.exit(1)
  }
  if (needsTokenClear) clearedTokens++
  if (rotatePassword) rotatedStaff++
}

console.log('done cleared_tokens=', clearedTokens, 'rotated_staff_passwords=', rotatedStaff)
console.log('Staff must reset passwords via /login forgot-password before signing in again.')
