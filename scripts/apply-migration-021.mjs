/**
 * Apply supabase-migration-021-credit-manager-role.sql using production Postgres URL.
 * Usage: node scripts/apply-migration-021.mjs [.env file path]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnv(filePath) {
  const env = {}
  if (!fs.existsSync(filePath)) return env
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    let val = trimmed.slice(eq + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    env[key] = val
  }
  return env
}

const envFile = process.argv[2] || path.join(root, '.env.migration-check')
const env = {
  ...loadEnv(path.join(root, '.env.local')),
  ...loadEnv(envFile),
}

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  env.POSTGRES_URL_NON_POOLING ||
  env.POSTGRES_URL
if (!connectionString) {
  console.error('Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL in env')
  process.exit(1)
}

const sqlPath = path.join(root, 'supabase-migration-021-credit-manager-role.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(sql)
  await client.query('COMMIT')
  console.log('Migration 021 applied successfully.')

  const checks = await client.query(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND conname = 'users_role_check';
  `)
  const table = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'staff_messages'
    ) AS exists;
  `)
  console.log('users_role_check:', checks.rows[0]?.def || 'missing')
  console.log('staff_messages table:', table.rows[0]?.exists ? 'present' : 'missing')
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Migration failed:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
