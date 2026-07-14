/**
 * Apply supabase-migration-020-fix-permissive-rls.sql to Sunday Harmony Postgres.
 * Uses POSTGRES_URL_NON_POOLING from .env.vercel.production (or .env.local).
 * Never prints connection strings or secrets.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

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

function pickConn(env) {
  for (const k of ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL', 'POSTGRES_PRISMA_URL']) {
    const v = (env[k] || '').trim()
    if (v.startsWith('postgres')) return v
  }
  const host = (env.POSTGRES_HOST || '').trim()
  const user = (env.POSTGRES_USER || 'postgres').trim()
  const password = (env.POSTGRES_PASSWORD || '').trim()
  const database = (env.POSTGRES_DATABASE || 'postgres').trim()
  if (host && password) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`
  }
  return ''
}

const cliUrl = (process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || '').trim()
let connectionString = cliUrl.startsWith('postgres') ? cliUrl : ''
let env = {}
let source = connectionString ? 'process.env' : ''

if (!connectionString) {
  const candidates = [
    join(root, '.env.production.local'),
    join(root, '.env.migration-check'),
    join(root, '.env.local'),
    join(root, '.env.vercel.production'),
    join(root, '.env.vercel-pull-tmp'),
  ]
  for (const path of candidates) {
    const loaded = loadEnv(path)
    env = { ...env, ...loaded }
    const conn = pickConn(loaded)
    if (conn) {
      connectionString = conn
      source = path
      break
    }
  }
}

if (!connectionString) {
  console.error(
    [
      'Missing Postgres connection string.',
      'Set DATABASE_URL (or POSTGRES_URL_NON_POOLING) and re-run, OR paste',
      'supabase-migration-020-fix-permissive-rls.sql into Supabase SQL Editor for project hvsoeezsbvwsrdobvgaz.',
    ].join('\n')
  )
  process.exit(1)
}
console.log('using_conn_from', source.includes(root) ? source.replace(root, '.').replace(/\\/g, '/') : source)

const expectedRef = 'hvsoeezsbvwsrdobvgaz'
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || ''
if (supabaseUrl && !supabaseUrl.includes(expectedRef)) {
  console.error('Refusing to run: SUPABASE URL is not', expectedRef)
  process.exit(1)
}

const sqlPath = join(root, 'supabase-migration-020-fix-permissive-rls.sql')
const sql = readFileSync(sqlPath, 'utf8')

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('COMMIT')
  console.log('migration_020 applied OK')

  const policies = await client.query(`
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
    ORDER BY tablename, policyname
  `)
  console.log('remaining_always_true_public_policies', policies.rowCount)

  const rls = await client.query(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND c.relname IN ('users','clients','leads','admin_data','activity_log')
    ORDER BY c.relname
  `)
  for (const row of rls.rows) {
    console.log('rls', row.relname, row.relrowsecurity ? 'on' : 'OFF')
  }

  const buckets = await client.query(`
    SELECT id, public FROM storage.buckets
    WHERE id IN ('client-files','credit-funding-docs','dispute-letters','client-case-studies')
    ORDER BY id
  `)
  for (const row of buckets.rows) {
    console.log('bucket', row.id, 'public=' + row.public)
  }
} catch (err) {
  try {
    await client.query('ROLLBACK')
  } catch {
    /* ignore */
  }
  console.error('migration_020 FAILED', err.message)
  process.exit(1)
} finally {
  await client.end()
}
