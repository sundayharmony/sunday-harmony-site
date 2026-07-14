/**
 * Verify anon key cannot read sensitive tables (Area 01 guard).
 * Loads .env.local + .env.vercel.production. Exit 1 if any EXPOSED table found.
 *
 * Usage: node scripts/verify-anon-rls.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

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
const anon = pick(envList, ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'])
const service = pick(envList, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY'])

if (!url || !anon || !service) {
  console.error('Missing URL, anon key, or service role key')
  process.exit(1)
}

/** Tables that must never be readable via anon when data exists. */
const MUST_DENY = [
  'users',
  'clients',
  'leads',
  'admin_data',
  'activity_log',
  'messages',
  'files',
  'tasks',
  'notifications',
  'approvals',
  'credit_funding_applications',
  'uploaded_documents',
  'client_meetings',
  'stripe_webhook_events',
  'dispute_sessions',
  'dispute_letters',
  'staff_messages',
]

const PRIVATE_BUCKETS = ['client-files', 'credit-funding-docs', 'dispute-letters']

console.log('project_ref', new URL(url).hostname.split('.')[0])

const anonClient = createClient(url, anon)
const admin = createClient(url, service)

let exposed = 0
let failed = 0

for (const t of MUST_DENY) {
  const a = await anonClient.from(t).select('*', { count: 'exact', head: true })
  const s = await admin.from(t).select('*', { count: 'exact', head: true })
  if (a.error && !s.error) {
    console.log(`OK ${t} anon_blocked service=${s.count ?? 0}`)
    continue
  }
  if (a.error && s.error) {
    console.log(`SKIP ${t} missing`)
    continue
  }
  const anonCount = a.count ?? 0
  const svcCount = s.count ?? 0
  if (anonCount > 0) {
    console.log(`EXPOSED ${t} anon=${anonCount} service=${svcCount}`)
    exposed++
  } else if (svcCount > 0) {
    console.log(`OK ${t} denied anon=0 service=${svcCount}`)
  } else {
    console.log(`OK ${t} empty`)
  }
}

const { data: buckets, error: bErr } = await admin.storage.listBuckets()
if (bErr) {
  console.log('bucket_list_error', bErr.message)
  failed++
} else {
  for (const id of PRIVATE_BUCKETS) {
    const b = buckets?.find((x) => x.id === id)
    if (!b) {
      console.log(`WARN bucket ${id} missing`)
      continue
    }
    if (b.public) {
      console.log(`EXPOSED bucket ${id} public=true`)
      exposed++
    } else {
      console.log(`OK bucket ${id} private`)
    }
  }
}

if (exposed > 0 || failed > 0) {
  console.error(`FAIL exposed=${exposed} errors=${failed}`)
  process.exit(1)
}
console.log('PASS anon RLS + private buckets')
